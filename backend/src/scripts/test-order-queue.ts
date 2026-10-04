import { enqueueCheckout, getTicketStatus } from "../queues/orderQueue.js";
import { startOrderQueueWorker, stopOrderQueueWorker } from "../workers/orderQueueWorker.js";
import { redisConnection } from "../lib/redis.js";
import { db } from "../db/index.js";
import { products } from "../db/schema.js";
import { eq } from "drizzle-orm";

async function runQueueTest() {
  console.log("🧪 Memulai Test Alur Antrean Order (BullMQ + Redis)...");

  // 1. Ambil 1 produk aktif dari database
  const product = await db.query.products.findFirst({
    where: eq(products.isActive, true),
  });

  if (!product) {
    console.error("❌ Tidak ada produk aktif di database untuk pengujian.");
    process.exit(1);
  }

  console.log(`📦 Menggunakan produk uji: #${product.id} - ${product.name} (Stok: ${product.stockCount})`);

  // 2. Nyalakan worker
  const worker = startOrderQueueWorker();

  // 3. Masukkan order ke queue (Fast Ingest)
  console.log("⏱️ Memasukkan pesanan ke antrean...");
  const t0 = Date.now();
  const queueResult = await enqueueCheckout({
    productId: product.id,
    quantity: 1,
    customerPhone: "081234567890",
    customerEmail: "queue-test@example.com",
  });
  const ingestTime = Date.now() - t0;

  console.log(`⚡ Waktu respon Ingest: ${ingestTime} ms (Super Cepat!)`);
  console.log(`🎫 Tiket Diterima:`, queueResult);

  // 4. Polling status antrean hingga selesai atau timeout (max 30 detik)
  console.log("🔄 Mulai polling status tiket antrean...");
  let isDone = false;
  let attempts = 0;

  while (!isDone && attempts < 15) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const status = await getTicketStatus(queueResult.ticketId);
    console.log(`   [Attempt ${attempts}] Status Tiket: ${status?.status} | Posisi: ${status?.position}`);

    if (status?.status === "completed") {
      console.log("🎉 SUKSES! Order berhasil diproses oleh Worker di latar belakang:");
      console.log("   Nomor Order:", status.result?.orderNumber);
      console.log("   Total Bayar:", status.result?.totalAmount);
      console.log("   QRIS URL   :", status.result?.payment.qrCodeUrl ? "Tersedia" : "Tidak ada");
      isDone = true;
    } else if (status?.status === "failed") {
      console.error("❌ Order Gagal Diproses:", status.errorMessage);
      isDone = true;
    }
  }

  // 5. Cleanup
  await stopOrderQueueWorker();
  await redisConnection.quit();
  console.log("🏁 Test Antrean Selesai!");
  process.exit(0);
}

runQueueTest().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
