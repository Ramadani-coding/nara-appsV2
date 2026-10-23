import { sqlClient } from "../db/index.js";

async function deleteSpecificOrders() {
  const targetOrders = [
    "ORD-1093412407",
    "ORD-0271565880",
    "ORD-4529595024",
  ];

  console.log("=================================================");
  console.log("🔍 Memeriksa pesanan target:", targetOrders);
  console.log("=================================================");

  try {
    // 1. Cari pesanan yang ada di database
    const foundOrders = await sqlClient`
      SELECT id, order_number, total_amount, status, created_at 
      FROM orders 
      WHERE order_number IN ${sqlClient(targetOrders)}
    `;

    console.log(`Ditemukan ${foundOrders.length} dari ${targetOrders.length} pesanan:`);
    for (const o of foundOrders) {
      console.log(`- #${o.order_number}: Rp ${o.total_amount?.toLocaleString("id-ID")} [Status: ${o.status}]`);
    }

    if (foundOrders.length === 0) {
      console.log("ℹ️ Tidak ada pesanan dengan nomor tersebut yang ditemukan di database.");
      await sqlClient.end();
      process.exit(0);
    }

    const orderIds = foundOrders.map((o) => o.id);

    // 2. Hapus data berelasi jika belum otomatis cascade
    console.log("\n🗑️ Menghapus data pembayaran, deliveries, items, dan pesanan...");

    await sqlClient`DELETE FROM deliveries WHERE order_id IN ${sqlClient(orderIds)}`;
    await sqlClient`DELETE FROM payments WHERE order_id IN ${sqlClient(orderIds)}`;
    await sqlClient`DELETE FROM order_items WHERE order_id IN ${sqlClient(orderIds)}`;
    const deletedOrders = await sqlClient`
      DELETE FROM orders 
      WHERE id IN ${sqlClient(orderIds)}
      RETURNING id, order_number
    `;

    console.log("\n=================================================");
    console.log(`✅ Berhasil menghapus ${deletedOrders.length} transaksi dari database:`);
    for (const d of deletedOrders) {
      console.log(`   ✓ ${d.order_number}`);
    }
    console.log("=================================================");

    await sqlClient.end();
    process.exit(0);
  } catch (error: any) {
    console.error("❌ Gagal menghapus pesanan:", error.message);
    try {
      await sqlClient.end();
    } catch {}
    process.exit(1);
  }
}

deleteSpecificOrders();
