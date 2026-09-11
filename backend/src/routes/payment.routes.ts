import { Router, type Request, type Response } from "express";
import { midtransService } from "../services/midtrans.service.js";
import { orderService, parseMidtransExpiry } from "../services/order.service.js";

const router = Router();

/**
 * POST /api/payments/notification
 * Webhook resmi penerima notifikasi HTTP dari Midtrans
 */
async function handleMidtransNotification(req: Request, res: Response) {
  try {
    const notification = req.body;
    console.log("📩 Menerima notifikasi webhook dari Midtrans:", JSON.stringify(notification));

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = notification;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      res.status(400).json({
        success: false,
        message: "Payload notifikasi tidak lengkap",
      });
      return;
    }

    // 1. Verifikasi Keaslian Signature Key
    const isValidSignature = midtransService.verifySignature(
      order_id,
      status_code,
      gross_amount,
      signature_key
    );

    if (!isValidSignature) {
      console.warn(`🚨 Signature key tidak valid untuk order_id: ${order_id}`);
      res.status(401).json({
        success: false,
        message: "Signature key tidak valid",
      });
      return;
    }

    // 2. Evaluasi Status Transaksi
    if (
      transaction_status === "settlement" ||
      (transaction_status === "capture" && fraud_status === "accept")
    ) {
      // Pembayaran QRIS Berhasil (Lunas)
      await orderService.handlePaymentSettlement(order_id, notification);
    } else if (transaction_status === "cancel" || transaction_status === "expire") {
      // Pembayaran Dibatalkan / Kadaluarsa
      await orderService.handlePaymentFailure(order_id, transaction_status, notification);
    } else if (transaction_status === "deny") {
      // Pembayaran Ditolak
      await orderService.handlePaymentFailure(order_id, "deny", notification);
    } else if (transaction_status === "pending") {
      console.log(`⏳ Transaksi ${order_id} masih menunggu pembayaran.`);
    }

    res.status(200).json({
      success: true,
      message: "Notifikasi berhasil diproses",
    });
  } catch (error: any) {
    console.error("❌ Error memproses webhook Midtrans:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal saat memproses notifikasi",
      error: error.message,
    });
  }
}

// Pasang handler pada endpoint notification dan webhook (alias)
router.post("/notification", handleMidtransNotification);
router.post("/webhook", handleMidtransNotification);

/**
 * GET /api/payments/:orderNumber/status
 * Cek status transaksi pembayaran QRIS secara real-time
 * (Digunakan oleh frontend polling halaman pembayaran)
 */
router.get("/:orderNumber/status", async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    if (!orderNumber) {
      res.status(400).json({ success: false, message: "Nomor order wajib disertakan" });
      return;
    }

    const isForce = req.query.force === "true" || req.query.fresh === "true";
    const order = await orderService.syncOrderStatusWithMidtrans(orderNumber, isForce);

    if (!order) {
      res.status(404).json({ success: false, message: "Pesanan tidak ditemukan" });
      return;
    }

    const latestPayment = order.payments && order.payments.length > 0
      ? order.payments[order.payments.length - 1]
      : null;

    res.json({
      success: true,
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        completedAt: order.completedAt,
        payment: latestPayment
          ? {
              id: latestPayment.id,
              transactionId: latestPayment.transactionId,
              paymentMethod: latestPayment.paymentMethod,
              qrCodeUrl: latestPayment.qrCodeUrl,
              status: latestPayment.status,
              settledAt: latestPayment.settledAt,
              expiryTime: (latestPayment as any).expiryTime || parseMidtransExpiry(latestPayment.rawCallback),
            }
          : null,
        items: order.items,
        deliveries: order.deliveries,
      },
    });
  } catch (error: any) {
    console.error("Error checking payment status:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memeriksa status pembayaran",
      error: error.message,
    });
  }
});

/**
 * POST /api/payments/:orderNumber/simulate-pay
 * Simulasi instan pelunasan transaksi (khusus mode sandbox / testing)
 */
router.post("/:orderNumber/simulate-pay", async (req: Request, res: Response) => {
  try {
    // Keamanan Mutlak: Cegah eksploitasi di lingkungan production
    if (process.env.NODE_ENV === "production" || process.env.MIDTRANS_IS_PRODUCTION === "true") {
      res.status(403).json({
        success: false,
        message: "Akses ditolak: Simulasi pembayaran dinonaktifkan permanen pada mode produksi.",
      });
      return;
    }

    const { orderNumber } = req.params;
    console.log(`[SIMULASI DEV] Memproses pelunasan pesanan ${orderNumber}...`);

    const result = await orderService.handlePaymentSettlement(orderNumber, {
      simulated: true,
      transaction_status: "settlement",
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: "Simulasi pembayaran lunas berhasil diproses (Mode Sandbox)",
      data: result.order,
    });
  } catch (error: any) {
    console.error("Error simulating payment:", error);
    res.status(500).json({
      success: false,
      message: "Gagal memproses simulasi pembayaran",
      error: error.message,
    });
  }
});

export default router;
