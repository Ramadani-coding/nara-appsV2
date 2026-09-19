import { Router, type Request, type Response } from "express";
import { orderService } from "../services/order.service.js";
import { db } from "../db/index.js";
import { orders } from "../db/schema.js";
import { eq, desc, and, isNotNull } from "drizzle-orm";

const router = Router();

/**
 * POST /api/bot/orders
 * Membuat pesanan baru khusus untuk pembeli via Discord (guest checkout dengan discord_user_id)
 */
router.post("/orders", async (req: Request, res: Response) => {
  try {
    const { productId, discordUserId, quantity } = req.body;

    if (!productId) {
      res.status(400).json({
        success: false,
        message: "ID produk wajib disertakan",
      });
      return;
    }

    if (!discordUserId || !String(discordUserId).trim()) {
      res.status(400).json({
        success: false,
        message: "ID pengguna Discord (discordUserId) wajib disertakan",
      });
      return;
    }

    const orderResult = await orderService.createOrderWithQris({
      productId: Number(productId),
      quantity: Number(quantity) || 1,
      discordUserId: String(discordUserId).trim(),
    });

    res.status(201).json({
      success: true,
      message: "Pesanan berhasil dibuat, silakan lakukan pembayaran QRIS",
      data: orderResult,
    });
  } catch (error: any) {
    console.error("❌ Error creating bot order:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal membuat pesanan via bot",
    });
  }
});

/**
 * GET /api/bot/orders/user/:discordUserId
 * Mengambil seluruh riwayat pesanan milik pengguna Discord tertentu (terisolasi per discord_user_id)
 */
router.get("/orders/user/:discordUserId", async (req: Request, res: Response) => {
  try {
    const { discordUserId } = req.params;
    if (!discordUserId || !discordUserId.trim()) {
      res.status(400).json({
        success: false,
        message: "discordUserId wajib diisi",
      });
      return;
    }

    const userOrders = await db.query.orders.findMany({
      where: eq(orders.discordUserId, discordUserId.trim()),
      orderBy: [desc(orders.createdAt)],
      limit: 15,
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    res.json({
      success: true,
      data: userOrders,
    });
  } catch (error: any) {
    console.error("❌ Error fetching user orders for bot:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil riwayat pesanan",
    });
  }
});

/**
 * GET /api/bot/orders/:orderNumber
 * Mengambil detail status pesanan tunggal dan menyinkronkan status terkini dengan Midtrans
 */
router.get("/orders/:orderNumber", async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) {
      res.status(400).json({ success: false, message: "orderNumber tidak valid" });
      return;
    }

    // Selalu paksa sinkronisasi status ke Midtrans jika masih menunggu pembayaran
    const order = await orderService.syncOrderStatusWithMidtrans(orderNumber, true);

    if (!order) {
      res.status(404).json({
        success: false,
        message: "Pesanan tidak ditemukan",
      });
      return;
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error("❌ Error fetching order for bot:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil detail pesanan",
    });
  }
});

/**
 * GET /api/bot/deliveries/pending
 * Mengambil pesanan completed dengan discord_user_id yang DM-nya belum berhasil terkirim
 */
router.get("/deliveries/pending", async (_req: Request, res: Response) => {
  try {
    const pendingOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.status, "completed"),
        isNotNull(orders.discordUserId),
        eq(orders.discordDmSent, false)
      ),
      orderBy: [desc(orders.completedAt)],
      limit: 20,
      with: {
        items: true,
        deliveries: true,
      },
    });

    res.json({
      success: true,
      data: pendingOrders,
    });
  } catch (error: any) {
    console.error("❌ Error fetching pending bot deliveries:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil antrean pengiriman bot",
    });
  }
});

/**
 * POST /api/bot/deliveries/:orderId/mark-sent
 * Menandai bahwa produk digital pesanan telah berhasil dikirimkan via DM ke pembeli Discord
 */
router.post("/deliveries/:orderId/mark-sent", async (req: Request, res: Response) => {
  try {
    const orderId = parseInt(req.params.orderId, 10);
    if (isNaN(orderId)) {
      res.status(400).json({ success: false, message: "ID pesanan tidak valid" });
      return;
    }

    await db
      .update(orders)
      .set({ discordDmSent: true })
      .where(eq(orders.id, orderId));

    res.json({
      success: true,
      message: "Status pengiriman DM Discord berhasil diperbarui",
    });
  } catch (error: any) {
    console.error("❌ Error marking bot delivery sent:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui status pengiriman bot",
    });
  }
});

export default router;
