import { db } from "../db/index.js";
import { products, orders, orderItems, payments } from "../db/schema.js";
import { orderService } from "../services/order.service.js";
import { eq } from "drizzle-orm";

async function run() {
  console.log("==================================================================");
  console.log("🧪 SIMULASI UJI COBA RACE CONDITION: 1 STOK DIBELI 2 PEMBELI");
  console.log("==================================================================");

  let testProduct: any = null;
  const createdOrderNumbers: string[] = [];

  try {
    // 1. Setup: Buat produk uji coba dengan stok tepat 1
    const [inserted] = await db
      .insert(products)
      .values({
        providerServiceId: `TEST-RACE-${Date.now()}`,
        name: "Akun Test Race Condition (Stok 1)",
        description: "Produk dummy untuk pengujian atomic reservation",
        price: 10000,
        providerPrice: 8000,
        stockCount: 1,
        stockStatus: "available",
        isActive: true,
      })
      .returning();

    testProduct = inserted;
    console.log(`\n📦 Produk dummy dibuat: ID=${testProduct.id}, Nama="${testProduct.name}", Stok Awal=${testProduct.stockCount}`);

    // 2. Simulasi Konkurensi: 2 pembeli checkout di milidetik yang sama persis
    console.log("\n⚡ Meluncurkan 2 request checkout secara simultan (Promise.allSettled)...");

    const [buyer1Promise, buyer2Promise] = [
      orderService.createOrderWithQris({
        productId: testProduct.id,
        quantity: 1,
        customerPhone: "081299991111",
        customerEmail: "pembeli1@test.com",
      }),
      orderService.createOrderWithQris({
        productId: testProduct.id,
        quantity: 1,
        customerPhone: "081299992222",
        customerEmail: "pembeli2@test.com",
      }),
    ];

    const results = await Promise.allSettled([buyer1Promise, buyer2Promise]);

    console.log("\n--- HASIL EKSEKUSI 2 PEMBELI ---");
    let successCount = 0;
    let failedCount = 0;

    results.forEach((res, idx) => {
      const buyerNum = idx + 1;
      if (res.status === "fulfilled") {
        successCount++;
        createdOrderNumbers.push(res.value.orderNumber);
        console.log(`✅ Pembeli ${buyerNum} SUKSES! Order: #${res.value.orderNumber}, Status: ${res.value.status}`);
      } else {
        failedCount++;
        console.log(`❌ Pembeli ${buyerNum} DITOLAK! Alasan: "${res.reason?.message}"`);
      }
    });

    // 3. Verifikasi Kondisi Database Pasca-Checkout
    const [productAfterCheckout] = await db
      .select()
      .from(products)
      .where(eq(products.id, testProduct.id));

    console.log("\n--- VALIDASI STOK SETELAH CHECKOUT ---");
    console.log(`Sisa Stok di Database : ${productAfterCheckout.stockCount}`);
    console.log(`Status Stok di Database: ${productAfterCheckout.stockStatus}`);

    if (successCount === 1 && failedCount === 1 && productAfterCheckout.stockCount === 0) {
      console.log("🎯 VALIDASI ATOMIK SUKSES: Tepat 1 pembeli berhasil, 1 pembeli ditolak, dan stok tidak over-selling!");
    } else {
      throw new Error(`❌ Race condition gagal dicegah! Sukses=${successCount}, Gagal=${failedCount}, SisaStok=${productAfterCheckout.stockCount}`);
    }

    // 4. Simulasi Auto-Restore: Pembeli pertama tidak membayar hingga batas QRIS kadaluarsa (Expired)
    const activeOrderNumber = createdOrderNumbers[0];
    console.log(`\n⏳ Simulasi QRIS kadaluarsa untuk pesanan #${activeOrderNumber}...`);

    await orderService.handlePaymentFailure(activeOrderNumber, "expire", {
      status_code: "407",
      transaction_status: "expire",
      status_message: "Waktu pembayaran QRIS habis",
    });

    const [productAfterRestore] = await db
      .select()
      .from(products)
      .where(eq(products.id, testProduct.id));

    console.log("\n--- VALIDASI AUTO-RESTORE SETELAH EXPIRE ---");
    console.log(`Stok Kembali Menjadi   : ${productAfterRestore.stockCount}`);
    console.log(`Status Stok Sekarang    : ${productAfterRestore.stockStatus}`);

    if (productAfterRestore.stockCount === 1 && productAfterRestore.stockStatus === "available") {
      console.log("🎉 VALIDASI AUTO-RESTORE SUKSES: Stok berhasil dikembalikan (+1) ke etalase toko!");
    } else {
      throw new Error(`❌ Gagal auto-restore stok! SisaStok=${productAfterRestore.stockCount}`);
    }

    console.log("\n==================================================================");
    console.log("✅ SELURUH PENGUJIAN SOLUSI 1 (ATOMIC RESERVATION + AUTO-RESTORE) LULUS!");
    console.log("==================================================================");
  } catch (err: any) {
    console.error("\n❌ Uji coba gagal:", err.message);
  } finally {
    // 5. Cleanup data dummy
    console.log("\n🧹 Membersihkan data dummy pengujian...");
    try {
      for (const ordNum of createdOrderNumbers) {
        const [ord] = await db.select().from(orders).where(eq(orders.orderNumber, ordNum));
        if (ord) {
          await db.delete(payments).where(eq(payments.orderId, ord.id));
          await db.delete(orderItems).where(eq(orderItems.orderId, ord.id));
          await db.delete(orders).where(eq(orders.id, ord.id));
        }
      }
      if (testProduct) {
        await db.delete(products).where(eq(products.id, testProduct.id));
      }
      console.log("✨ Cleanup selesai.");
    } catch (cleanupErr: any) {
      console.warn("⚠️ Cleanup gagal:", cleanupErr.message);
    }
    process.exit(0);
  }
}

run();
