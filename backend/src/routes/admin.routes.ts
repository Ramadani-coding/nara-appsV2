import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import { 
  orders, 
  orderItems, 
  payments, 
  deliveries, 
  products, 
  productCategories,
  users 
} from "../db/schema.js";
import { eq, desc, sql, and, like, or, inArray } from "drizzle-orm";
import { syncService } from "../services/sync.service.js";
import { premiumkuService } from "../services/premiumku.service.js";
import { orderService } from "../services/order.service.js";
import { adminAuthMiddleware, type AuthenticatedAdminRequest } from "../middleware/adminAuth.js";

const router = Router();

// Strict Security: All /api/admin/* routes require a verified Supabase Admin JWT
router.use(adminAuthMiddleware);

/**
 * GET /api/admin/stats
 * Mengambil ringkasan statistik toko untuk Dashboard Admin dan Analitik Penjualan
 * Mendukung filter bulanan (?month=YYYY-MM atau ?month=all) dengan kalkulasi profit bersih margin
 */
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const requestedMonth = typeof req.query.month === "string" ? req.query.month : undefined;

    // 1. Data Produk (untuk status stok & kalkulasi margin HPP)
    const allProducts = await db.select().from(products);
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const emptyStockProducts = allProducts.filter(p => p.stockStatus === "empty" || p.stockCount === 0).length;

    // Buat Map produk untuk lookup cepat O(1)
    const productMap = new Map<number, typeof products.$inferSelect>();
    for (const p of allProducts) {
      productMap.set(p.id, p);
    }

    // Helper fungsi hitung profit per item pesanan
    const calculateItemProfit = (item: { productId: number | null; price: number; quantity: number; subtotal: number }) => {
      const prod = item.productId ? productMap.get(item.productId) : null;
      let unitCost = 0;
      if (prod) {
        if (prod.providerPrice && prod.providerPrice > 0) {
          unitCost = prod.providerPrice;
        } else if (prod.marginValue && prod.marginValue > 0) {
          unitCost = Math.max(0, item.price - prod.marginValue);
        }
      }
      const qty = item.quantity || 1;
      const profit = item.subtotal - (unitCost * qty);
      return Math.max(0, profit);
    };

    // 2. Ambil Semua Pesanan beserta item-nya
    const allOrders = await db.query.orders.findMany({
      with: {
        items: true,
      },
    });

    const statusCounts: Record<string, number> = {
      waiting_payment: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    // Hitung bulan saat ini (Local server date)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0");
    const currentMonthKey = `${currentYear}-${currentMonthNum}`; // Format YYYY-MM

    const MONTH_NAMES_ID = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const formatMonthKeyLabel = (key: string) => {
      const parts = key.split("-");
      if (parts.length < 2) return key;
      const y = parts[0];
      const mIdx = parseInt(parts[1], 10) - 1;
      const mName = MONTH_NAMES_ID[mIdx] || parts[1];
      return `${mName} ${y}`;
    };

    // Tentukan bulan yang dipilih (default: bulan saat ini jika tidak ada filter)
    const selectedMonth = requestedMonth || currentMonthKey;

    // Koleksi bulan unik dari semua transaksi
    const monthKeysSet = new Set<string>();
    monthKeysSet.add(currentMonthKey); // Selalu sertakan bulan ini (sehingga tgl 1 reset ke 0 secara natural)

    let allTimeRevenue = 0;
    let allTimeProfit = 0;
    let allTimePaidOrdersCount = 0;

    let periodRevenue = 0;
    let periodProfit = 0;
    let periodPaidOrdersCount = 0;

    // Map untuk akumulasi Top Produk pada periode terpilih
    const periodProductSalesMap = new Map<string, {
      productId: number;
      productName: string;
      totalQuantity: number;
      totalSales: number;
      totalProfit: number;
    }>();

    for (const order of allOrders) {
      const st = order.status || "waiting_payment";
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      // Catat bulan transaksi (berdasarkan paidAt jika ada, fallback createdAt)
      const orderDate = order.paidAt ? new Date(order.paidAt) : new Date(order.createdAt);
      const oYear = orderDate.getFullYear();
      const oMonth = String(orderDate.getMonth() + 1).padStart(2, "0");
      const orderMonthKey = `${oYear}-${oMonth}`;
      monthKeysSet.add(orderMonthKey);

      // Hanya pesanan paid dan completed yang dihitung profit dan omzetnya
      const isPaidOrCompleted = st === "paid" || st === "completed";
      if (isPaidOrCompleted) {
        const orderAmount = order.totalAmount || 0;
        allTimeRevenue += orderAmount;
        allTimePaidOrdersCount += 1;

        let orderProfit = 0;
        if (order.items && order.items.length > 0) {
          for (const item of order.items) {
            orderProfit += calculateItemProfit(item);
          }
        }
        allTimeProfit += orderProfit;

        // Cek filter periode
        const matchesPeriod = selectedMonth === "all" || orderMonthKey === selectedMonth;
        if (matchesPeriod) {
          periodRevenue += orderAmount;
          periodProfit += orderProfit;
          periodPaidOrdersCount += 1;

          // Akumulasi data produk untuk periode yang dipilih
          if (order.items && order.items.length > 0) {
            for (const item of order.items) {
              const itemProfit = calculateItemProfit(item);
              const pKey = `${item.productId || 0}_${item.productName}`;
              const existing = periodProductSalesMap.get(pKey) || {
                productId: item.productId || 0,
                productName: item.productName,
                totalQuantity: 0,
                totalSales: 0,
                totalProfit: 0,
              };
              existing.totalQuantity += item.quantity || 1;
              existing.totalSales += item.subtotal || 0;
              existing.totalProfit += itemProfit;
              periodProductSalesMap.set(pKey, existing);
            }
          }
        }
      }
    }

    // Urutkan daftar bulan secara descending (terbaru di atas)
    const sortedMonthKeys = Array.from(monthKeysSet).sort((a, b) => b.localeCompare(a));
    const availableMonths = sortedMonthKeys.map((key) => ({
      key,
      label: formatMonthKeyLabel(key),
      isCurrent: key === currentMonthKey,
    }));

    // Top Selling Products periode terpilih (maks 10 produk)
    const topProducts = Array.from(periodProductSalesMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity || b.totalSales - a.totalSales)
      .slice(0, 10);

    // Rasio Margin Keuntungan
    const periodMarginPercentage = periodRevenue > 0 ? Math.round((periodProfit / periodRevenue) * 100) : 0;
    const allTimeMarginPercentage = allTimeRevenue > 0 ? Math.round((allTimeProfit / allTimeRevenue) * 100) : 0;

    const selectedMonthLabel = selectedMonth === "all" ? "Semua Waktu" : formatMonthKeyLabel(selectedMonth);

    // 3. Saldo Premiumku API
    let premkuSaldo = 0;
    try {
      const profileData = await premiumkuService.getProfile();
      if (profileData.success && profileData.data) {
        premkuSaldo = profileData.data.saldo;
      }
    } catch (_err) {
      premkuSaldo = 0;
    }

    // 4. 5 Pesanan Terakhir
    const recentOrders = await db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      limit: 5,
      with: {
        items: true,
        payments: true,
      },
    });

    res.json({
      success: true,
      data: {
        // Backwards compatibility untuk AdminDashboard:
        totalRevenue: allTimeRevenue,
        totalOrders: allOrders.length,
        statusCounts,
        activeProducts,
        totalProducts: allProducts.length,
        emptyStockProducts,
        premkuSaldo,
        recentOrders,
        topProducts,

        // Metrik Lengkap Profit & Analitik Penjualan:
        allTime: {
          revenue: allTimeRevenue,
          profit: allTimeProfit,
          orders: allTimePaidOrdersCount,
          marginPercentage: allTimeMarginPercentage,
        },
        selectedPeriod: {
          month: selectedMonth,
          monthLabel: selectedMonthLabel,
          revenue: periodRevenue,
          profit: periodProfit,
          orders: periodPaidOrdersCount,
          marginPercentage: periodMarginPercentage,
        },
        availableMonths,
      },
    });
  } catch (error: any) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil statistik dashboard",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/orders
 * Mengambil daftar semua pesanan pelanggan (dengan filter status & pencarian)
 */
