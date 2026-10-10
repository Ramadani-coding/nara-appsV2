import { Router } from "express";
import productRoutes from "./product.routes.js";
import categoryRoutes from "./category.routes.js";
import premkuRoutes from "./premku.routes.js";
import adminRoutes from "./admin.routes.js";
import orderRoutes from "./order.routes.js";
import paymentRoutes from "./payment.routes.js";
import botRoutes from "./bot.routes.js";
import webhookRoutes from "./webhook.routes.js";
import { publicVoucherRouter, adminVoucherRouter } from "./voucher.routes.js";

const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "Nara Digital Store API",
  });
});

apiRouter.use("/products", productRoutes);
apiRouter.use("/categories", categoryRoutes);
apiRouter.use("/premku", premkuRoutes);
apiRouter.use("/admin", adminRoutes);
apiRouter.use("/admin/vouchers", adminVoucherRouter);
apiRouter.use("/vouchers", publicVoucherRouter);
apiRouter.use("/orders", orderRoutes);
apiRouter.use("/payments", paymentRoutes);
apiRouter.use("/bot", botRoutes);
apiRouter.use("/webhook", webhookRoutes);

export default apiRouter;
