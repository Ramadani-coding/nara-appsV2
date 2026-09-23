import { Router, type Request, type Response } from "express";
import { 
  orderService, 
  normalizePhone, 
  maskPhoneNumber, 
  maskEmail, 
  generateOrderToken, 
  verifyOrderToken 
} from "../services/order.service.js";
import { 
  validateWhatsAppNumber, 
  validateIndonesianPhoneLocal 
} from "../services/whatsapp.service.js";
import { db } from "../db/index.js";
import { orders } from "../db/schema.js";
import { eq, desc, like, or } from "drizzle-orm";
import { createOrderLimiter, phoneValidationLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Rate limiter in-memory untuk proteksi anti-brute force verifikasi nomor telepon
interface AttemptRecord {
  count: number;
  lockUntil: number;
}
const verificationAttempts = new Map<string, AttemptRecord>();

function checkRateLimit(key: string): { allowed: boolean; remainingSeconds?: number } {
  const now = Date.now();
  const record = verificationAttempts.get(key);
  if (!record) return { allowed: true };

  if (record.lockUntil > now) {
    const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  // Jika masa ban sudah lewat dan kuota habis, reset
  if (record.lockUntil <= now && record.count >= 5) {
    verificationAttempts.delete(key);
  }

  return { allowed: true };
}

function recordFailedAttempt(key: string): number {
  const now = Date.now();
  const record = verificationAttempts.get(key) || { count: 0, lockUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    // Kunci selama 10 menit (600.000 ms)
    record.lockUntil = now + 10 * 60 * 1000;
  }
  verificationAttempts.set(key, record);
  return record.count;
}

function resetAttempts(key: string) {
  verificationAttempts.delete(key);
}

function formatTimeAgo(dateInput: Date | string | null): string {
  if (!dateInput) return "Baru saja";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} hari lalu`;
}

/**
 * GET /api/orders/recent-sales
 * Mengambil transaksi riil terkini yang sukses (paid/completed) untuk social proof yang jujur & transparan.
 */
router.get("/recent-sales", async (_req: Request, res: Response) => {
  try {
    const recentOrders = await db.query.orders.findMany({
      where: or(eq(orders.status, "paid"), eq(orders.status, "completed")),
      orderBy: [desc(orders.createdAt)],
      limit: 8,
      with: {
        items: true,
      },
    });

    const data = recentOrders.map((order) => ({
      id: order.id,
      phone: maskPhoneNumber(order.customerPhone),
      product: order.items?.[0]?.productName || "Produk Digital",
      time: formatTimeAgo(order.createdAt),
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error("Error fetching recent sales:", error);
    res.status(500).json({
      success: false,
      data: [],
      message: "Gagal mengambil data transaksi terkini",
    });
  }
});

/**
 * POST /api/orders/validate-phone
 * Memvalidasi nomor WhatsApp pemesan dengan filter operator seluler Indonesia dan Fonnte API
 */
router.post("/validate-phone", phoneValidationLimiter, async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone || !String(phone).trim()) {
      res.status(400).json({
        success: false,
        valid: false,
        message: "Nomor WhatsApp wajib diisi",
      });
      return;
    }

    const result = await validateWhatsAppNumber(String(phone).trim());
    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Error validating phone:", error);
    res.status(500).json({
      success: false,
      valid: false,
      message: error.message || "Gagal memvalidasi nomor telepon",
    });
  }
});

/**
 * POST /api/orders
 * Membuat pesanan baru dan menghasilkan transaksi QRIS Midtrans Core API
 */
router.post("/", createOrderLimiter, async (req: Request, res: Response) => {
  try {
    const {
      productId,
      packageId,
      productName,
      price,
      quantity,
      customerPhone,
      customerEmail,
    } = req.body;

    if (!customerPhone || !String(customerPhone).trim()) {
      res.status(400).json({
        success: false,
        message: "Nomor WhatsApp wajib diisi",
      });
      return;
    }

    // Validasi ketat nomor seluler Indonesia & tolak nomor dummy
    const phoneCheck = validateIndonesianPhoneLocal(String(customerPhone).trim());
    if (!phoneCheck.isValid) {
      res.status(400).json({
        success: false,
        message: phoneCheck.message || "Nomor WhatsApp tidak valid",
      });
      return;
    }

    const orderResult = await orderService.createOrderWithQris({
      productId: productId ? Number(productId) : undefined,
      packageId: packageId ? String(packageId) : undefined,
      productName,
      price: price ? Number(price) : undefined,
      quantity: Number(quantity) || 1,
      customerPhone: phoneCheck.normalizedPhone || String(customerPhone).trim(),
      customerEmail: customerEmail ? String(customerEmail).trim() : undefined,
    });

    res.status(201).json({
      success: true,
      message: "Pesanan berhasil dibuat, silakan lakukan pembayaran QRIS",
      data: orderResult,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal membuat pesanan",
    });
  }
});

/**
 * POST /api/orders/:orderNumber/verify-phone
 * Memverifikasi nomor WhatsApp pemesan untuk membuka kunci (unlock) kredensial akun digital
 */
router.post("/:orderNumber/verify-phone", phoneValidationLimiter, async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    const { phone } = req.body;

    if (!orderNumber || !phone || !String(phone).trim()) {
      res.status(400).json({
        success: false,
        message: "Nomor pesanan dan nomor WhatsApp wajib diisi",
      });
      return;
    }

    const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "client-ip";
    const rateLimitKey = `${clientIp}:${orderNumber}`;

    const rateCheck = checkRateLimit(rateLimitKey);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil((rateCheck.remainingSeconds || 60) / 60);
      res.status(429).json({
        success: false,
        message: `Terlalu banyak percobaan salah. Demi keamanan, silakan coba lagi dalam ${minutes} menit.`,
      });
      return;
    }

    const order = await orderService.syncOrderStatusWithMidtrans(orderNumber);
    if (!order) {
      res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
      return;
    }

    const inputPhoneNorm = normalizePhone(String(phone).trim());
    const orderPhoneNorm = normalizePhone(order.customerPhone);

    // Cek kecocokan nomor telepon (mendukung awalan 08 / 62 / +62)
    const isMatch = 
      inputPhoneNorm === orderPhoneNorm ||
      (inputPhoneNorm.length >= 8 && orderPhoneNorm.endsWith(inputPhoneNorm)) ||
      (orderPhoneNorm.length >= 8 && inputPhoneNorm.endsWith(orderPhoneNorm));

    if (!isMatch) {
      const currentFailCount = recordFailedAttempt(rateLimitKey);
      const remainingAttempts = Math.max(0, 5 - currentFailCount);
      res.status(403).json({
        success: false,
        message: remainingAttempts > 0 
          ? `Nomor WhatsApp tidak cocok dengan nomor yang terdaftar pada pesanan ini. Sisa percobaan: ${remainingAttempts}x`
          : "Terlalu banyak percobaan salah. Akses dibekukan sementara selama 10 menit demi keamanan.",
      });
      return;
    }

    // Berhasil verifikasi: Reset rate limit
    resetAttempts(rateLimitKey);

    const token = generateOrderToken(order.orderNumber, order.customerPhone);

    res.json({
      success: true,
      message: "Verifikasi berhasil. Kredensial akun terbuka.",
      token,
      data: {
        ...order,
        isLocked: false,
        isVerified: true,
      },
    });
  } catch (error: any) {
    console.error("Error verifying order phone:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memverifikasi pesanan",
      error: error.message,
    });
  }
});

/**
 * GET /api/orders/lookup
 * Mencari daftar riwayat pesanan pelanggan berdasarkan nomor telepon (data kredensial tetap terlindungi)
 */
router.get("/lookup", async (req: Request, res: Response) => {
  try {
    const phone = req.query.phone as string;
    if (!phone || !phone.trim()) {
      res.status(400).json({ success: false, message: "Parameter phone wajib disertakan" });
      return;
    }

    const cleanRaw = phone.trim();
    const cleanPhone = normalizePhone(cleanRaw);

    // Keamanan: Validasi nomor seluler Indonesia minimal 10 digit untuk mencegah dump database via LIKE '%%'
    if (!cleanPhone || cleanPhone.length < 10) {
      res.status(400).json({
        success: false,
        message: "Nomor WhatsApp tidak valid. Masukkan minimal 10 digit nomor seluler Anda.",
      });
      return;
    }

    const intlPhone = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : cleanPhone;

    const userOrders = await db.query.orders.findMany({
      where: or(
        eq(orders.customerPhone, cleanPhone),
        eq(orders.customerPhone, intlPhone),
        eq(orders.customerPhone, cleanRaw)
      ),
      orderBy: [desc(orders.createdAt)],
      limit: 20,
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    const sanitizedOrders = userOrders.map(o => ({
      ...o,
      customerPhone: maskPhoneNumber(o.customerPhone),
      customerEmail: maskEmail(o.customerEmail),
      isLocked: true,
      deliveries: o.deliveries.map(d => ({
        id: d.id,
        orderId: d.orderId,
        productName: d.productName,
        status: d.status,
        deliveredAt: d.deliveredAt,
        isLocked: true,
        content: JSON.stringify({
          isLocked: true,
          message: "Kredensial akun terproteksi. Silakan buka invoice untuk verifikasi.",
        }),
      })),
    }));

    res.json({
      success: true,
      data: sanitizedOrders,
    });
  } catch (error: any) {
    console.error("Error looking up orders:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mencari riwayat pesanan",
      error: error.message,
    });
  }
});

/**
 * GET /api/orders/:orderNumber
 * Mengambil detail pesanan (dengan proteksi masking kredensial jika belum terverifikasi)
 */
router.get("/:orderNumber", async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) {
      res.status(400).json({ success: false, message: "Nomor order tidak valid" });
      return;
    }

    // Ambil token otentikasi dari headers atau query params
    const token = (req.headers["x-order-token"] as string) || (req.query.token as string) || null;

    // Ambil pesanan dan sinkronkan status dengan Midtrans jika masih waiting
    const isForce = req.query.force === "true" || req.query.fresh === "true";
    const order = await orderService.syncOrderStatusWithMidtrans(orderNumber, isForce);

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan",
      });
      return;
    }

    // Periksa otentikasi apakah pengakses berhak membuka kredensial
    // Keamanan Mutlak: Hapus bypass ?phone=... langsung. Pembukaan kredensial HANYA diizinkan melalui
    // token HMAC bertanda tangan dari endpoint POST /:orderNumber/verify-phone yang memiliki rate-limiter ketat.
    let isAuthorized = false;

    if (token && verifyOrderToken(order.orderNumber, order.customerPhone, token)) {
      isAuthorized = true;
    }

    // JIKA TERVERIFIKASI: Kirimkan seluruh detail akun dan kredensial lengkap
    if (isAuthorized) {
      res.json({
        success: true,
        data: {
          ...order,
          isLocked: false,
          isVerified: true,
        },
      });
      return;
    }

    // JIKA AKSES PUBLIK / BELUM TERVERIFIKASI:
    // Sensor data sensitif agar akun dan nomor HP TIDAK bocor ke publik atau devtools
    const maskedPhone = maskPhoneNumber(order.customerPhone);
    const maskedEmail = maskEmail(order.customerEmail);

    const maskedDeliveries = Array.isArray(order.deliveries)
      ? order.deliveries.map((del: any) => ({
          id: del.id,
          orderId: del.orderId,
          productName: del.productName,
          status: del.status,
          deliveredAt: del.deliveredAt,
          isLocked: true,
          content: JSON.stringify({
            isLocked: true,
            message: "Kredensial akun terproteksi demi keamanan. Masukkan nomor WhatsApp pemesan untuk membuka detail akun & password.",
          }),
        }))
      : [];

    res.json({
      success: true,
      data: {
        ...order,
        customerPhone: maskedPhone,
        customerEmail: maskedEmail,
        deliveries: maskedDeliveries,
        isLocked: true,
        isVerified: false,
      },
    });
  } catch (error: any) {
    console.error("Error fetching order detail:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil detail pesanan",
      error: error.message,
    });
  }
});

export default router;