router.get("/orders", async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;

    let allOrders = await db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    // Otomatis sinkronkan status asli dari Midtrans secara real-time untuk pesanan waiting_payment
    const waitingOrders = allOrders.filter(o => o.status === "waiting_payment");
    if (waitingOrders.length > 0) {
      let anyChanged = false;
      await Promise.allSettled(
        waitingOrders.map(async (o) => {
          try {
            const synced = await orderService.syncOrderStatusWithMidtrans(o.orderNumber, false);
            if (synced && synced.status !== o.status) {
              anyChanged = true;
            }
          } catch (err: any) {
            console.warn(`Gagal sync Midtrans untuk pesanan ${o.orderNumber}:`, err.message);
          }
        })
      );

      if (anyChanged) {
        allOrders = await db.query.orders.findMany({
          orderBy: [desc(orders.createdAt)],
          with: {
            items: true,
            payments: true,
            deliveries: true,
          },
        });
      }
    }

    // Filter di memori untuk fleksibilitas query Drizzle
    let filtered = allOrders;

    if (status && typeof status === "string" && status !== "all") {
      if (status === "expired" || status === "expire") {
        filtered = filtered.filter(o => 
          o.status === "failed" && 
          o.payments?.some(p => p.status === "expire" || (p.rawCallback as any)?.transaction_status === "expire")
        );
      } else {
        filtered = filtered.filter(o => o.status === status);
      }
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      const q = search.toLowerCase();
      filtered = filtered.filter(o => 
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
        (o.discordUserId && o.discordUserId.toLowerCase().includes(q)) ||
        o.items.some(it => it.productName.toLowerCase().includes(q))
      );
    }

    res.json({
      success: true,
      data: filtered,
    });
  } catch (error: any) {
    console.error("Error fetching admin orders:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar pesanan",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/orders/:id
 * Mengambil detail satu pesanan
 */
router.get("/orders/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "ID pesanan tidak valid" });
      return;
    }

    let order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
      return;
    }

    // Jika pesanan masih waiting_payment, sinkronkan real-time dengan Midtrans
    if (order.status === "waiting_payment") {
      try {
        const synced = await orderService.syncOrderStatusWithMidtrans(order.orderNumber, true);
        if (synced) order = synced;
      } catch (err: any) {
        console.warn(`Gagal sync Midtrans saat get order detail ${id}:`, err.message);
      }
    }

    // Auto-sync delivery accounts dari provider jika masih pending atau processing
    if (order && (order.status === "paid" || order.status === "processing" || order.status === "completed")) {
      try {
        await orderService.syncDeliveryAccountsIfPending(order);
        const fresh = await db.query.orders.findFirst({
          where: eq(orders.id, id),
          with: {
            items: true,
            payments: true,
            deliveries: true,
          },
        });
        if (fresh) order = fresh;
      } catch (err: any) {
        console.warn(`Gagal sync provider saat get order detail ${id}:`, err.message);
      }
    }

    res.json({
      success: true,
      data: order,
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

/**
 * POST /api/admin/orders/:id/sync-provider
 * Memicu sinkronisasi manual kredensial akun dari provider (Premku)
 */
router.post("/orders/:id/sync-provider", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "ID pesanan tidak valid" });
      return;
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true, payments: true, deliveries: true },
    });

    if (!order) {
      res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
      return;
    }

    await orderService.syncDeliveryAccountsIfPending(order);

    const freshOrder = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { items: true, payments: true, deliveries: true },
    });

    res.json({
      success: true,
      message: "Sinkronisasi dengan provider berhasil diperiksa",
      data: freshOrder || order,
    });
  } catch (error: any) {
    console.error("Error syncing provider:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menyinkronkan status dengan provider",
      error: error.message,
    });
  }
});

