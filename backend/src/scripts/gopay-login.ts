import readline from "node:readline";
import crypto from "node:crypto";
import { gopayService, type GoPaySession } from "../services/gopay.service.js";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function parsePhoneNumber(raw: string): { cleanNumber: string; fullNumber: string } {
  let cleaned = raw.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("62")) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith("0")) {
    cleaned = cleaned.substring(1);
  }
  return {
    cleanNumber: cleaned,
    fullNumber: `+62${cleaned}`,
  };
}

async function main() {
  console.log("\n========================================================");
  console.log("   GOPAY MERCHANT / GOBIZ TERMINAL OTP LOGIN HELPER     ");
  console.log("========================================================\n");

  const existing = gopayService.loadSession();
  if (existing && existing.access_token) {
    console.log("ℹ️ Terdeteksi berkas sesi yang sudah ada di:", gopayService.getSessionFilePath());
    const overwrite = await askQuestion("Apakah Anda ingin mengganti sesi lama dengan login baru? (y/N): ");
    if (overwrite.toLowerCase() !== "y") {
      console.log("Membatalkan proses login. Sesi lama tetap aktif.");
      process.exit(0);
    }
  }

  const rawPhone = await askQuestion("Masukkan Nomor HP Akun GoPay Merchant / GoBiz (contoh: 08123456789): ");
  if (!rawPhone) {
    console.error("❌ Nomor HP tidak boleh kosong.");
    process.exit(1);
  }

  const { cleanNumber, fullNumber } = parsePhoneNumber(rawPhone);
  console.log(`\n[*] Mengirim permintaan kode OTP ke nomor: ${fullNumber}...`);

  const commonHeaders = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "id",
    "authentication-type": "go-id",
    "content-type": "application/json",
    "gojek-country-code": "ID",
    "gojek-timezone": "Asia/Jakarta",
    "origin": "https://portal.gofoodmerchant.co.id",
    "referer": "https://portal.gofoodmerchant.co.id/",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
    "x-appid": "go-biz-web-dashboard",
    "x-appversion": "platform-v3.111.0-1708bc9a",
    "x-deviceos": "Web",
    "x-phonemake": "Windows 10 64-bit",
    "x-phonemodel": "Chrome 150.0.0.0 on Windows 10 64-bit",
    "x-platform": "Web",
    "x-uniqueid": crypto.randomUUID(),
    "x-user-locale": "en-GB",
    "x-user-type": "merchant",
  };

  try {
    const reqRes = await fetch("https://api.gobiz.co.id/goid/login/request", {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        client_id: "go-biz-web-new",
        phone_number: cleanNumber,
        country_code: "62",
      }),
    });

    const reqData: any = await reqRes.json();
    if (!reqRes.ok) {
      console.error("❌ Gagal meminta OTP dari server GoBiz:", reqData.message || JSON.stringify(reqData));
      process.exit(1);
    }

    const payload = reqData.data || reqData;
    const otpToken = payload.otp_token || payload.login_token;

    if (!otpToken) {
      console.error("❌ otp_token tidak ditemukan dalam respon:", reqData);
      process.exit(1);
    }

    console.log("✅ Permintaan OTP berhasil! Kode 4-digit telah dikirimkan via SMS / WhatsApp.");

    const otpCode = await askQuestion("\nMasukkan 4-digit kode OTP yang Anda terima: ");
    if (!otpCode || otpCode.length < 4) {
      console.error("❌ Kode OTP harus 4 digit angka.");
      process.exit(1);
    }

    console.log("[*] Memverifikasi kode OTP...");

    const verifyRes = await fetch("https://api.gobiz.co.id/goid/token", {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        client_id: "go-biz-web-new",
        grant_type: "otp",
        data: {
          otp: otpCode.trim(),
          otp_token: otpToken,
        },
      }),
    });

    const verifyData: any = await verifyRes.json();
    if (!verifyRes.ok) {
      console.error("❌ Verifikasi OTP gagal:", verifyData.message || JSON.stringify(verifyData));
      process.exit(1);
    }

    const tokenPayload = verifyData.data || verifyData;
    if (!tokenPayload.access_token) {
      console.error("❌ access_token tidak ditemukan dalam respon:", verifyData);
      process.exit(1);
    }

    const expiresInSec = tokenPayload.expires_in || 3600 * 24 * 30;
    const newSession: GoPaySession = {
      access_token: tokenPayload.access_token,
      refresh_token: tokenPayload.refresh_token,
      token_type: tokenPayload.token_type || "Bearer",
      expires_in: expiresInSec,
      expires_at: Date.now() + expiresInSec * 1000,
      phone_number: cleanNumber,
    };

    gopayService.saveSession(newSession);

    console.log("\n========================================================");
    console.log("🎉 LOGIN GOPAY MERCHANT BERHASIL!");
    console.log("========================================================");
    console.log("1. Sesi telah disimpan aman di:", gopayService.getSessionFilePath());
    console.log("2. Sesi ini akan diperbarui otomatis oleh sistem di background.");
    console.log("3. Pastikan GOPAY_QRIS_STATIC sudah diatur di backend/.env");
    console.log("========================================================\n");
  } catch (err: any) {
    console.error("❌ Terjadi kesalahan koneksi:", err.message);
    process.exit(1);
  }
}

main();
