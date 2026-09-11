import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import { products, productCategories } from "../db/schema.js";
import { eq, desc } from "drizzle-orm";
import { syncService } from "../services/sync.service.js";
import { premiumkuService } from "../services/premiumku.service.js";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";

const router = Router();

// In-memory cache untuk membatasi frekuensi ping ke API stock Premku
interface CachedStock {
  stock: number;
  status: string;
  timestamp: number;
}
const stockCache = new Map<number, CachedStock>();
const STOCK_CACHE_TTL_MS = 20 * 1000; // 20 detik cache

let cachedSaldo = 0;
let lastSaldoTime = 0;
const SALDO_CACHE_TTL_MS = 30 * 1000; // 30 detik cache saldo Premku

/**
 * Mengambil saldo terkini dari akun Premiumku untuk kalkulasi batas stok modal
 */
async function getLiveSaldo(): Promise<number> {
  const now = Date.now();
  if (lastSaldoTime && now - lastSaldoTime < SALDO_CACHE_TTL_MS) {
    return cachedSaldo;
  }
  try {
    const prof = await premiumkuService.getProfile();
    if (prof.success && prof.data && typeof prof.data.saldo === "number") {
      cachedSaldo = prof.data.saldo;
      lastSaldoTime = now;
      return cachedSaldo;
    }
  } catch (err: any) {
    console.warn("Gagal refresh saldo Premku di produk API:", err.message);
  }
  return cachedSaldo;
}

/**
 * Helper untuk menyaring data produk publik
 * Menghapus providerPrice (modal supplier) dan marginValue agar tidak bocor ke publik,
 * tetapi menghitung secara akurat batas pembelian maksimal berdasarkan saldo modal riil toko di supplier
 */
function sanitizePublicProduct(p: any, currentSaldo = 0) {
  if (!p) return null;
  const { providerPrice, marginValue, ...safeData } = p;

  const modal = typeof providerPrice === "number" && providerPrice > 0 ? providerPrice : p.price;
  const maxByBalance = modal > 0 ? Math.floor(currentSaldo / modal) : (p.stockCount ?? 0);
  const isMaintenance = modal > 0 ? currentSaldo < modal : false;
  const maxAllowedQty = isMaintenance ? 0 : Math.max(0, Math.min(p.stockCount ?? 0, maxByBalance));

  return {
    ...safeData,
    isMaintenance,
    maxAllowedQty,
  };
}

/**
 * GET /api/products
 * Mengambil semua produk aktif beserta kategorinya (data modal supplier dilindungi)
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const currentSaldo = await getLiveSaldo();

    const allProducts = await db.query.products.findMany({
      where: eq(products.isActive, true),
      with: {
        category: true,
      },
      orderBy: [desc(products.createdAt)],
    });

    const safeProducts = allProducts.map((p) => sanitizePublicProduct(p, currentSaldo));

    res.json({
      success: true,
      data: safeProducts,
    });
  } catch (error: any) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar produk",
      error: error.message,
    });
  }
});

/**
 * GET /api/products/:id
 * Mengambil detail satu produk berdasarkan ID (data modal supplier dilindungi)
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "ID produk tidak valid" });
      return;
    }

    const currentSaldo = await getLiveSaldo();

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        category: true,
      },
    });

    if (!product || !product.isActive) {
      res.status(404).json({ success: false, message: "Produk tidak ditemukan atau tidak aktif" });
      return;
    }

    res.json({
      success: true,
      data: sanitizePublicProduct(product, currentSaldo),
    });
  } catch (error: any) {
    console.error("Error fetching product detail:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail produk",
      error: error.message,
    });
  }
});

/**
 * POST /api/products/sync
 * Memicu sinkronisasi manual dari API penyedia Premiumku (Wajib Hak Akses Admin)
 */
router.post("/sync", adminAuthMiddleware, async (_req: Request, res: Response) => {
  try {
    const syncResult = await syncService.syncProductsFromProvider();
    res.json({
      success: true,
      message: "Sinkronisasi produk berhasil",
      data: syncResult,
    });
  } catch (error: any) {
    console.error("Error syncing products:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan sinkronisasi produk",
      error: error.message,
    });
  }
});

/**
 * POST /api/products/validate-stock
 * Just-in-Time (JIT) Stock Validator & Pre-Payment Gatekeeper.
 * Memverifikasi stok aktual ke server supplier tepat sebelum pembuatan QRIS / pembayaran,
 * sehingga mencegah kasus pembeli sudah bayar tetapi stok produk ternyata kosong.
 */
router.post("/validate-stock", async (req: Request, res: Response) => {
  try {
    const { providerServiceId, quantity = 1 } = req.body;
    const provId = Number(providerServiceId);

    if (isNaN(provId) || provId <= 0) {
      res.status(400).json({
        success: false,
        available: false,
        message: "ID produk provider tidak valid.",
      });
      return;
    }

    const requestedQty = Math.max(1, Number(quantity) || 1);
    let liveStock = 0;
    let liveStatus = "available";
    let isFromCache = false;

    // 1. Periksa cache in-memory 20 detik untuk efisiensi
    const cached = stockCache.get(provId);
    if (cached && Date.now() - cached.timestamp < STOCK_CACHE_TTL_MS) {
      liveStock = cached.stock;
      liveStatus = cached.status;
      isFromCache = true;
    } else {
      // 2. Panggil endpoint stock Premku secara live
      try {
        const stockRes = await premiumkuService.checkStock(provId);
        liveStock = typeof stockRes.stock === "number" ? stockRes.stock : 0;
        liveStatus = stockRes.status || (liveStock > 0 ? "available" : "empty");

        // Simpan ke cache
        stockCache.set(provId, {
          stock: liveStock,
          status: liveStatus,
          timestamp: Date.now(),
        });
      } catch (err: any) {
        console.warn(`[ValidateStock] ⚠️ API Premku tidak merespon: ${err.message}. Menggunakan stok database lokal.`);
        const [dbProduct] = await db
          .select({ stockCount: products.stockCount, stockStatus: products.stockStatus })
          .from(products)
          .where(eq(products.providerServiceId, String(provId)));

        liveStock = dbProduct?.stockCount ?? 0;
        liveStatus = dbProduct?.stockStatus ?? "available";
      }
    }

    // 3. Sinkronkan ke database lokal jika ada perbedaan stok
    try {
      await db
        .update(products)
        .set({
          stockCount: liveStock,
          stockStatus: liveStock > 0 ? "available" : "empty",
          updatedAt: new Date(),
        })
        .where(eq(products.providerServiceId, String(provId)));
    } catch (_dbErr) {}

    // 4. Validasi ketersediaan stok
    const isAvailable = liveStock >= requestedQty && liveStatus !== "empty";

    if (!isAvailable) {
      res.status(409).json({
        success: false,
        available: false,
        stock: liveStock,
        cached: isFromCache,
        message:
          liveStock === 0
            ? "Maaf, stok produk ini baru saja habis beberapa saat yang lalu dibeli pembeli lain. Tagihan belum dibuat dan dana Anda aman."
            : `Maaf, stok yang tersisa saat ini hanya ${liveStock} unit. Mohon kurangi jumlah pesanan Anda.`,
      });
      return;
    }

    res.json({
      success: true,
      available: true,
      stock: liveStock,
      cached: isFromCache,
      message: "Stok tersedia dan terverifikasi di server supplier.",
    });
  } catch (error: any) {
    console.error("Error validating product stock:", error);
    res.status(500).json({
      success: false,
      available: false,
      message: "Gagal memverifikasi stok produk saat ini.",
      error: error.message,
    });
  }
});

export default router;
