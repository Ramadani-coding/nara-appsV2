import { Worker, type Job } from "bullmq";
import { redisConnection, isRedisConnected } from "../lib/redis.js";
import { orderService } from "../services/order.service.js";
import {
  updateTicketStatus,
  type CheckoutJobPayload,
  localQueueEvents,
  popNextLocalJob,
  setActiveLocalJobCount,
} from "../queues/orderQueue.js";

// Concurrency default 2: STB memproses maksimal 2 order serentak agar CPU & RAM tetap dingin
const WORKER_CONCURRENCY = Number(process.env.ORDER_WORKER_CONCURRENCY) || 2;

let bullWorker: Worker<CheckoutJobPayload> | null = null;
let isLocalWorkerActive = false;
let activeLocalWorkersCount = 0;

/**
 * Pemroses logika transaksi untuk satu job antrean (Atomic Lock + Midtrans QRIS charge)
 */
async function processOrderJob(ticketId: string, params: any) {
  console.log(`⚙️ [OrderWorker] Memulai proses tiket #${ticketId}...`);

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
}

/**
 * Loop pemroses antrean lokal (In-Memory Worker saat Redis/Docker offline)
 */
function drainLocalQueue() {
  if (!isLocalWorkerActive) return;

  while (activeLocalWorkersCount < WORKER_CONCURRENCY) {
    const job = popNextLocalJob();
    if (!job) break;

    activeLocalWorkersCount++;
    setActiveLocalJobCount(activeLocalWorkersCount);

    (async () => {
      try {
        await processOrderJob(job.ticketId, job.params);
      } catch {
        // Error sudah dicatat dan disimpan di tiket
      } finally {
        activeLocalWorkersCount--;
        setActiveLocalJobCount(activeLocalWorkersCount);
        drainLocalQueue();
      }
    })();
  }
}

/**
 * Menjalankan background worker pemroses antrean checkout
 */
export function startOrderQueueWorker() {
  if (isRedisConnected()) {
    if (bullWorker) {
      console.log("ℹ️ [OrderWorker] BullMQ Worker sudah aktif.");
      return bullWorker;
    }

    try {
      bullWorker = new Worker<CheckoutJobPayload>(
        "order-checkout-queue",
        async (job: Job<CheckoutJobPayload>) => {
          const { ticketId, params } = job.data;
          return await processOrderJob(ticketId, params);
        },
        {
          connection: redisConnection,
          concurrency: WORKER_CONCURRENCY,
        }
      );

      bullWorker.on("completed", (job) => {
        console.log(`🎉 [OrderWorker] Job #${job.id} selesai.`);
      });

      bullWorker.on("failed", (job, err) => {
        console.warn(`⚠️ [OrderWorker] Job #${job?.id} gagal: ${err.message}`);
      });

      bullWorker.on("error", (err) => {
        console.warn(`⚠️ [OrderWorker] Error pada worker antrean BullMQ:`, err.message);
      });

      console.log(`🚀 [OrderWorker] Background Worker Checkout aktif (Mode: Redis/BullMQ, Concurrency: ${WORKER_CONCURRENCY})`);
      return bullWorker;
    } catch (err: any) {
      console.warn("⚠️ [OrderWorker] Gagal menginisialisasi BullMQ Worker, beralih ke In-Memory Worker:", err.message);
    }
  }

  // Fallback ke In-Memory Worker (Tanpa Docker / Redis)
  if (!isLocalWorkerActive) {
    isLocalWorkerActive = true;
    localQueueEvents.on("job", drainLocalQueue);
    drainLocalQueue();
    console.log(`🚀 [OrderWorker] Background Worker Checkout aktif (Mode: In-Memory / Tanpa Docker, Concurrency: ${WORKER_CONCURRENCY})`);
  }

  return null;
}

/**
 * Menghentikan background worker secara graceful
 */
export async function stopOrderQueueWorker() {
  if (bullWorker) {
    console.log("🛑 [OrderWorker] Menghentikan worker checkout BullMQ...");
    try {
      await bullWorker.close();
    } catch {}
    bullWorker = null;
    console.log("✅ [OrderWorker] Worker checkout BullMQ berhasil dihentikan.");
  }

  if (isLocalWorkerActive) {
    console.log("🛑 [OrderWorker] Menghentikan worker checkout lokal...");
    isLocalWorkerActive = false;
    localQueueEvents.off("job", drainLocalQueue);
    console.log("✅ [OrderWorker] Worker checkout lokal berhasil dihentikan.");
  }
}
