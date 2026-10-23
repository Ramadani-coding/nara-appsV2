import { Router } from "express";
import productRoutes from "./product.routes.js";
import categoryRoutes from "./category.routes.js";
import premkuRoutes, { premkuWebhookHandler } from "./premku.routes.js";
import adminRoutes from "./admin.routes.js";
import orderRoutes from "./order.routes.js";
import paymentRoutes from "./payment.routes.js";
import botRoutes from "./bot.routes.js";
import webhookRoutes from "./webhook.routes.js";
import { publicVoucherRouter, adminVoucherRouter } from "./voucher.routes.js";
import { gopayService } from "../services/gopay.service.js";

const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  const gopayReady = gopayService.isAvailable();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Nara Digital Store API",
    gateways: {
      activePrimary: gopayReady ? "gopay" : "midtrans (gopay offline/unconfigured)",
      gopay: {
        isAvailable: gopayReady,
        hasStaticQr: Boolean(gopayService.getStaticQrString()),
        hasSession: Boolean(gopayService.loadSession()?.access_token),
        sessionFilePath: gopayService.getSessionFilePath(),
      },
      midtrans: {
        isConfigured: Boolean(process.env.MIDTRANS_SERVER_KEY),
        isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
      },
    },
  });
});

apiRouter.use("/products", productRoutes);
apiRouter.use("/categories", categoryRoutes);
apiRouter.use("/premku", premkuRoutes);
// Alias endpoint agar URL https://domain.com/api/webhook-premku sesuai screenshot dashboard Premku langsung berfungsi
apiRouter.post("/webhook-premku", premkuWebhookHandler);
apiRouter.get("/webhook-premku", (_req, res) => {
  res.json({
    success: true,
    status: "ready",
    service: "Premku Webhook Endpoint",
    message: "Webhook endpoint aktif dan siap menerima request HTTP POST dari Premku.",
  });
});
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/admin/vouchers", adminVoucherRouter);
apiRouter.use("/vouchers", publicVoucherRouter);
apiRouter.use("/orders", orderRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/bot", botRoutes);
apiRouter.use("/webhook", webhookRoutes);

export default apiRouter;