/**
 * PATCH /api/admin/orders/:id/status
 * Memperbarui status pesanan secara manual oleh admin
 */
router.patch("/orders/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (isNaN(id) || !status) {
      res.status(400).json({ success: false, message: "Parameter tidak lengkap" });
      return;
    }

    const validStatuses = ["waiting_payment", "paid", "processing", "completed", "failed"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ success: false, message: "Status tidak valid" });
      return;
    }

    const updates: Record<string, any> = { status };
    if (status === "paid") {
      updates.paidAt = new Date();
    } else if (status === "completed") {
      updates.completedAt = new Date();
    }

    const [updatedOrder] = await db
      .update(orders)
      .set(updates)
      .where(eq(orders.id, id))
      .returning();

    if (!updatedOrder) {
      res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
      return;
    }

    res.json({
      success: true,
      message: "Status pesanan berhasil diperbarui",
      data: updatedOrder,
    });
  } catch (error: any) {
    console.error("Error updating order status:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui status pesanan",
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/orders/:id/deliveries
 * Menambahkan atau memperbarui data pengiriman produk digital (akun/lisensi)
 */
router.post("/orders/:id/deliveries", async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.id, 10);
    const { productName, content, status } = req.body;

    if (isNaN(orderId) || !productName || !content) {
      res.status(400).json({ success: false, message: "Data produk digital tidak lengkap" });
      return;
    }

    const [newDelivery] = await db
      .insert(deliveries)
      .values({
        orderId,
        productName,
        content,
        status: status || "delivered",
        deliveredAt: new Date(),
      })
      .returning();

    // Otomatis ubah status pesanan menjadi completed jika belum
    await db
      .update(orders)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(orders.id, orderId));

    res.json({
      success: true,
      message: "Detail produk digital berhasil disimpan",
      data: newDelivery,
    });
  } catch (error: any) {
    console.error("Error creating delivery:", error);
    res.status(500).json({
      success: false,
      message: "Gagal menyimpan detail produk digital",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/products
 * Mengambil semua produk untuk dikelola (termasuk inactive, modal, margin flat)
 */
router.get("/products", async (_req: Request, res: Response) => {
  try {
    const allProducts = await db.query.products.findMany({
      with: {
        category: true,
      },
      orderBy: [desc(products.id)],
    });

    res.json({
      success: true,
      data: allProducts,
    });
  } catch (error: any) {
    console.error("Error fetching admin products:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil daftar produk admin",
      error: error.message,
    });
  }
});

/**
 * POST /api/admin/products/sync
 * Memicu sinkronisasi manual katalog produk dari provider Premiumku
 */
router.post("/products/sync", async (_req: Request, res: Response) => {
  try {
    const syncResult = await syncService.syncProductsFromProvider();
    res.json({
      success: true,
      message: "Sinkronisasi produk berhasil",
      data: syncResult,
    });
  } catch (error: any) {
    console.error("Error syncing products from admin route:", error);
    res.status(500).json({
      success: false,
      message: "Gagal melakukan sinkronisasi produk",
      error: error.message,
    });
  }
});

/**
 * PATCH /api/admin/products/:id/margin
 * Mengubah margin flat Rupiah (markup flat) untuk satu produk
 * harga_jual = provider_price + margin_value
 */
router.patch("/products/:id/margin", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { marginValue } = req.body;

    if (isNaN(id) || typeof marginValue !== "number" || marginValue < 0) {
      res.status(400).json({ success: false, message: "Nilai margin tidak valid" });
      return;
    }

    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) {
      res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
      return;
    }

    const basePrice = product.providerPrice ?? product.price;
    const newPrice = basePrice + marginValue;

    const [updatedProduct] = await db
      .update(products)
      .set({
        providerPrice: basePrice,
        marginValue: marginValue,
        price: newPrice,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    res.json({
      success: true,
      message: `Margin berhasil diubah ke Rp ${marginValue.toLocaleString("id-ID")}. Harga jual baru: Rp ${newPrice.toLocaleString("id-ID")}`,
      data: updatedProduct,
    });
  } catch (error: any) {
    console.error("Error updating product margin:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui margin produk",
      error: error.message,
    });
  }
});

