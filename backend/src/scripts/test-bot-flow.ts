import "dotenv/config";
import { db } from "../db/index.js";
import { orders, products } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { orderService } from "../services/order.service.js";

async function main() {
  console.log("🧪 Memulai testing integrasi Fase 5 Bot Discord...");

  // 1. Ambil 1 produk aktif dari database
  const testProduct = await db.query.products.findFirst({
    where: eq(products.isActive, true),
  });

  if (!testProduct) {
    console.error("❌ Tidak ada produk aktif di database untuk pengujian.");
    process.exit(1);
  }

  console.log(`✅ Produk ditemukan: ${testProduct.name} (ID: ${testProduct.id}, Harga: ${testProduct.price})`);

  // 2. Buat pesanan via bot (guest checkout dengan discordUserId)
  const testDiscordId = "test_discord_user_999";
  console.log(`\n📦 Membuat pesanan uji untuk Discord User ID: ${testDiscordId}...`);

  const orderResult = await orderService.createOrderWithQris({
    productId: testProduct.id,
    quantity: 1,
    discordUserId: testDiscordId,
  });

  console.log(`✅ Pesanan berhasil dibuat:`, {
    orderId: orderResult.orderId,
    orderNumber: orderResult.orderNumber,
    totalAmount: orderResult.totalAmount,
    status: orderResult.status,
    discordUserId: orderResult.discordUserId,
    paymentMethod: orderResult.payment.paymentMethod,
    hasQrCodeUrl: !!orderResult.payment.qrCodeUrl,
    hasQrString: !!orderResult.payment.qrString,
  });

  if (orderResult.discordUserId !== testDiscordId) {
    throw new Error(`❌ discordUserId tidak cocok: ${orderResult.discordUserId} !== ${testDiscordId}`);
  }

  // 3. Verifikasi query riwayat pesanan berdasarkan discordUserId
  console.log(`\n🔍 Memverifikasi riwayat pesanan terisolasi per user...`);
  const userOrders = await db.query.orders.findMany({
    where: eq(orders.discordUserId, testDiscordId),
    with: {
      items: true,
      payments: true,
      deliveries: true,
    },
  });

  console.log(`✅ Ditemukan ${userOrders.length} pesanan milik user ${testDiscordId}`);
  const createdOrder = userOrders.find((o) => o.id === orderResult.orderId);
  if (!createdOrder) {
    throw new Error("❌ Pesanan baru tidak ditemukan pada query userOrders!");
  }
  console.log(`✅ Pesanan cocok: OrderNumber #${createdOrder.orderNumber}, Status: ${createdOrder.status}`);

  // 4. Bersihkan data pesanan uji
  console.log(`\n🧹 Membersihkan pesanan uji ID: ${orderResult.orderId}...`);
  await db.delete(orders).where(eq(orders.id, orderResult.orderId));
  console.log(`✅ Data pesanan uji berhasil dibersihkan.`);

  console.log("\n🎉 SEMUA PENGUJIAN FASE 5 BERHASIL 100%!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
