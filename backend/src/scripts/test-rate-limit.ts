import { app } from "../app.js";
import http from "node:http";

async function runTest() {
  console.log("🚀 Menjalankan uji coba Rate Limiter...");

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 Test server running on ${baseUrl}`);

  try {
    // 1. Tes request biasa ke endpoint publik (/api/categories)
    const res1 = await fetch(`${baseUrl}/api/categories`);
    console.log(`1. GET /api/categories Status: ${res1.status}`);
    console.log("   All Headers:", Object.fromEntries(res1.headers.entries()));

    // 2. Tes pembuatan pesanan (createOrderLimiter kuota 10)
    console.log("\n2. Menguji createOrderLimiter (kuota 10 request)...");
    let hit429 = false;
    for (let i = 1; i <= 12; i++) {
      const res = await fetch(`${baseUrl}/api/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone: "invalid" }),
      });
      const data = (await res.json()) as any;
      console.log(`   Attempt ${i}: Status ${res.status} | Msg: ${data.message?.substring(0, 45)}...`);
      if (res.status === 429) {
        hit429 = true;
        console.log(`   ✅ Berhasil memicu 429 Too Many Requests pada attempt ke-${i}!`);
        console.log(`   Response JSON:`, data);
        break;
      }
    }

    if (!hit429) {
      console.warn("   ⚠️ 429 tidak terpicu dalam 12 kali request");
    }

    // 3. Tes bypass webhook Midtrans
    console.log("\n3. Menguji Webhook Midtrans Bypass...");
    const resWebhook = await fetch(`${baseUrl}/api/payments/notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    console.log(`   POST /api/payments/notification Status: ${resWebhook.status} (Harus 400 bad payload, bukan 429)`);
    if (resWebhook.status !== 429) {
      console.log("   ✅ Webhook Midtrans aman (bebas rate limit)!");
    } else {
      console.error("   ❌ Webhook Midtrans terblokir rate limit!");
    }

  } catch (err) {
    console.error("Test error:", err);
  } finally {
    server.close();
    console.log("\n🏁 Uji coba selesai, test server ditutup.");
    process.exit(0);
  }
}

runTest();
