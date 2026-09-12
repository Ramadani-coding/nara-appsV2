import { sqlClient } from "../db/index.js";

async function clearTransactions() {
  console.log("=================================================");
  console.log("🧹 Memulai pembersihan data transaksi database...");
  console.log("=================================================");

  try {
    // 1. Cek jumlah data sebelum dihapus
    const [ordersCount] = await sqlClient`SELECT count(*)::int as count FROM orders`;
    const [itemsCount] = await sqlClient`SELECT count(*)::int as count FROM order_items`;
    const [paymentsCount] = await sqlClient`SELECT count(*)::int as count FROM payments`;
    const [deliveriesCount] = await sqlClient`SELECT count(*)::int as count FROM deliveries`;

    console.log("Data saat ini:");
    console.log(`- Pesanan (orders)       : ${ordersCount.count}`);
    console.log(`- Item Pesanan (items)   : ${itemsCount.count}`);
    console.log(`- Pembayaran (payments)  : ${paymentsCount.count}`);
    console.log(`- Pengiriman (deliveries): ${deliveriesCount.count}`);

    // 2. Hapus data dengan TRUNCATE CASCADE dan reset auto-increment ID
    console.log("\nMenghapus semua data transaksi...");
    await sqlClient`TRUNCATE TABLE deliveries, payments, order_items, orders RESTART IDENTITY CASCADE`;

    // 3. Verifikasi jumlah data setelah dihapus
    const [afterOrders] = await sqlClient`SELECT count(*)::int as count FROM orders`;
    const [afterItems] = await sqlClient`SELECT count(*)::int as count FROM order_items`;
    const [afterPayments] = await sqlClient`SELECT count(*)::int as count FROM payments`;
    const [afterDeliveries] = await sqlClient`SELECT count(*)::int as count FROM deliveries`;

    // Pastikan produk dan kategori tetap aman
    const [prodCount] = await sqlClient`SELECT count(*)::int as count FROM products`;
    const [catCount] = await sqlClient`SELECT count(*)::int as count FROM product_categories`;
    const [userCount] = await sqlClient`SELECT count(*)::int as count FROM users`;

    console.log("\n=================================================");
    console.log("✅ Berhasil! Semua data transaksi telah dibersihkan.");
    console.log("=================================================");
    console.log(`- Pesanan tersisa        : ${afterOrders.count}`);
    console.log(`- Item pesanan tersisa   : ${afterItems.count}`);
    console.log(`- Pembayaran tersisa     : ${afterPayments.count}`);
    console.log(`- Pengiriman tersisa     : ${afterDeliveries.count}`);
    console.log("-------------------------------------------------");
    console.log(`- Katalog Produk (Aman)  : ${prodCount.count} produk`);
    console.log(`- Kategori Produk (Aman) : ${catCount.count} kategori`);
    console.log(`- Akun Admin (Aman)      : ${userCount.count} pengguna`);
    console.log("=================================================");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Gagal membersihkan data transaksi:", error.message);
    process.exit(1);
  }
}

clearTransactions();
