import { app } from "./app.js";
import { startAutoSyncWorker, stopAutoSyncWorker } from "./workers/autoSyncWorker.js";
import { startOrderQueueWorker, stopOrderQueueWorker } from "./workers/orderQueueWorker.js";
import { redisConnection, initRedis, closeRedisConnection } from "./lib/redis.js";
import { gopayService } from "./services/gopay.service.js";
import "dotenv/config";

const DEFAULT_PORT = Number(process.env.PORT) || 5001;

function startServer(port: number) {
  const server = app.listen(port, async () => {
    console.log(`🚀 Nara Store Backend Server running on http://localhost:${port}`);
    console.log(`📡 Health check: http://localhost:${port}/api/health`);
    console.log(`🛒 Products API: http://localhost:${port}/api/products`);
    
    // Inisialisasi Redis (atau auto-fallback ke mode In-Memory jika Docker/Redis offline)
    await initRedis();

    // Aktifkan background sync worker
    startAutoSyncWorker();

    // Aktifkan background queue worker untuk antrean checkout order
    startOrderQueueWorker();

    // Background job: Auto-refresh token GoPay Merchant setiap 6 jam
    setInterval(async () => {
      try {
        const session = gopayService.loadSession();
        if (session && session.refresh_token && gopayService.isSessionExpired(session)) {
          console.log("🔄 [GoPay Periodic] Memperbarui sesi token GoPay...");
          await gopayService.refreshSession();
        }
      } catch (err: any) {
        console.warn("⚠️ [GoPay Periodic] Gagal auto refresh:", err.message);
      }
    }, 6 * 60 * 60 * 1000);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ Port ${port} sedang digunakan. Mencoba port alternatif ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error("❌ Server error:", err);
    }
  });

  // Graceful shutdown handling untuk Docker / container lifecycle
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Menerima ${signal}. Menghentikan server dengan graceful...`);
    stopAutoSyncWorker();
    await stopOrderQueueWorker();
    try {
      await closeRedisConnection();
    } catch {}

    server.close(() => {
      console.log("✅ Server HTTP berhasil dihentikan.");
      process.exit(0);
    });

    // Paksa shutdown jika proses tersendat lebih dari 10 detik
    setTimeout(() => {
      console.error("⚠️ Graceful shutdown timeout, memaksa keluar proses.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer(DEFAULT_PORT);
