import { Worker, type Job } from "bullmq";
import { redisConnection } from "../lib/redis.js";
import { orderService } from "../services/order.service.js";
import { 
  updateTicketStatus, 
  type CheckoutJobPayload 
} from "../queues/orderQueue.js";

// Concurrency default 2: STB memproses maksimal 2 order serentak agar CPU & RAM tetap dingin
const WORKER_CONCURRENCY = Number(process.env.ORDER_WORKER_CONCURRENCY) || 2;

let orderWorker: Worker<CheckoutJobPayload> | null = null;

/**
 * Menjalankan background worker pemroses antrean checkout
 */
export function startOrderQueueWorker() {
  if (orderWorker) {
    console.log("ℹ️ [OrderWorker] Worker sudah aktif.");
    return orderWorker;
  }

  orderWorker = new Worker<CheckoutJobPayload>(
    "order-checkout-queue",
    async (job: Job<CheckoutJobPayload>) => {
      const { ticketId, params } = job.data;
      console.log(`⚙️ [OrderWorker] Memulai proses tiket #${ticketId} (Job #${job.id})...`);

      // 1. Update status tiket ke "processing"
      await updateTicketStatus(ticketId, {
        status: "processing",
        position: 1,
        estimatedWaitSeconds: 2,
      });

      try {
        // 2. Jalankan logika transaksi lengkap (Database atomic lock + Midtrans QRIS charge)
        const orderResult = await orderService.createOrderWithQris(params);

        // 3. Update status tiket ke "completed" dan lampirkan hasil lengkap
        await updateTicketStatus(ticketId, {
          status: "completed",
          position: 0,
          estimatedWaitSeconds: 0,
          result: orderResult,
        });

        console.log(`✅ [OrderWorker] Tiket #${ticketId} SELESAI diproses! Nomor Order: #${orderResult.orderNumber}`);
        return orderResult;
      } catch (error: any) {
        console.error(`❌ [OrderWorker] Gagal memproses tiket #${ticketId}:`, error.message);

        // Update status tiket ke "failed"
        await updateTicketStatus(ticketId, {
          status: "failed",
          errorMessage: error.message || "Gagal memproses pesanan pada sistem antrean",
        });

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: WORKER_CONCURRENCY,
    }
  );

  orderWorker.on("completed", (job) => {
    console.log(`🎉 [OrderWorker] Job #${job.id} selesai.`);
  });

  orderWorker.on("failed", (job, err) => {
    console.warn(`⚠️ [OrderWorker] Job #${job?.id} gagal: ${err.message}`);
  });

  orderWorker.on("error", (err) => {
    console.warn(`⚠️ [OrderWorker] Error pada worker antrean:`, err.message);
  });

  console.log(`🚀 [OrderWorker] Background Worker Checkout aktif (Concurrency: ${WORKER_CONCURRENCY})`);
  return orderWorker;
}

/**
 * Menghentikan background worker secara graceful
 */
export async function stopOrderQueueWorker() {
  if (orderWorker) {
    console.log("🛑 [OrderWorker] Menghentikan worker checkout...");
    await orderWorker.close();
    orderWorker = null;
    console.log("✅ [OrderWorker] Worker checkout berhasil dihentikan.");
  }
}
