import { premiumkuService } from "../services/premiumku.service.js";

async function main() {
  console.log("=================================================");
  console.log("🔍 Mengecek Akun & Saldo Premiumku...");
  console.log("=================================================");

  try {
    const res = await premiumkuService.getProfile();
    if (!res.success || !res.data) {
      console.error("❌ Gagal mendapatkan profil:", res.message || "Unknown error");
      process.exit(1);
    }

    const { username, whatsapp, saldo, registered_at } = res.data;
    console.log(`\n👤 Username    : ${username}`);
    console.log(`📱 WhatsApp    : ${whatsapp}`);
    console.log(`💰 Saldo       : Rp${Number(saldo).toLocaleString("id-ID")}`);
    console.log(`📅 Terdaftar   : ${registered_at}\n`);
    console.log("=================================================");
    console.log("✨ Pengecekan saldo berhasil!");
    console.log("=================================================");
  } catch (err: any) {
    console.error("❌ Terjadi kesalahan:", err.message);
    process.exit(1);
  }
}

main();
