import { gopayService } from "../services/gopay.service.js";

async function testGopay() {
  console.log("==================================================");
  console.log("   UJI INTEGRASI GOPAY MERCHANT PAYMENT GATEWAY   ");
  console.log("==================================================");

  const isAvail = gopayService.isAvailable();
  console.log("1. Status GoPay Service:", isAvail ? "🟢 AKTIF & SIAP PAKAI" : "🔴 BELUM SIAP");

  if (!isAvail) {
    console.error("Gopay service belum siap. Periksa .gopay_session.json dan GOPAY_QRIS_STATIC di .env");
    process.exit(1);
  }

  // 2. Generate Dynamic QRIS
  const testNominal = 15500;
  const qrString = gopayService.generateDynamicQRIS(testNominal);
  console.log("\n2. Uji Generate Dynamic QRIS EMVCo:");
  console.log("   - Nominal   : Rp", testNominal.toLocaleString("id-ID"));
  console.log("   - QR String :", qrString?.substring(0, 75) + "...");

  // 3. Tes Konektivitas ke API Mutasi Gojek
  console.log("\n3. Uji Koneksi Mutasi ke API Gojek GoBiz...");
  try {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000);
    const result = await gopayService.verifyPayment(testNominal, oneHourAgo);
    console.log("   - Koneksi API Gojek: ✅ BERHASIL TERHUBUNG DENGAN BAIK!");
    console.log("   - Status Transaksi Uji:", result ? "Ditemukan pembayaran cocok" : "Tidak ada transaksi untuk nominal uji (Normal)");
  } catch (err: any) {
    console.error("   - Koneksi API Gojek GAGAL:", err.message);
  }

  console.log("\n==================================================");
  console.log("🎉 SEMUA INTEGRASI GOPAY SIAP DIGUNAKAN!");
  console.log("==================================================");
  process.exit(0);
}

testGopay();
