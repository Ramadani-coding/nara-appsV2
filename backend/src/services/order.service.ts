import crypto from "node:crypto";
import { db } from "../db/index.js";
import { orders, orderItems, payments, deliveries, products } from "../db/schema.js";
import { eq, desc, sql } from "drizzle-orm";
import { midtransService } from "./midtrans.service.js";
import { premiumkuService } from "./premiumku.service.js";
import { 
  sendWhatsAppMessage, 
  sendOrderSuccessNotification 
} from "./whatsapp.service.js";

const ORDER_SECRET_SALT = process.env.ORDER_SECRET_SALT || "nara-order-security-salt-2026-xyz";

// In-memory throttle untuk membatasi frekuensi query langsung ke Midtrans API per order (Anti-DDoS / Rate Limit)
const midtransCheckThrottle = new Map<string, number>();
const MIDTRANS_THROTTLE_MS = 12 * 1000; // Minimal selang 12 detik kecuali forceSync

/**
 * Menormalkan nomor telepon (menghilangkan spasi, tanda minus, mengubah 62 / +62 menjadi 08)
 */
export function normalizePhone(phone?: string | null): string {
  if (!phone) return "";
  let p = phone.replace(/[^0-9]/g, "");
  if (p.startsWith("62")) {
    p = "0" + p.slice(2);
  }
  return p;
}

/**
 * Sensor nomor telepon pelanggan untuk tampilan publik: 081351842385 -> 0813-****-2385
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone) return "-";
  const clean = phone.trim();
  if (clean.length < 7) return clean.slice(0, 2) + "****" + clean.slice(-2);
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `${start}-****-${end}`;
}

/**
 * Sensor alamat email pelanggan untuk tampilan publik: rama@gmail.com -> r***@gmail.com
 */
export function maskEmail(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

/**
 * Menghasilkan token kriptografis HMAC unik untuk pesanan
 */
export function generateOrderToken(orderNumber: string, customerPhone: string): string {
  const normPhone = normalizePhone(customerPhone);
  return crypto
    .createHmac("sha256", ORDER_SECRET_SALT)
    .update(`${orderNumber}:${normPhone}`)
    .digest("hex");
}

/**
 * Memvalidasi apakah token kriptografis cocok untuk pesanan
 */
export function verifyOrderToken(orderNumber: string, customerPhone: string, token?: string | null): boolean {
  if (!token || typeof token !== "string") return false;
  const expected = generateOrderToken(orderNumber, customerPhone);
  try {
    return (
      crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(token.padEnd(expected.length, "0").slice(0, expected.length))
      ) && expected === token
    );
  } catch {
    return false;
  }
}

export interface CreateOrderParams {
  productId?: number;
  packageId?: string;
  productName?: string;
  price?: number;
  quantity: number;
  customerPhone?: string;
  customerEmail?: string;
  discordUserId?: string;
}

