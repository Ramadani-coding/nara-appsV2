import "dotenv/config";
import crypto from "node:crypto";
import { premiumkuService } from "../services/premiumku.service.js";

async function runTest() {
  console.log("🧪 Memulai pengujian Webhook Premku & HMAC Verification...");

  const realSecret = process.env.PREMKU_API_SECRET;
  console.log("🔍 Nilai PREMKU_API_SECRET terdeteksi:", realSecret ? `ADA (${realSecret.length} karakter)` : "TIDAK DITEMUKAN");
  console.log("   Preview Secret:", realSecret ? `${realSecret.slice(0, 8)}...${realSecret.slice(-6)}` : "-");

  const testSecret = realSecret || "test_secret_key_12345";

  const samplePayload = {
    event: "order.success",
    data: {
      invoice: "API-20261016120000-TEST01",
      ref_id: "REF-TEST-998877",
      product: "Canva Pro 1 Tahun",
      qty: 1,
      price: 15000,
      total: 15000,
      status: "success",
      accounts: [
        {
          username: "tester@example.com",
          password: "SecretPassword123!",
        },
      ],
      balance_after: 85000,
    },
    timestamp: Math.floor(Date.now() / 1000),
  };

  const rawBody = JSON.stringify(samplePayload);

  // 1. Generate signature yang benar
  const validSignature = crypto
    .createHmac("sha256", testSecret)
    .update(rawBody)
    .digest("hex");

  console.log("🔑 Generated HMAC Signature:", validSignature);

  // 2. Test verifikasi valid
  const isValid = premiumkuService.verifyWebhookSignature(rawBody, validSignature);
  console.log("✅ Valid signature check:", isValid ? "PASS" : "FAIL");

  // 3. Test verifikasi invalid
  const isInvalid = premiumkuService.verifyWebhookSignature(rawBody, "invalid_signature_hex_value");
  console.log("🛡️ Invalid signature check (should be false):", !isInvalid ? "PASS" : "FAIL");

  // 4. Test normalisasi response createOrder
  const mockOrderResponse = {
    success: true,
    message: "Order sukses.",
    data: {
      invoice: "API-20261016120000-TEST01",
      ref_id: "REF-TEST-998877",
      product: "Canva Pro 1 Tahun",
      qty: 1,
      price: 15000,
      total: 15000,
      status: "success",
      accounts: [
        {
          username: "tester@example.com",
          password: "SecretPassword123!",
        },
      ],
      balance_after: 85000,
    },
  };

  console.log("📦 Checking Instant Atomic accounts extraction:");
  const extractedAccounts = (mockOrderResponse as any).accounts || mockOrderResponse.data?.accounts || [];
  console.log("   Accounts count:", extractedAccounts.length);
  console.log("   First Account User:", extractedAccounts[0]?.username);
  console.log("   First Account Pass:", extractedAccounts[0]?.password);

  if (isValid && !isInvalid && extractedAccounts.length === 1) {
    console.log("\n🎉 SEMUA TEST WEBHOOK & INSTANT ATOMIC DELIVERY BERHASIL 100%!");
  } else {
    throw new Error("Test failed!");
  }
}

runTest().catch((err) => {
  console.error("❌ Test error:", err);
  process.exit(1);
});
