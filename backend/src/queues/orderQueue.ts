import { Queue } from "bullmq";
import { redisConnection, isRedisConnected } from "../lib/redis.js";
import type { CreateOrderParams } from "../services/order.service.js";

export type TicketStatus = "waiting" | "processing" | "completed" | "failed";

export interface OrderTicketData {
  ticketId: string;
  status: TicketStatus;
  position: number;
  estimatedWaitSeconds: number;
  orderData: {
    productId?: number;
    packageId?: string;
    productName?: string;
    price?: number;
    quantity: number;
    customerPhone: string;
    customerEmail?: string;
    discordUserId?: string;
  };
  result?: {
    orderId: number;
    orderNumber: string;
    totalAmount: number;
    accessToken?: string;
    refId?: string;
    status?: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    discordUserId?: string | null;
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    payment: {
      id?: number;
      transactionId?: string;
      paymentMethod: string;
      qrCodeUrl?: string | null;
      qrString?: string | null;
      expiryTime?: string | null;
      status: string;
    };
  };
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CheckoutJobPayload {
  ticketId: string;
  params: CreateOrderParams;
}

// Inisialisasi BullMQ Queue
export const checkoutQueue = new Queue<CheckoutJobPayload>("order-checkout-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2, // Coba ulang 1x jika ada network timeout ke payment gateway
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: 1000, // Bersihkan riwayat otomatis agar hemat RAM STB
    removeOnFail: 1000,
  },
});

const TICKET_TTL_SECONDS = 900; // 15 menit

/**
 * Menambahkan pesanan baru ke antrean sistem (Fast Ingest < 15ms)
 */
export async function enqueueCheckout(params: CreateOrderParams): Promise<{
  ticketId: string;
  position: number;
  estimatedWaitSeconds: number;
}> {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const ticketId = `TCK-${timestamp}-${random}`;

  // Hitung posisi saat ini di antrean
  let position = 1;
  try {
    const waitingCount = await checkoutQueue.getWaitingCount();
    const activeCount = await checkoutQueue.getActiveCount();
    position = waitingCount + activeCount + 1;
  } catch (err) {
    console.warn("⚠️ Gagal menghitung posisi antrean pasti, gunakan estimasi:", err);
  }

  // Estimasi waktu tunggu: rata-rata ~1.5 detik per transaksi dibagi concurrency worker
  const estimatedWaitSeconds = Math.max(2, Math.ceil(position * 1.5));

  const initialTicket: OrderTicketData = {
    ticketId,
    status: "waiting",
    position,
    estimatedWaitSeconds,
    orderData: {
      productId: params.productId,
      packageId: params.packageId,
      productName: params.productName,
      price: params.price,
      quantity: params.quantity,
      customerPhone: params.customerPhone || "",
      customerEmail: params.customerEmail,
      discordUserId: params.discordUserId,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Simpan status awal ke Redis
  await redisConnection.set(
    `ticket:${ticketId}`,
    JSON.stringify(initialTicket),
    "EX",
    TICKET_TTL_SECONDS
  );

  // Masukkan pekerjaan ke BullMQ
  await checkoutQueue.add("process-order", { ticketId, params }, { jobId: ticketId });

  console.log(`📥 [OrderQueue] Tiket #${ticketId} berhasil masuk antrean ke-${position} (Est. ${estimatedWaitSeconds}s)`);

  return {
    ticketId,
    position,
    estimatedWaitSeconds,
  };
}

/**
 * Memperbarui status tiket antrean di Redis
 */
export async function updateTicketStatus(
  ticketId: string,
  update: Partial<OrderTicketData>
): Promise<OrderTicketData | null> {
  const current = await getTicketStatus(ticketId);
  if (!current) return null;

  const merged: OrderTicketData = {
    ...current,
    ...update,
    updatedAt: Date.now(),
  };

  await redisConnection.set(
    `ticket:${ticketId}`,
    JSON.stringify(merged),
    "EX",
    TICKET_TTL_SECONDS
  );

  return merged;
}

/**
 * Mengambil status tiket antrean dari Redis
 */
export async function getTicketStatus(ticketId: string): Promise<OrderTicketData | null> {
  const raw = await redisConnection.get(`ticket:${ticketId}`);
  if (!raw) return null;

  try {
    const data: OrderTicketData = JSON.parse(raw);

    // Jika masih waiting, hitung ulang posisi antrean yang tersisa
    if (data.status === "waiting") {
      try {
        const job = await checkoutQueue.getJob(ticketId);
        if (job) {
          const state = await job.getState();
          if (state === "active") {
            data.status = "processing";
            data.position = 1;
            data.estimatedWaitSeconds = 2;
          } else {
            // Hitung berapa job yang mendahului
            const waitingCount = await checkoutQueue.getWaitingCount();
            data.position = Math.max(1, Math.min(data.position, waitingCount + 1));
            data.estimatedWaitSeconds = Math.max(2, Math.ceil(data.position * 1.5));
          }
        }
      } catch {}
    }

    return data;
  } catch (err) {
    console.error("Gagal parse data tiket dari Redis:", err);
    return null;
  }
}
