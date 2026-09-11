import { app } from "./app.js";
import { startAutoSyncWorker, stopAutoSyncWorker } from "./workers/autoSyncWorker.js";
import "dotenv/config";

const DEFAULT_PORT = Number(process.env.PORT) || 5001;

function startServer(port: number) {
  const server = app.listen(port, () => {
    console.log(`🚀 Nara Store Backend Server running on http://localhost:${port}`);
    console.log(`📡 Health check: http://localhost:${port}/api/health`);
    console.log(`🛒 Products API: http://localhost:${port}/api/products`);
    
    // Aktifkan background sync worker
    startAutoSyncWorker();
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
  const shutdown = (signal: string) => {
    console.log(`\n🛑 Menerima ${signal}. Menghentikan server dengan graceful...`);
    stopAutoSyncWorker();
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
