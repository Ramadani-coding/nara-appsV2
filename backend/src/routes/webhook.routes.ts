import { Router, type Request, type Response } from "express";

const router = Router();

// Konfigurasi Admin & Target Chat WhatsApp
export const ADMIN_PHONE_NUMBER = "6285750231336";
export const ADMIN_WHATSAPP_JID = "6285750231336@s.whatsapp.net";
export const TARGET_GROUP_JID = "120363423186799472@g.us";

// Regex untuk mendeteksi tanda #dc atau #promo (case-insensitive)
export const PROMO_TAG_REGEX = /#(?:dc|promo)\b/i;

/**
 * Validasi apakah pengirim pesan adalah Admin resmi Nara Premium
 */
export function isSenderAdmin(
  senderJid: string,
  isFromMe?: boolean,
  deviceId?: string
): boolean {
  const normalizedSender = (senderJid || "").toLowerCase().trim();

  // Ekstrak bagian user sebelum @ dan sebelum : (menangani format WhatsApp multidevice mis. 6285750231336:1@s.whatsapp.net)
  const userPart = normalizedSender.split("@")[0].split(":")[0];
  const senderDigits = userPart.replace(/\D/g, "");

  // 1. Cek kecocokan JID atau nomor admin resmi
  if (
    normalizedSender === ADMIN_WHATSAPP_JID.toLowerCase() ||
    normalizedSender.startsWith(`${ADMIN_PHONE_NUMBER}@`) ||
    senderDigits === ADMIN_PHONE_NUMBER ||
    senderDigits === `0${ADMIN_PHONE_NUMBER.slice(2)}` || // 085750231336
    senderDigits === ADMIN_PHONE_NUMBER.slice(2) // 85750231336
  ) {
    return true;
  }

  // 2. Cek kecocokan dengan konfigurasi env ADMIN_WHATSAPP_PHONE jika disetel
  const envAdminPhone = process.env.ADMIN_WHATSAPP_PHONE?.replace(/\D/g, "");
  if (envAdminPhone) {
    if (
      senderDigits === envAdminPhone ||
      senderDigits === `62${envAdminPhone.replace(/^0/, "")}`
    ) {
      return true;
    }
  }

  // 3. Jika pesan dikirim langsung dari akun bot/host sendiri (is_from_me = true di GoWA)
  if (isFromMe) {
    if (!deviceId) return true;
    const deviceDigits = deviceId.split("@")[0].split(":")[0].replace(/\D/g, "");
    if (
      deviceDigits === ADMIN_PHONE_NUMBER ||
      deviceDigits === `0${ADMIN_PHONE_NUMBER.slice(2)}` ||
      (envAdminPhone && deviceDigits === envAdminPhone) ||
      !deviceDigits
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Validasi apakah chat berasal dari grup target atau DM admin
 */
export function isValidChatOrigin(chatId: string, isAdmin: boolean): boolean {
  const normalizedChatId = (chatId || "").toLowerCase().trim();

  // 1. Berasal dari grup target resmi Nara Premium
  if (normalizedChatId === TARGET_GROUP_JID.toLowerCase()) {
    return true;
  }

  // 2. Pesan langsung (DM/japri) dari nomor admin (bukan dari grup lain)
  if (isAdmin && !normalizedChatId.endsWith("@g.us")) {
    return true;
  }

  return false;
}

/**
 * Cek apakah teks pesan mengandung tanda #dc atau #promo (case-insensitive)
 */
export function containsPromoTag(text: string): boolean {
  if (!text) return false;
  return PROMO_TAG_REGEX.test(text);
}

/**
 * Membersihkan tanda #dc atau #promo dan merapikan spasi / line break
 */
export function cleanPromoMessage(rawText: string): string {
  if (!rawText) return "";

  return rawText
    // Hapus tanda #dc atau #promo (case-insensitive), opsional diikuti tanda titik dua atau spasi
    .replace(/#(?:dc|promo)\b[:\s]*/gi, "")
    // Hapus spasi berlebih pada tiap baris
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    // Satukan kembali baris
    .join("\n")
    // Batasi baris kosong maksimal 2 baris berurutan (gap 1 baris kosong)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Meneruskan pesan promo ke Discord Webhook sebagai embed elegan
 */
export async function forwardToDiscordWebhook(
  cleanedMessage: string
): Promise<{ success: boolean; forwarded: boolean; error?: string }> {
  const webhookUrl = (
    process.env.DISCORD_PROMO_WEBHOOK_URL ||
    "https://discord.com/api/webhooks/your_webhook_id/your_webhook_token"
  ).trim();

  if (!webhookUrl || webhookUrl.includes("your_webhook_id")) {
    console.warn(
      "[WhatsApp Webhook] ⚠️ DISCORD_PROMO_WEBHOOK_URL belum disetel di .env. Simulasi forward dicatat sebagai berhasil."
    );
    return {
      success: true,
      forwarded: true,
    };
  }

  // Discord Embed Description limit 4096 karakter
  const description =
    cleanedMessage.length > 4000
      ? cleanedMessage.slice(0, 3990) + "\n\n...(pesan terpotong)"
      : cleanedMessage;

  const discordPayload = {
    username: "Nara Premium Broadcast",
    embeds: [
      {
        title: "📢 Update & Pengumuman Nara Premium",
        description,
        color: 0x38bdf8, // Aksen Biru Cerah Nara (#38BDF8)
        timestamp: new Date().toISOString(),
        footer: {
          text: "Nara Digital Store • Broadcast WhatsApp",
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[WhatsApp Webhook] ❌ Gagal meneruskan ke Discord Webhook (HTTP ${response.status}):`,
        errorText
      );
      return {
        success: false,
        forwarded: false,
        error: `Discord HTTP ${response.status}: ${errorText}`,
      };
    }

    console.log("[WhatsApp Webhook] ✅ Pesan admin berhasil diteruskan ke Discord Webhook!");
    return { success: true, forwarded: true };
  } catch (err: any) {
    console.error(
      "[WhatsApp Webhook] ❌ Kesalahan jaringan saat memanggil Discord Webhook:",
      err?.message || err
    );
    return {
      success: false,
      forwarded: false,
      error: err?.message || "Network error",
    };
  }
}

/**
 * POST /api/webhook/whatsapp
 * Endpoint penerima webhook pesan WhatsApp dari GoWA (aldinokemal/go-whatsapp-web-multidevice)
 */
router.post("/whatsapp", async (req: Request, res: Response) => {
  try {
    const body = req.body || {};

    // 1. Filter event type dari GoWA jika tersedia (abaikan event non-pesan)
    if (body.event && body.event !== "message") {
      res.status(200).json({
        success: true,
        forwarded: false,
        reason: `Ignored event: ${body.event}`,
      });
      return;
    }

    // Ekstrak objek payload (mendukung format GoWA bersarang maupun datar)
    const payload = body.payload || body.data || body;

    // 2. Ekstrak pesan mentah
    const rawMessage = String(
      payload.body ||
      payload.caption ||
      payload.message ||
      payload.text ||
      payload.conversation ||
      ""
    ).trim();

    // 3. Ekstrak Chat ID (Room grup atau DM)
    const chatId = String(
      payload.chat_id ||
      payload.chat ||
      payload.jid ||
      body.chat_id ||
      ""
    ).trim();

    // 4. Ekstrak Pengirim (Sender JID)
    const isFromMe = Boolean(payload.is_from_me ?? body.is_from_me);
    const deviceId = String(body.device_id || payload.device_id || "").trim();
    const senderJid = String(
      payload.from ||
      payload.sender ||
      payload.participant ||
      payload.sender_jid ||
      (isFromMe && deviceId ? deviceId : "") ||
      (isFromMe ? ADMIN_WHATSAPP_JID : "") ||
      chatId ||
      ""
    ).trim();

    // 5. Cek apakah pengirim adalah admin
    const isAdmin = isSenderAdmin(senderJid, isFromMe, deviceId);
    if (!isAdmin) {
      res.status(200).json({
        success: true,
        forwarded: false,
        reason: "Pengirim bukan nomor admin resmi",
      });
      return;
    }

    // 6. Cek apakah pesan berasal dari grup JID target atau pesan langsung (DM) admin
    const isOriginValid = isValidChatOrigin(chatId, isAdmin);
    if (!isOriginValid) {
      res.status(200).json({
        success: true,
        forwarded: false,
        reason: "Pesan tidak berasal dari grup target atau DM admin resmi",
      });
      return;
    }

    // 7. Cek apakah pesan mengandung tanda #dc atau #promo (case-insensitive)
    if (!containsPromoTag(rawMessage)) {
      res.status(200).json({
        success: true,
        forwarded: false,
        reason: "Pesan tidak mengandung tanda #dc atau #promo",
      });
      return;
    }

    // 8. Bersihkan tanda #dc/#promo dan rapikan spasi/line break
    const cleanedMessage = cleanPromoMessage(rawMessage);
    if (!cleanedMessage) {
      res.status(200).json({
        success: true,
        forwarded: false,
        reason: "Isi pesan kosong setelah tag dihapus",
      });
      return;
    }

    // 9. Teruskan ke Discord Webhook
    console.log(
      `[WhatsApp Webhook] 🚀 Meneruskan pesan broadcast dari ${senderJid} (Chat: ${chatId}) ke Discord Webhook...`
    );
    const forwardResult = await forwardToDiscordWebhook(cleanedMessage);

    if (forwardResult.forwarded) {
      res.status(200).json({
        success: true,
        forwarded: true,
      });
    } else {
      // Tetap berikan HTTP 200 agar GoWA tidak melakukan retry berulang jika Discord webhook gagal
      res.status(200).json({
        success: false,
        forwarded: false,
        error: forwardResult.error,
      });
    }
  } catch (error: any) {
    console.error("[WhatsApp Webhook] ❌ Error saat memproses webhook GoWA:", error);
    // Berikan HTTP 200 dengan status error agar GoWA tidak loop retry
    res.status(200).json({
      success: false,
      forwarded: false,
      error: error?.message || "Internal server error",
    });
  }
});

/**
 * GET /api/webhook/whatsapp
 * Healthcheck status webhook WhatsApp
 */
router.get("/whatsapp", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "GoWA WhatsApp Webhook Receiver for Discord Promo Broadcast",
    targetGroupJid: TARGET_GROUP_JID,
    adminPhone: ADMIN_PHONE_NUMBER,
    discordWebhookConfigured: Boolean(process.env.DISCORD_PROMO_WEBHOOK_URL),
    timestamp: new Date().toISOString(),
  });
});

export default router;
