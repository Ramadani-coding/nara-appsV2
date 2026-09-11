import { syncService } from "../services/sync.service.js";
import { sqlClient } from "../db/index.js";

async function main() {
  console.log("=================================================");
  console.log("🌱 Menjalankan Seeding Kategori & Sync Produk...");
  console.log("=================================================");

  try {
    const result = await syncService.syncProductsFromProvider();
    console.log("📊 Hasil Sinkronisasi:", result);
  } catch (err: any) {
    console.error("❌ Gagal seeding/sync:", err.message);
  } finally {
    await sqlClient.end();
    process.exit(0);
  }
}

main();