/**
 * PATCH /api/admin/products/:id/status
 * Toggle status aktif/nonaktif produk
 */
router.patch("/products/:id/status", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isActive } = req.body;

    if (isNaN(id) || typeof isActive !== "boolean") {
      res.status(400).json({ success: false, message: "Parameter status tidak valid" });
      return;
    }

    const [updatedProduct] = await db
      .update(products)
      .set({
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    if (!updatedProduct) {
      res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
      return;
    }

    res.json({
      success: true,
      message: `Produk berhasil di${isActive ? "aktifkan" : "nonaktifkan"}`,
      data: updatedProduct,
    });
  } catch (error: any) {
    console.error("Error updating product status:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui status produk",
      error: error.message,
    });
  }
});

/**
 * PUT /api/admin/products/:id
 * Mengubah informasi produk lengkap
 */
router.put("/products/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, categoryId, marginValue, originalPrice } = req.body;

    if (isNaN(id)) {
      res.status(400).json({ success: false, message: "ID produk tidak valid" });
      return;
    }

    const [product] = await db.select().from(products).where(eq(products.id, id));
    if (!product) {
      res.status(404).json({ success: false, message: "Produk tidak ditemukan" });
      return;
    }

    const basePrice = product.providerPrice ?? product.price;
    const finalMargin = typeof marginValue === "number" ? marginValue : product.marginValue;
    const newPrice = basePrice + finalMargin;

    const [updated] = await db
      .update(products)
      .set({
        name: name || product.name,
        description: description !== undefined ? description : product.description,
        categoryId: categoryId !== undefined ? categoryId : product.categoryId,
        marginValue: finalMargin,
        price: newPrice,
        originalPrice: originalPrice !== undefined ? originalPrice : product.originalPrice,
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    res.json({
      success: true,
      message: "Informasi produk berhasil diperbarui",
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating product details:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memperbarui produk",
      error: error.message,
    });
  }
});

