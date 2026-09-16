import dotenv from "dotenv";
dotenv.config();

import { 
  validateWhatsAppNumber, 
  validateIndonesianPhoneLocal, 
  formatToWhatsAppJid 
} from "../services/whatsapp.service.js";

async function runTest() {
  console.log("=== TEST GOWA WHATSAPP SERVICE ===");
  console.log("GOWA_BASE_URL :", process.env.GOWA_BASE_URL || "(default)");
  console.log("GOWA_DEVICE_ID:", process.env.GOWA_DEVICE_ID || "(default)");
  console.log("BASIC AUTH    :", process.env.GOWA_BASIC_AUTH_USER ? "Configured" : "Not configured yet");

  console.log("\n1. Test JID Formatting:");
  console.log("085761188124 ->", formatToWhatsAppJid("085761188124"));
  console.log("+6281234567890 ->", formatToWhatsAppJid("+6281234567890"));

  console.log("\n2. Test Local Validation (Indosat):");
  const localRes = validateIndonesianPhoneLocal("085761188124");
  console.log("Local check result:", localRes);

  console.log("\n3. Test validateWhatsAppNumber (085761188124):");
  const valRes = await validateWhatsAppNumber("085761188124");
  console.log("validateWhatsAppNumber result:", valRes);

  console.log("\n4. Test Invalid Dummy Number (08123456789):");
  const dummyRes = await validateWhatsAppNumber("08123456789");
  console.log("Dummy result (should be invalid):", dummyRes);

  console.log("\n5. Simulasi Pengiriman Notifikasi ke WhatsApp 085750231336:");
  const { sendOrderSuccessNotification } = await import("../services/whatsapp.service.js");

  const targetPhone = process.env.ADMIN_WHATSAPP_PHONE || "085750231336";
  const sampleOrderNumber = "NRA-882910";
  const sampleProduct = "Netflix Premium 1 Bulan (4K UHD)";
  const sampleAmount = 35000;
  const clientUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  console.log(`\n➡️ Mengirim Notifikasi Tunggal (Format Baru & Menarik) ke ${targetPhone}...`);
  const res = await sendOrderSuccessNotification(
    targetPhone,
    sampleOrderNumber,
    sampleProduct,
    sampleAmount,
    clientUrl
  );
  console.log("Hasil Kirim Pesan:", res.success ? "✅ TERKIRIM" : "❌ GAGAL", res.message || "");

  console.log("\n=== TEST COMPLETED SUCCESSFULLY ===");
}

runTest();
