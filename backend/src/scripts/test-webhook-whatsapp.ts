import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "../app.js";
import {
  isSenderAdmin,
  isValidChatOrigin,
  containsPromoTag,
  cleanPromoMessage,
  ADMIN_PHONE_NUMBER,
  ADMIN_WHATSAPP_JID,
  TARGET_GROUP_JID,
} from "../routes/webhook.routes.js";

async function runTests() {
  console.log("=== TEST SUITE: WHATSAPP GOWA WEBHOOK RECEIVER ===\n");

  let passed = 0;
  let failed = 0;

  function assert(testName: string, actual: boolean, expected: boolean) {
    if (actual === expected) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - Expected ${expected}, got ${actual}`);
      failed++;
    }
  }

  // --- 1. Test Admin Verification ---
  console.log("--- 1. Testing Admin Verification (isSenderAdmin) ---");
  assert("Admin phone 6285750231336", isSenderAdmin("6285750231336"), true);
  assert("Admin JID 6285750231336@s.whatsapp.net", isSenderAdmin("6285750231336@s.whatsapp.net"), true);
  assert("Admin Multidevice JID 6285750231336:1@s.whatsapp.net", isSenderAdmin("6285750231336:1@s.whatsapp.net"), true);
  assert("Admin local format 085750231336", isSenderAdmin("085750231336"), true);
  assert("GoWA is_from_me = true with device admin", isSenderAdmin("", true, "6285750231336@s.whatsapp.net"), true);
  assert("Non-admin phone 6281234567890", isSenderAdmin("6281234567890@s.whatsapp.net"), false);
  assert("Empty sender string", isSenderAdmin(""), false);

  // --- 2. Test Origin / Chat ID Verification ---
  console.log("\n--- 2. Testing Chat Origin Verification (isValidChatOrigin) ---");
  assert(
    "Target group 120363423186799472@g.us",
    isValidChatOrigin("120363423186799472@g.us", true),
    true
  );
  assert(
    "Direct chat from admin (DM)",
    isValidChatOrigin("6285750231336@s.whatsapp.net", true),
    true
  );
  assert(
    "Non-target group (120363999999999999@g.us)",
    isValidChatOrigin("120363999999999999@g.us", true),
    false
  );
  assert(
    "Direct chat from regular user (non-admin)",
    isValidChatOrigin("6281234567890@s.whatsapp.net", false),
    false
  );

  // --- 3. Test Promo Tag Detection ---
  console.log("\n--- 3. Testing Promo Tag Detection (containsPromoTag) ---");
  assert("Contains #promo", containsPromoTag("#promo Diskon 50% untuk akun Netflix!"), true);
  assert("Contains #dc", containsPromoTag("#dc Update status bot normal"), true);
  assert("Contains uppercase #PROMO", containsPromoTag("#PROMO Spesial Ramadhan"), true);
  assert("Contains uppercase #DC", containsPromoTag("Pemberitahuan #DC server reboot"), true);
  assert("Contains #promo at the end", containsPromoTag("Silakan diorder ya #promo"), true);
  assert("Regular chat without tags", containsPromoTag("Selamat pagi min"), false);
  assert("Empty text", containsPromoTag(""), false);

  // --- 4. Test Promo Message Cleaning ---
  console.log("\n--- 4. Testing Message Cleaning (cleanPromoMessage) ---");
  const rawSample1 = `#promo
⚡ FLASH SALE NARA STORE ⚡
- Netflix UHD 4K: Rp 25.000
- Spotify 3 Bulan: Rp 20.000

Order sekarang di website! #dc`;

  const cleaned1 = cleanPromoMessage(rawSample1);
  assert(
    "Tag #promo removed from start and #dc from end",
    !cleaned1.includes("#promo") && !cleaned1.includes("#dc"),
    true
  );
  assert("Text contains content", cleaned1.includes("FLASH SALE NARA STORE"), true);

  const rawSample2 = `#DC: Server sedang maintenance selama 10 menit.`;
  const cleaned2 = cleanPromoMessage(rawSample2);
  assert(
    "Tag #DC: prefix cleanly removed",
    cleaned2 === "Server sedang maintenance selama 10 menit.",
    true
  );

  // --- 5. End-to-End HTTP Server Endpoint Tests ---
  console.log("\n--- 5. Testing HTTP Endpoint (POST & GET /api/webhook/whatsapp) ---");
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 5.1 GET Healthcheck
    const getRes = await fetch(`${baseUrl}/api/webhook/whatsapp`);
    const getBody = (await getRes.json()) as any;
    assert("GET /api/webhook/whatsapp returns status 200", getRes.status === 200, true);
    assert("GET body status is ok", getBody.status === "ok", true);

    // 5.2 Valid Admin Broadcast with #promo in Group
    const validGroupPayload = {
      event: "message",
      device_id: "6285750231336@s.whatsapp.net",
      payload: {
        id: "MSG-001",
        chat_id: TARGET_GROUP_JID,
        from: ADMIN_WHATSAPP_JID,
        from_name: "Admin Nara",
        is_from_me: true,
        body: "#promo Promo Spesial Weekend! Diskon 30% semua produk digital.",
      },
    };
    const postRes1 = await fetch(`${baseUrl}/api/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validGroupPayload),
    });
    const postBody1 = (await postRes1.json()) as any;
    assert("HTTP Status is 200 for valid admin promo", postRes1.status === 200, true);
    assert("Forwarded is true for valid admin promo", postBody1.forwarded === true, true);
    assert("Success is true for valid admin promo", postBody1.success === true, true);

    // 5.3 Valid Admin Broadcast with #dc in Direct Message (DM)
    const validDmPayload = {
      event: "message",
      payload: {
        id: "MSG-002",
        chat_id: ADMIN_WHATSAPP_JID,
        from: ADMIN_WHATSAPP_JID,
        is_from_me: false,
        body: "#dc Update sistem pembayaran QRIS sudah kembali normal.",
      },
    };
    const postRes2 = await fetch(`${baseUrl}/api/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validDmPayload),
    });
    const postBody2 = (await postRes2.json()) as any;
    assert("HTTP Status is 200 for admin DM with #dc", postRes2.status === 200, true);
    assert("Forwarded is true for admin DM with #dc", postBody2.forwarded === true, true);

    // 5.4 Regular Member sending in Target Group with #promo (Must be IGNORED)
    const memberGroupPayload = {
      event: "message",
      payload: {
        id: "MSG-003",
        chat_id: TARGET_GROUP_JID,
        from: "6281299998888@s.whatsapp.net",
        is_from_me: false,
        body: "#promo Min apakah promo ini masih ada?",
      },
    };
    const postRes3 = await fetch(`${baseUrl}/api/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberGroupPayload),
    });
    const postBody3 = (await postRes3.json()) as any;
    assert("HTTP Status is 200 for member message (no error retry)", postRes3.status === 200, true);
    assert("Forwarded is false for member message", postBody3.forwarded === false, true);

    // 5.5 Admin chat in Group without #dc or #promo (Must be IGNORED)
    const adminRegularChat = {
      event: "message",
      payload: {
        id: "MSG-004",
        chat_id: TARGET_GROUP_JID,
        from: ADMIN_WHATSAPP_JID,
        body: "Halo teman-teman semua, selamat pagi.",
      },
    };
    const postRes4 = await fetch(`${baseUrl}/api/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminRegularChat),
    });
    const postBody4 = (await postRes4.json()) as any;
    assert("Forwarded is false for admin chat without tags", postBody4.forwarded === false, true);

    // 5.6 Non-message event like message.ack (Must be IGNORED)
    const ackPayload = {
      event: "message.ack",
      payload: { id: "MSG-005" },
    };
    const postRes5 = await fetch(`${baseUrl}/api/webhook/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ackPayload),
    });
    const postBody5 = (await postRes5.json()) as any;
    assert("Forwarded is false for message.ack event", postBody5.forwarded === false, true);

  } finally {
    server.close();
  }

  // --- 6. Summary ---
  console.log(`\n========================================`);
  console.log(`Total Passed: ${passed} | Total Failed: ${failed}`);
  if (failed === 0) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
    process.exit(0);
  } else {
    console.error("❌ SOME TESTS FAILED!");
    process.exit(1);
  }
}

runTests();
