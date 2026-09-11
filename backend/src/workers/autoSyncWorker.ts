import { syncService } from "../services/sync.service.js";

/**
 * Background Auto-Sync Worker
 * Menjaga seluruh katalog produk dan stok selalu tersinkronisasi otomatis dari API Premiumku
 * tanpa perlu admin menekan tombol sinkronisasi manual setiap saat.
 */

let isSyncing = false;
let syncIntervalId: NodeJS.Timeout | null = null;

// Interval default 5 menit (300.000 ms)
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

export async function runCatalogSync(): Promise<void> {
  if (isSyncing) {
    console.log("⏳ [AutoSyncWorker] Sinkronisasi sebelumnya masih berjalan, melewati siklus ini.");
    return;
  }

  isSyncing = true;
  const startTime = Date.now();

  try {
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

  // Jadwalkan periodic interval
  syncIntervalId = setInterval(() => {
    runCatalogSync().catch(() => {});
  }, intervalMs);
}

export function stopAutoSyncWorker(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log("🛑 [AutoSyncWorker] Worker dihentikan.");
  }
}