export function parseMidtransExpiry(rawCallback: any): string | null {
  if (!rawCallback) return null;
  let raw = rawCallback;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {}
  }
  const expiry = raw?.expiry_time || raw?.expiryTime;
  if (!expiry || typeof expiry !== "string") return null;
  try {
    if (expiry.includes("T")) {
      const date = new Date(expiry);
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    const isoString = expiry.trim().replace(" ", "T") + "+07:00";
    const date = new Date(isoString);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {}
  return null;
}

export class OrderService {
  /**
   * Mengirim notifikasi webhook ke bot Discord jika configured
   */
  private async notifyDiscordBotIfConfigured(orderId: number, orderNumber: string, discordUserId?: string | null) {
    if (!discordUserId) return;
    const webhookUrl = process.env.DISCORD_BOT_WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "order_completed",
          orderId,
          orderNumber,
          discordUserId,
        }),
      });
      console.log(`🤖 Notifikasi webhook terkirim ke Discord bot untuk pesanan #${orderNumber}`);
    } catch (err: any) {
      console.warn(`⚠️ Gagal mengirim webhook ke bot Discord:`, err.message);
    }
  }

  /**
   * Membuat pesanan baru dan menghasilkan transaksi QRIS melalui Midtrans Core API
   */
  async createOrderWithQris(params: CreateOrderParams) {
    const resolvedPhone = params.customerPhone?.trim() || (params.discordUserId ? `discord:${params.discordUserId.trim()}` : "");
    if (!resolvedPhone) {
      throw new Error("Nomor WhatsApp/telepon atau identitas Discord pelanggan wajib diisi");
    }

    const qty = Math.min(100, Math.max(1, params.quantity || 1));

    // 1. Wajib cari produk terdaftar di database lokal
    let dbProduct: any = null;
    if (params.productId && !isNaN(Number(params.productId))) {
      dbProduct = await db.query.products.findFirst({
        where: eq(products.id, Number(params.productId)),
      });
    }

    // Jika belum ketemu dan ada packageId/providerId, coba cari berdasarkan providerServiceId
    if (!dbProduct && params.packageId) {
      dbProduct = await db.query.products.findFirst({
        where: eq(products.providerServiceId, String(params.packageId)),
      });
    }

    if (!dbProduct) {
      throw new Error("Produk tidak ditemukan atau tidak tersedia dalam katalog toko.");
    }

    if (!dbProduct.isActive) {
      throw new Error("Produk ini sedang dinonaktifkan oleh administrator.");
    }

    if (dbProduct.stockStatus === "empty" || (typeof dbProduct.stockCount === "number" && dbProduct.stockCount < qty)) {
      throw new Error("Stok produk tidak mencukupi untuk jumlah yang Anda minta.");
    }

    // Keamanan Finansial: Nama & Harga Jual WAJIB 100% dari database lokal toko! Tolak harga dari klien!
    const productName = dbProduct.name;
    const unitPrice = dbProduct.price;

    if (typeof unitPrice !== "number" || unitPrice <= 0) {
      throw new Error("Harga produk pada sistem database tidak valid.");
    }

    const totalAmount = unitPrice * qty;

    // 2. Generate Nomor Order dan Ref ID yang unik
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}${randomSuffix}`;
    const refId = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // 3. Simpan Pesanan ke database (status: waiting_payment)
    const [newOrder] = await db
      .insert(orders)
      .values({
        orderNumber,
        refId,
        customerPhone: resolvedPhone,
        customerEmail: params.customerEmail?.trim() || null,
        discordUserId: params.discordUserId?.trim() || null,
        status: "waiting_payment",
        totalAmount,
      })
      .returning();

    // 4. Simpan Item Pesanan
    await db.insert(orderItems).values({
      orderId: newOrder.id,
      productId: dbProduct?.id || null,
      productName,
      price: unitPrice,
      quantity: qty,
      subtotal: totalAmount,
    });

    // 5. Buat transaksi QRIS di Midtrans Core API
    let qrisCharge: any = null;
    try {
      qrisCharge = await midtransService.createQrisCharge({
        orderNumber: newOrder.orderNumber,
        grossAmount: totalAmount,
        customerPhone: newOrder.customerPhone || "081200000000",
        customerEmail: newOrder.customerEmail || undefined,
        items: [
          {
            id: String(dbProduct?.id || "ITEM-1"),
            name: productName,
            price: unitPrice,
            quantity: qty,
          },
        ],
      });
    } catch (midtransErr: any) {
      console.error("❌ Gagal membuat charge QRIS di Midtrans:", midtransErr.message);
      // Update order status ke failed jika charge gagal dibuat
      await db
        .update(orders)
        .set({ status: "failed" })
        .where(eq(orders.id, newOrder.id));
      throw new Error(`Gagal membuat pembayaran QRIS: ${midtransErr.message}`);
    }

    // 6. Simpan transaksi pembayaran ke tabel `payments`
    const [paymentRecord] = await db
      .insert(payments)
      .values({
        orderId: newOrder.id,
        transactionId: qrisCharge.transactionId,
        paymentMethod: "qris",
        qrCodeUrl: qrisCharge.qrCodeUrl,
        status: "pending",
        rawCallback: qrisCharge.raw,
      })
      .returning();

    const accessToken = generateOrderToken(newOrder.orderNumber, newOrder.customerPhone || "");

    return {
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      accessToken,
      refId: newOrder.refId,
      totalAmount: newOrder.totalAmount,
      status: newOrder.status,
      customerPhone: newOrder.customerPhone,
      customerEmail: newOrder.customerEmail,
      discordUserId: newOrder.discordUserId,
      productName,
      quantity: qty,
      unitPrice,
      payment: {
        id: paymentRecord.id,
        transactionId: qrisCharge.transactionId,
        paymentMethod: "qris",
        qrCodeUrl: qrisCharge.qrCodeUrl,
        qrString: qrisCharge.qrString,
        expiryTime: parseMidtransExpiry(qrisCharge.raw) || qrisCharge.expiryTime,
        status: "pending",
      },
    };
  }

  /**
   * Menangani pembayaran sukses (settlement) secara idempotent
   * dan otomatis memicu Create Order ke penyedia Premiumku
   */
  async handlePaymentSettlement(orderNumber: string, midtransPayload?: any) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    if (!order) {
      throw new Error(`Pesanan dengan nomor ${orderNumber} tidak ditemukan`);
    }

    // Idempotency check: jika pesanan sudah dibayar atau selesai, jangan proses ulang
    if (order.status === "paid" || order.status === "processing" || order.status === "completed") {
      console.log(`ℹ️ Pesanan ${orderNumber} sudah berstatus '${order.status}'. Mengabaikan duplikasi webhook.`);
      return { success: true, order, alreadyProcessed: true };
    }

    const now = new Date();

    // 1. Update status pembayaran di tabel `payments`
    await db
      .update(payments)
      .set({
        status: "settlement",
        settledAt: now,
        rawCallback: midtransPayload || sql`raw_callback`,
      })
      .where(eq(payments.orderId, order.id));

    // 2. Update status pesanan di tabel `orders` menjadi `paid`
    await db
      .update(orders)
      .set({
        status: "paid",
        paidAt: now,
      })
      .where(eq(orders.id, order.id));

    console.log(`✅ Pembayaran pesanan ${orderNumber} berhasil dikonfirmasi (LUNAS).`);

    const clientUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    // 3. Proses otomatis (Auto-Order) ke Premiumku
    try {
      const firstItem = order.items[0];
      let providerServiceId: string | null = null;

      if (firstItem?.productId) {
        const prod = await db.query.products.findFirst({
          where: eq(products.id, firstItem.productId),
        });
        providerServiceId = prod?.providerServiceId || null;
      }

      if (providerServiceId && !isNaN(Number(providerServiceId))) {
        // Tandai pesanan sedang diproses ke supplier
        await db
          .update(orders)
          .set({ status: "processing" })
          .where(eq(orders.id, order.id));

        console.log(`🚀 Mengirim pesanan otomatis ke Premiumku: serviceId=${providerServiceId}, qty=${firstItem.quantity}, refId=${order.refId}`);

        const premkuRes = await premiumkuService.createOrder({
          productId: Number(providerServiceId),
          qty: firstItem.quantity,
          refId: order.refId,
        });

        console.log(`📦 Respon dari Premiumku:`, premkuRes);

        if (premkuRes.success) {
          let deliveryContent = "";
          let premkuAccounts: any[] = [];

          // Ambil detail akun riil langsung dari API Premiumku menggunakan nomor invoice
          if (premkuRes.invoice) {
            console.log(`🔍 Mengambil kredensial akun dari Premku untuk invoice ${premkuRes.invoice}...`);
            for (let attempt = 1; attempt <= 4; attempt++) {
              try {
                const statusRes = await premiumkuService.checkOrderStatus(premkuRes.invoice);
                if (statusRes.success && Array.isArray(statusRes.accounts) && statusRes.accounts.length > 0) {
                  premkuAccounts = statusRes.accounts;
                  console.log(`✅ Berhasil mengambil ${premkuAccounts.length} akun dari Premku!`);
                  break;
                }
              } catch (err: any) {
                console.warn(`Attempt ${attempt} check status failed:`, err.message);
              }
              if (attempt < 4) {
                await new Promise((r) => setTimeout(r, 1200));
              }
            }
          }

          if (premkuAccounts.length > 0) {
            deliveryContent = JSON.stringify({
              invoice: premkuRes.invoice,
              accounts: premkuAccounts,
            });

            await db.insert(deliveries).values({
              orderId: order.id,
              productName: firstItem.productName,
              content: deliveryContent,
              status: "delivered",
              deliveredAt: now,
            });

            await db
              .update(orders)
              .set({
                status: "completed",
                completedAt: new Date(),
              })
              .where(eq(orders.id, order.id));

            // Notifikasi bot Discord jika pemesanan via Discord
            this.notifyDiscordBotIfConfigured(order.id, orderNumber, order.discordUserId);

            console.log(`🎉 Pesanan ${orderNumber} berhasil diproses dan dikirimkan ke pelanggan (${premkuAccounts.length} akun).`);

            // Kirim 1 pesan WhatsApp resmi & lengkap bahwa pembayaran sukses & akun digital siap jika ada nomor WA
            if (order.customerPhone && !order.customerPhone.startsWith("discord:")) {
              sendOrderSuccessNotification(
                order.customerPhone,
                orderNumber,
                firstItem.productName,
                order.totalAmount,
                clientUrl
              ).catch((err) => console.warn(`⚠️ Gagal kirim WA order success #${orderNumber}:`, err.message));
            }
          } else {
            // Supplier masih memproses antrean pembuatan akun
            // Simpan record delivery dengan status "processing" agar UI pelanggan menampilkan status tunggu dan auto-poll
            deliveryContent = JSON.stringify({
              invoice: premkuRes.invoice,
              status: "processing",
              message: "Akun sedang diproses secara instan oleh sistem supplier",
              accounts: [],
            });

            await db.insert(deliveries).values({
              orderId: order.id,
              productName: firstItem.productName,
              content: deliveryContent,
              status: "processing",
              deliveredAt: now,
            });

            await db
              .update(orders)
              .set({
                status: "processing",
              })
              .where(eq(orders.id, order.id));

            console.log(`⏳ Kredensial akun untuk pesanan ${orderNumber} masih dipersiapkan supplier (Invoice: ${premkuRes.invoice}). Auto-sync akan mengambilnya saat siap.`);
          }
        } else {
          console.warn(`⚠️ API Premiumku mengembalikan status belum sukses: ${premkuRes.message}. Pesanan tetap berstatus 'processing' untuk penanganan admin.`);
        }
      } else {
        // Fallback: Jika produk tidak terikat ke providerId tertentu, buat delivery manual / instant placeholder
        const deliveryContent = `Produk: ${firstItem?.productName || "Produk Digital"}\nStatus: Siap Diakses\nSilakan hubungi WhatsApp admin dengan menyertakan Nomor Pesanan ${order.orderNumber}.`;
        await db.insert(deliveries).values({
          orderId: order.id,
          productName: firstItem?.productName || "Produk Digital",
          content: deliveryContent,
          status: "delivered",
          deliveredAt: now,
        });

        await db
          .update(orders)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(orders.id, order.id));

        this.notifyDiscordBotIfConfigured(order.id, order.orderNumber, order.discordUserId);

        // Kirim 1 pesan WhatsApp resmi & lengkap bahwa pesanan siap jika ada nomor WA
        if (order.customerPhone && !order.customerPhone.startsWith("discord:")) {
          sendOrderSuccessNotification(
            order.customerPhone,
            order.orderNumber,
            firstItem?.productName || "Produk Digital",
            order.totalAmount,
            clientUrl
          ).catch((err) => console.warn(`⚠️ Gagal kirim WA fallback success #${order.orderNumber}:`, err.message));
        }
      }
    } catch (autoOrderErr: any) {
      console.error(`❌ Gagal melakukan auto-order ke Premiumku untuk ${orderNumber}:`, autoOrderErr.message);
      // Pesanan tetap berstatus `paid` sehingga admin dapat menindaklanjuti secara manual
    }

    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, order.id),
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    return { success: true, order: updatedOrder };
  }

  /**
   * Menangani transaksi gagal / kadaluarsa dari Midtrans
   */
  async handlePaymentFailure(orderNumber: string, failureStatus: string, midtransPayload?: any) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
    });

    if (!order) return { success: false, message: "Pesanan tidak ditemukan" };

    // Jangan batalkan jika pesanan sudah lunas sebelumnya
    if (order.status === "paid" || order.status === "completed") {
      return { success: false, message: "Pesanan sudah lunas, tidak dapat diubah ke failed" };
    }

    await db
      .update(payments)
      .set({
        status: failureStatus,
        rawCallback: midtransPayload || sql`raw_callback`,
      })
      .where(eq(payments.orderId, order.id));

    await db
      .update(orders)
      .set({ status: "failed" })
      .where(eq(orders.id, order.id));

    return { success: true, message: `Pesanan ${orderNumber} diperbarui menjadi failed` };
  }

  /**
   * Sinkronisasi status pesanan dengan Midtrans Core API secara real-time
   * (Digunakan saat polling di frontend dengan rate throttle pintar untuk mencegah pemblokiran IP oleh Midtrans)
   */
  async syncOrderStatusWithMidtrans(orderNumber: string, forceSync = false) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    if (!order) return null;

    // Jika pesanan masih berstatus waiting_payment
    if (order.status === "waiting_payment") {
      const now = Date.now();
      const lastCheck = midtransCheckThrottle.get(orderNumber) || 0;
      const shouldCheckMidtrans = forceSync || (now - lastCheck >= MIDTRANS_THROTTLE_MS);

      if (shouldCheckMidtrans) {
        midtransCheckThrottle.set(orderNumber, now);
        try {
          const midtransStatus = await midtransService.getTransactionStatus(orderNumber);
          const txStatus = midtransStatus.transactionStatus;
          const fraudStatus = midtransStatus.fraudStatus;

          if (txStatus === "settlement" || (txStatus === "capture" && fraudStatus === "accept")) {
            // Eksekusi pemrosesan pembayaran dan pesanan
            const res = await this.handlePaymentSettlement(orderNumber, midtransStatus.raw);
            return this.attachExpiryToOrder(res.order);
          } else if (txStatus === "expire" || txStatus === "cancel" || txStatus === "deny") {
            await this.handlePaymentFailure(orderNumber, txStatus, midtransStatus.raw);
            const updated = await db.query.orders.findFirst({
              where: eq(orders.id, order.id),
              with: { items: true, payments: true, deliveries: true },
            });
            return this.attachExpiryToOrder(updated);
          }
        } catch (err: any) {
          console.warn(`⚠️ Pengecekan Midtrans status untuk ${orderNumber} tertunda:`, err.message);
        }
      }

      // Cek apakah batas waktu QRIS (expiry_time) sudah kadaluarsa secara riil
      const latestPayment = order.payments && order.payments.length > 0 ? order.payments[order.payments.length - 1] : null;
      const expiryIso = parseMidtransExpiry(latestPayment?.rawCallback);
      if (expiryIso && new Date(expiryIso).getTime() < Date.now()) {
        await this.handlePaymentFailure(orderNumber, "expire", {
          status_code: "407",
          transaction_status: "expire",
          status_message: "Batas waktu pembayaran QRIS telah habis (Expired)",
          expiry_time: expiryIso,
        });
        const updated = await db.query.orders.findFirst({
          where: eq(orders.id, order.id),
          with: { items: true, payments: true, deliveries: true },
        });
        return this.attachExpiryToOrder(updated);
      }
    }

    // Jika pesanan sudah lunas, diproses, atau completed, pastikan data akun Premku sudah terisi
    if (order.status === "paid" || order.status === "completed" || order.status === "processing") {
      await this.syncDeliveryAccountsIfPending(order);
    }

    return this.attachExpiryToOrder(order);
  }

  attachExpiryToOrder(order: any) {
    if (order && Array.isArray(order.payments)) {
      for (const p of order.payments) {
        p.expiryTime = parseMidtransExpiry(p.rawCallback);
      }
    }
    return order;
  }

  /**
   * Memastikan kredensial akun dari invoice Premku sudah tersimpan di deliveries
   */
  async syncDeliveryAccountsIfPending(order: any) {
    if (!order || !order.deliveries || order.deliveries.length === 0) return order;

    for (const del of order.deliveries) {
      let hasAccounts = false;
      let invoice: string | null = null;
      try {
        const parsed = JSON.parse(del.content);
        if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
          hasAccounts = true;
        }
        if (parsed && parsed.invoice) {
          invoice = parsed.invoice;
        }
      } catch {}

      if (!hasAccounts) {
        // Ambil invoice ID jika belum dapat dari json
        if (!invoice) {
          const match = del.content.match(/API-[0-9a-zA-Z-]+/);
          if (match) {
            invoice = match[0];
          }
        }

        if (invoice) {
          try {
            console.log(`🔍 Sinkronisasi akun tertunda dari Premku untuk invoice ${invoice}...`);
            const statusRes = await premiumkuService.checkOrderStatus(invoice);
            if (statusRes.success && Array.isArray(statusRes.accounts) && statusRes.accounts.length > 0) {
              const newContent = JSON.stringify({
                invoice,
                accounts: statusRes.accounts,
              });

              await db
                .update(deliveries)
                .set({ 
                  content: newContent,
                  status: "delivered"
                })
                .where(eq(deliveries.id, del.id));

              del.content = newContent;
              del.status = "delivered";

              // Jika order sebelumnya masih processing atau paid, tandai completed
              await db
                .update(orders)
                .set({
                  status: "completed",
                  completedAt: new Date(),
                })
                .where(eq(orders.id, order.id));

              order.status = "completed";
              this.notifyDiscordBotIfConfigured(order.id, order.orderNumber, order.discordUserId);

              console.log(`✅ Akun Premku berhasil disinkronkan ke delivery pesanan #${order.orderNumber}! (${statusRes.accounts.length} akun)`);

              // Kirim notifikasi WhatsApp bahwa akun digital siap diakses jika ada nomor WA
              const clientUrl = process.env.FRONTEND_URL || "http://localhost:5173";
              if (order.customerPhone && !order.customerPhone.startsWith("discord:")) {
                sendOrderSuccessNotification(
                  order.customerPhone,
                  order.orderNumber,
                  del.productName || "Produk Digital",
                  order.totalAmount || 0,
                  clientUrl
                ).catch((err) => console.warn(`⚠️ Gagal kirim WA sync success #${order.orderNumber}:`, err.message));
              }
            }
          } catch (err: any) {
            console.warn(`Sync delivery accounts failed for invoice ${invoice}:`, err.message);
          }
        }
      }
    }
    return order;
  }

  /**
   * Helper untuk menyusun teks pengiriman produk digital dari respon Premiumku
   */
  private formatDeliveryText(premkuRes: any, productName: string): string {
    if (premkuRes.invoice) {
      return `Detail Akun / Layanan: ${productName}\nNomor Invoice Provider: ${premkuRes.invoice}\nPesanan Anda telah berhasil diproses oleh sistem.`;
    }
    if (premkuRes.message) {
      return `Detail Layanan: ${productName}\nInformasi: ${premkuRes.message}`;
    }
    return `Detail Layanan: ${productName}\nAkses akun telah diaktifkan secara otomatis.`;
  }
}

export const orderService = new OrderService();
