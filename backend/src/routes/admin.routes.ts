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
 * Mengambil ringkasan statistik toko untuk Dashboard Admin
 */
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    // 1. Total Pendapatan & Pesanan
    const allOrders = await db.select().from(orders);
    
    let totalRevenue = 0;
    const statusCounts: Record<string, number> = {
      waiting_payment: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    for (const order of allOrders) {
      const st = order.status || "waiting_payment";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
      if (st === "paid" || st === "completed") {
        totalRevenue += order.totalAmount || 0;
      }
    }

    // 2. Data Produk
    const allProducts = await db.select().from(products);
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const emptyStockProducts = allProducts.filter(p => p.stockStatus === "empty" || p.stockCount === 0).length;

    // 3. Saldo Premiumku API
    let premkuSaldo = 0;
    try {
      const profileData = await premiumkuService.getProfile();
      if (profileData.success && profileData.data) {
        premkuSaldo = profileData.data.saldo;
      }
    } catch (_err) {
      // Fallback jika API sedang throttled/offline
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

    // 5. Produk Terlaris (Top Selling)
    const topItems = await db
      .select({
        productId: orderItems.productId,
        productName: orderItems.productName,
        totalQuantity: sql<number>`cast(sum(${orderItems.quantity}) as integer)`,
        totalSales: sql<number>`cast(sum(${orderItems.subtotal}) as integer)`,
      })
      .from(orderItems)
      .groupBy(orderItems.productId, orderItems.productName)
      .orderBy(sql`sum(${orderItems.quantity}) desc`)
      .limit(5);

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalOrders: allOrders.length,
        statusCounts,
        activeProducts,
        totalProducts: allProducts.length,
        emptyStockProducts,
        premkuSaldo,
        recentOrders,
        topProducts: topItems,
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

    let query = db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    const allOrders = await query;

    // Filter di memori untuk fleksibilitas query Drizzle
    let filtered = allOrders;

    if (status && typeof status === "string" && status !== "all") {
      filtered = filtered.filter(o => o.status === status);
    }

    if (search && typeof search === "string" && search.trim() !== "") {
      const q = search.toLowerCase();
      filtered = filtered.filter(o => 
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
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

    // Auto-sync delivery accounts dari provider jika masih pending atau processing
    if (order.status === "paid" || order.status === "processing" || order.status === "completed") {
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
