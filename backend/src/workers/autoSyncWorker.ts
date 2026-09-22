import { syncService } from "../services/sync.service.js";
import { orderService } from "../services/order.service.js";

/**
 * Background Auto-Sync & Reservation Sweeper Worker
 * 1. Menjaga seluruh katalog produk dan stok selalu tersinkronisasi otomatis dari API Premiumku.
 * 2. Memeriksa dan membatalkan pesanan expired/stale secara berkala agar stok yang di-reserve
 *    segera kembali ke etalase toko jika pembeli tidak membayar QRIS.
 */

let isSyncing = false;
let syncIntervalId: NodeJS.Timeout | null = null;
let sweeperIntervalId: NodeJS.Timeout | null = null;

// Interval default sweeper pesanan kadaluarsa: 2 menit
const SWEEPER_INTERVAL_MS = 2 * 60 * 1000;

export async function runCatalogSync(): Promise<void> {
  if (isSyncing) {
    console.log("⏳ [AutoSyncWorker] Sinkronisasi sebelumnya masih berjalan, melewati siklus ini.");
    return;
  }

  isSyncing = true;
  const startTime = Date.now();

  try {
    // Jalankan pembersihan pesanan kadaluarsa sebelum sinkronisasi agar stok akurat
    await orderService.expireStaleWaitingOrders().catch((err) => {
      console.warn("⚠️ [AutoSyncWorker] Gagal membersihkan pesanan stale:", err.message);
    });

    console.log(`[AutoSyncWorker] 🔄 [${new Date().toLocaleTimeString("id-ID")}] Memulai sinkronisasi stok otomatis dari Premiumku...`);
    const result = await syncService.syncProductsFromProvider();
    const durationMs = Date.now() - startTime;
    console.log(
      `[AutoSyncWorker] ✅ Sinkronisasi sukses dalam ${durationMs}ms: ${result.updated} produk diperbarui, ${result.inserted} produk baru.`
    );
  } catch (err: any) {
    console.warn(`[AutoSyncWorker] ⚠️ Gagal sinkronisasi otomatis: ${err.message}. Server tetap menggunakan stok lokal.`);
  } finally {
    isSyncing = false;
  }
}

export function startAutoSyncWorker(): void {
  const intervalMinutes = Number(process.env.PREMKU_SYNC_INTERVAL_MINUTES) || 5;
  const intervalMs = Math.max(2, intervalMinutes) * 60 * 1000;

  console.log(`⏱️ [AutoSyncWorker] Dikonfigurasi untuk sinkronisasi otomatis setiap ${intervalMinutes} menit.`);

  // Jalankan initial sync setelah 8 detik server aktif
  setTimeout(() => {
    runCatalogSync().catch(() => {});
  }, 8000);

  // Jadwalkan periodic catalog sync
  syncIntervalId = setInterval(() => {
    runCatalogSync().catch(() => {});
  }, intervalMs);

  // Jadwalkan periodic stale order sweeper (setiap 2 menit)
  sweeperIntervalId = setInterval(() => {
    orderService.expireStaleWaitingOrders().catch((err) => {
      console.warn("⚠️ [Sweeper] Gagal expire pesanan stale:", err.message);
    });
  }, SWEEPER_INTERVAL_MS);
}

export function stopAutoSyncWorker(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  if (sweeperIntervalId) {
    clearInterval(sweeperIntervalId);
    sweeperIntervalId = null;
  }
  console.log("🛑 [AutoSyncWorker] Worker dihentikan.");
}