/**
 * GET /api/admin/profile
 * Mengambil profil administrator saat ini
 */
router.get("/profile", async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const adminUser = req.adminUser!;
    const [dbUser] = await db.select().from(users).where(eq(users.id, adminUser.id));

    res.json({
      success: true,
      data: {
        id: adminUser.id,
        email: dbUser?.email || adminUser.email,
        fullName: dbUser?.fullName || adminUser.fullName || "Administrator",
        role: "admin",
        createdAt: dbUser?.createdAt,
      },
    });
  } catch (err: any) {
    console.error("Error fetching admin profile:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/admin/profile
 * Memperbarui nama dan email administrator
 */
router.put("/profile", async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const adminUser = req.adminUser!;
    const { fullName, email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Email tidak boleh kosong." });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = (fullName || "").trim();

    // Cek jika email diganti apakah sudah dipakai user lain
    if (trimmedEmail !== adminUser.email.toLowerCase()) {
      const [existing] = await db.select().from(users).where(eq(users.email, trimmedEmail));
      if (existing && existing.id !== adminUser.id) {
        return res.status(400).json({
          success: false,
          message: "Email tersebut sudah digunakan oleh akun lain.",
        });
      }

      // Update email langsung di auth.users Supabase
      await db.execute(sql`
        UPDATE auth.users 
        SET email = ${trimmedEmail}, 
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            updated_at = now()
        WHERE id = ${adminUser.id}::uuid
      `);
    }

    // Update public.users di database aplikasi
    await db
      .update(users)
      .set({
        email: trimmedEmail,
        fullName: trimmedName,
      })
      .where(eq(users.id, adminUser.id));

    // Update raw_user_meta_data di auth.users
    await db.execute(sql`
      UPDATE auth.users 
      SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(${trimmedName}::text)),
          updated_at = now()
      WHERE id = ${adminUser.id}::uuid
    `);

    res.json({
      success: true,
      message: "Profil administrator berhasil diperbarui.",
      data: {
        id: adminUser.id,
        email: trimmedEmail,
        fullName: trimmedName,
        role: "admin",
      },
    });
  } catch (err: any) {
    console.error("Error updating admin profile:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Gagal memperbarui profil.",
    });
  }
});

/**
 * POST /api/admin/change-password
 * Mengubah kata sandi administrator dengan verifikasi kata sandi lama
 */
router.post("/change-password", async (req: AuthenticatedAdminRequest, res: Response) => {
  try {
    const adminUser = req.adminUser!;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Harap isi kata sandi saat ini dan kata sandi baru.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Kata sandi baru minimal 8 karakter.",
      });
    }

    // 1. Re-autentikasi password saat ini ke Supabase Auth
    const supabaseUrl = process.env.SUPABASE_URL || "https://eakaptprmmpabiufgtwc.supabase.co";
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

    const verifyLogin = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        email: adminUser.email,
        password: currentPassword,
      }),
    });

    if (!verifyLogin.ok) {
      return res.status(400).json({
        success: false,
        message: "Kata sandi saat ini salah. Verifikasi gagal.",
      });
    }

    const tokenData = (await verifyLogin.json()) as any;
    const accessToken = tokenData.access_token;

    // 2. Update kata sandi ke Supabase Auth API
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        password: newPassword,
      }),
    });

    if (!updateRes.ok) {
      const errJson = (await updateRes.json()) as any;
      return res.status(400).json({
        success: false,
        message: errJson.message || "Gagal memperbarui kata sandi.",
      });
    }

    res.json({
      success: true,
      message: "Kata sandi administrator berhasil diperbarui! Gunakan kata sandi baru untuk login selanjutnya.",
    });
  } catch (err: any) {
    console.error("Error changing admin password:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Gagal mengubah kata sandi.",
    });
  }
});

export default router;
