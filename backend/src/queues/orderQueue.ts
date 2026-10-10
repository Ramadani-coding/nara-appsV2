import { Queue } from "bullmq";
import { EventEmitter } from "events";
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
    voucherId?: number;
    voucherCode?: string;
  };
  result?: {
    orderId: number;
    orderNumber: string;
    totalAmount: number;
    subtotalAmount?: number;
    discountAmount?: number;
    voucherCode?: string | null;
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

const TICKET_TTL_SECONDS = 900; // 15 menit

// ==========================================
// IN-MEMORY LOCAL QUEUE & TICKET STORE (FALLBACK)
// ==========================================
const inMemoryTickets = new Map<string, OrderTicketData>();
const inMemoryJobQueue: CheckoutJobPayload[] = [];
let activeLocalJobCount = 0;

export const localQueueEvents = new EventEmitter();

// Bersihkan tiket memori kadaluarsa setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [id, ticket] of inMemoryTickets.entries()) {
    if (now - ticket.createdAt > TICKET_TTL_SECONDS * 1000) {
      inMemoryTickets.delete(id);
    }
  }
}, 5 * 60 * 1000).unref();

export function popNextLocalJob(): CheckoutJobPayload | undefined {
  return inMemoryJobQueue.shift();
}

export function setActiveLocalJobCount(count: number): void {
  activeLocalJobCount = count;
}

export function getLocalQueueWaitingCount(): number {
  return inMemoryJobQueue.length;
}

export function getLocalQueueActiveCount(): number {
  return activeLocalJobCount;
}

// ==========================================
// BULLMQ QUEUE (REDIS MODE)
// ==========================================
let bullQueue: Queue<CheckoutJobPayload> | null = null;

function getBullQueue(): Queue<CheckoutJobPayload> | null {
  if (isRedisConnected()) {
    if (!bullQueue) {
      bullQueue = new Queue<CheckoutJobPayload>("order-checkout-queue", {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: 1000,
          removeOnFail: 1000,
        },
      });
      bullQueue.on("error", (err) => {
        console.warn("⚠️ [BullQueue] Peringatan antrean:", err.message);
      });
    }
    return bullQueue;
  }
  return null;
}

/**
 * Interface adaptif Checkout Queue (Bekerja otomatis di Redis Mode atau In-Memory Mode)
 */
export const checkoutQueue = {
  async getWaitingCount(): Promise<number> {
    const q = getBullQueue();
    if (q) {
      try {
        return await q.getWaitingCount();
      } catch {}
    }
    return inMemoryJobQueue.length;
  },

  async getActiveCount(): Promise<number> {
    const q = getBullQueue();
    if (q) {
      try {
        return await q.getActiveCount();
      } catch {}
    }
    return activeLocalJobCount;
  },

  async add(name: string, data: CheckoutJobPayload, opts?: any): Promise<any> {
    const q = getBullQueue();
    if (q) {
      return await q.add(name, data, opts);
    }
    inMemoryJobQueue.push(data);
    localQueueEvents.emit("job");
    return { id: data.ticketId };
  },

  async getJob(ticketId: string): Promise<any> {
    const q = getBullQueue();
    if (q) {
      try {
        return await q.getJob(ticketId);
      } catch {}
    }
    const ticket = inMemoryTickets.get(ticketId);
    if (!ticket) return null;
    return {
      id: ticketId,
      getState: async () => (ticket.status === "processing" ? "active" : ticket.status),
    };
  },
};

/**
 * Cek apakah sistem antrean checkout aktif (selalu true: Redis atau Local In-Memory)
 */
export function isQueueActive(): boolean {
  return true;
}

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

  let position = 1;
  try {
    const waitingCount = await checkoutQueue.getWaitingCount();
    const activeCount = await checkoutQueue.getActiveCount();
    position = waitingCount + activeCount + 1;
  } catch (err) {
    console.warn("⚠️ Gagal menghitung posisi antrean pasti, gunakan estimasi:", err);
  }

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

  if (isRedisConnected()) {
    try {
      await redisConnection.set(
        `ticket:${ticketId}`,
        JSON.stringify(initialTicket),
        "EX",
        TICKET_TTL_SECONDS
      );
      const q = getBullQueue();
      if (q) {
        await q.add("process-order", { ticketId, params }, { jobId: ticketId });
      }
    } catch (err: any) {
      console.warn("⚠️ Gagal menyimpan ke Redis, fallback ke penyimpanan lokal:", err.message);
      inMemoryTickets.set(ticketId, initialTicket);
      inMemoryJobQueue.push({ ticketId, params });
      localQueueEvents.emit("job");
    }
  } else {
    // Mode Lokal In-Memory (Dev tanpa Docker / Redis)
    inMemoryTickets.set(ticketId, initialTicket);
    inMemoryJobQueue.push({ ticketId, params });
    localQueueEvents.emit("job");
  }

  const mode = isRedisConnected() ? "Redis/BullMQ" : "In-Memory/Lokal";
  console.log(`📥 [OrderQueue] Tiket #${ticketId} berhasil masuk antrean ke-${position} (${mode}, Est. ${estimatedWaitSeconds}s)`);

  return {
    ticketId,
    position,
    estimatedWaitSeconds,
  };
}

/**
 * Memperbarui status tiket antrean di Redis atau Memory
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

  // Selalu perbarui di in-memory cache untuk fallback cepat
  inMemoryTickets.set(ticketId, merged);

  if (isRedisConnected()) {
    try {
      await redisConnection.set(
        `ticket:${ticketId}`,
        JSON.stringify(merged),
        "EX",
        TICKET_TTL_SECONDS
      );
    } catch (err: any) {
      console.warn("⚠️ Gagal update tiket ke Redis:", err.message);
    }
  }

  return merged;
}

/**
 * Mengambil status tiket antrean dari Redis atau Memory
 */
export async function getTicketStatus(ticketId: string): Promise<OrderTicketData | null> {
  let data: OrderTicketData | null = null;

  if (isRedisConnected()) {
    try {
      const raw = await redisConnection.get(`ticket:${ticketId}`);
      if (raw) {
        data = JSON.parse(raw);
      }
    } catch (err: any) {
      console.warn("⚠️ Gagal membaca tiket dari Redis, memeriksa memori lokal:", err.message);
    }
  }

  if (!data) {
    data = inMemoryTickets.get(ticketId) || null;
  }

  if (!data) return null;

  // Jika masih waiting, hitung ulang posisi antrean yang tersisa
  if (data.status === "waiting") {
    try {
      const waitingCount = await checkoutQueue.getWaitingCount();
      const activeCount = await checkoutQueue.getActiveCount();
      data.position = Math.max(1, Math.min(data.position, waitingCount + activeCount));
      data.estimatedWaitSeconds = Math.max(2, Math.ceil(data.position * 1.5));
    } catch {}
  }

  return data;
}
