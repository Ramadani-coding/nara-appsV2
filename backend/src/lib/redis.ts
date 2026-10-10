import { Redis } from "ioredis";
import "dotenv/config";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_ENABLED_ENV = process.env.REDIS_ENABLED;

let isConnected = false;
let initAttempted = false;

// Koneksi singleton Redis untuk BullMQ & cache status antrean.
// Menggunakan lazyConnect & enableOfflineQueue: false agar tidak membuka socket otomatis sebelum siap.
export const redisConnection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  lazyConnect: true,
  maxRetriesPerRequest: null, // Wajib null untuk kompatibilitas BullMQ
  enableReadyCheck: false,
  enableOfflineQueue: false,
  retryStrategy(times) {
    // Jangan lakukan infinite retry saat Redis offline di development agar tidak spam error log
    if (times > 2) return null;
    return 1000;
  },
});

// Tangani event error agar tidak menghasilkan unhandled error event di Node.js
redisConnection.on("error", (err) => {
  isConnected = false;
  if (REDIS_ENABLED_ENV === "true" && isConnected) {
    console.warn(`⚠️ [Redis] Peringatan koneksi Redis: ${err.message}`);
  }
});

redisConnection.on("connect", () => {
  isConnected = true;
});

redisConnection.on("ready", () => {
  isConnected = true;
});

redisConnection.on("close", () => {
  isConnected = false;
});

/**
 * Inisialisasi koneksi Redis dengan safe probe.
 * Jika Redis tidak aktif (Docker mati / tidak ada Redis lokal), sistem otomatis
 * beralih ke mode In-Memory fallback tanpa melempar error ECONNREFUSED.
 */
export async function initRedis(): Promise<boolean> {
  if (initAttempted) {
    return isConnected;
  }
  initAttempted = true;

  // Jika eksplisit dinonaktifkan via environment variable
  if (REDIS_ENABLED_ENV === "false") {
    console.log("ℹ️ [Redis] REDIS_ENABLED=false: Antrean checkout menggunakan mode Lokal (In-Memory Fallback).");
    return false;
  }

  try {
    // Probe koneksi ke Redis dengan batas waktu cepat (1.2 detik)
    const connectPromise = redisConnection.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Redis connection probe timeout")), 1200)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    isConnected = true;
    console.log(`🔌 [Redis] Berhasil terhubung ke Redis di ${REDIS_HOST}:${REDIS_PORT}`);
    return true;
  } catch (err: any) {
    isConnected = false;
    try {
      redisConnection.disconnect(false);
    } catch {}

    console.log(`ℹ️ [Redis] Server Redis tidak terdeteksi di ${REDIS_HOST}:${REDIS_PORT} (Docker/Redis offline).`);
    console.log(`💡 [Redis] Antrean checkout otomatis beralih ke mode Lokal (In-Memory Worker) tanpa Docker.`);
    return false;
  }
}

/**
 * Cek apakah koneksi Redis sedang aktif
 */
export function isRedisConnected(): boolean {
  return isConnected && redisConnection.status === "ready";
}

/**
 * Tutup koneksi Redis secara aman
 */
export async function closeRedisConnection(): Promise<void> {
  if (isConnected) {
    try {
      await redisConnection.quit();
    } catch {
      try {
        redisConnection.disconnect(false);
      } catch {}
    }
  }
  isConnected = false;
}
