import { premiumkuService } from "../services/premiumku.service.js";

async function main() {
  console.log("=================================================");
  console.log("🚀 Mengambil Semua Produk dari API Premiumku...");
  console.log("=================================================");

  try {
    const products = await premiumkuService.fetchProducts();
    console.log(`\n✅ Berhasil mendapatkan ${products.length} produk!\n`);

    console.table(
      products.map((p) => ({
        ID: p.id,
        Nama: p.name.length > 30 ? p.name.substring(0, 27) + "..." : p.name,
        Harga: `Rp${p.price.toLocaleString("id-ID")}`,
        "Harga Asli": p.original_price ? `Rp${p.original_price.toLocaleString("id-ID")}` : "-",
        Stok: p.stock,
        Status: p.status,
      }))
    );

    console.log("\nSample Full Detail Produk Pertama:");
    console.log(JSON.stringify(products[0], null, 2));

    console.log("\n=================================================");
    console.log("✨ Pengambilan produk dari API Premiumku sukses!");
    console.log("=================================================");
  } catch (err: any) {
    console.error("❌ Terjadi kesalahan:", err.message);
    process.exit(1);
  }
}

main();
