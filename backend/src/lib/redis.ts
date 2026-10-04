import { Redis } from "ioredis";
import "dotenv/config";

const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

// Koneksi singleton Redis untuk BullMQ & cache status antrean
export const redisConnection = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Wajib null untuk kompatibilitas BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    // Retry berjarak maksimal 3 detik agar tidak membebani log / CPU STB
    const delay = Math.min(times * 200, 3000);
    return delay;
  },
});

let isConnected = false;

redisConnection.on("connect", () => {
  isConnected = true;
  console.log(`🔌 [Redis] Berhasil terhubung ke Redis di ${REDIS_HOST}:${REDIS_PORT}`);
});

redisConnection.on("ready", () => {
  isConnected = true;
});

redisConnection.on("error", (err) => {
  isConnected = false;
  console.warn(`⚠️ [Redis] Peringatan koneksi Redis: ${err.message}`);
});

redisConnection.on("close", () => {
  isConnected = false;
});

/**
 * Cek apakah koneksi Redis sedang aktif
 */
export function isRedisConnected(): boolean {
  return isConnected && redisConnection.status === "ready";
}
