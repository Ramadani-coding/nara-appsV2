import http from "node:http";
import { 
  Client, 
  Events, 
  GatewayIntentBits, 
  Partials 
} from "discord.js";
import { config } from "./config.js";
import { execute as executeProduk, buildCatalogMessage } from "./commands/produk.js";
import { execute as executePesananSaya, buildUserOrdersMessage } from "./commands/pesanan-saya.js";
import { execute as executeBantuan } from "./commands/bantuan.js";
import { handleInteraction } from "./interactions/handlers.js";
import { DeliveryPollerService } from "./services/delivery-poller.js";

console.log("🤖 Menginisialisasi Nara Store Discord Bot...");

// Inisialisasi Discord Client
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [
    Partials.Channel, // Diperlukan untuk penanganan Direct Message (DM)
    Partials.Message,
  ],
});

const deliveryPoller = new DeliveryPollerService(client);

// -----------------------------------------------------------------------------
// EVENT: CLIENT READY
// -----------------------------------------------------------------------------
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Nara Discord Bot berhasil login sebagai: ${readyClient.user.tag}`);
  console.log(`🌐 Backend API target: ${config.backendUrl}`);

  // Mulai loop pengecekan pengiriman akun digital ke DM
  deliveryPoller.start();
});

// -----------------------------------------------------------------------------
// EVENT: INTERACTION CREATE (SLASH COMMANDS, BUTTONS, SELECT MENUS)
// -----------------------------------------------------------------------------
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // 1. Tangani Slash Commands
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      if (commandName === "produk") {
        await executeProduk(interaction);
      } else if (commandName === "pesanan-saya") {
        await executePesananSaya(interaction);
      } else if (commandName === "bantuan") {
        await executeBantuan(interaction);
      } else {
        await interaction.reply({
          content: "Perintah tidak dikenali.",
          ephemeral: true,
        });
      }
      return;
    }

    // 2. Tangani Komponen Interaktif (Tombol & Menu Pilihan)
    if (interaction.isButton() || interaction.isStringSelectMenu()) {
      await handleInteraction(interaction);
      return;
    }
  } catch (error: any) {
    console.error("❌ Uncaught interaction error:", error);
  }
});

// -----------------------------------------------------------------------------
// EVENT: MESSAGE CREATE (FALLBACK TEXT CHAT: /produk, !produk, dsb.)
// -----------------------------------------------------------------------------
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    if (content === "/produk" || content === "!produk" || content === "produk") {
      const catalogMsg = await buildCatalogMessage(null, 1);
      await message.reply(catalogMsg);
      return;
    }

    if (content === "/pesanan-saya" || content === "!pesanan-saya") {
      const ordersMsg = await buildUserOrdersMessage(message.author.id);
      await message.reply(ordersMsg);
      return;
    }

    if (content === "/bantuan" || content === "!bantuan" || content === "bantuan") {
      await message.reply({
        content: `👋 Halo <@${message.author.id}>! Gunakan command \`/produk\` untuk melihat katalog dan berbelanja produk digital premium Nara Store.`,
      });
      return;
    }
  } catch (error: any) {
    console.error("❌ Uncaught message error:", error);
  }
});

// -----------------------------------------------------------------------------
// SERVER HTTP INTERNAL UNTUK WEBHOOK DELIVERY DARI BACKEND
// -----------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  // Endpoint healthcheck
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "nara-discord-bot" }));
    return;
  }

  // Webhook notifikasi instan ketika pesanan selesai diproses oleh backend/Midtrans
  if (req.method === "POST" && req.url === "/webhook/delivery") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        console.log("⚡ Menerima trigger webhook delivery dari backend:", payload);

        // Langsung periksa dan kirimkan pesanan ke DM
        deliveryPoller.checkAndDeliverPendingOrders().catch(() => {});

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Delivery check triggered" }));
      } catch (err: any) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`⚠️ Port ${config.botPort} sedang digunakan oleh proses lain. Webhook dilewati, bot tetap berjalan normal menggunakan Delivery Poller.`);
  } else {
    console.error("❌ HTTP server error:", err.message);
  }
});

server.listen(config.botPort, () => {
  console.log(`🔌 HTTP Webhook Listener bot berjalan pada port ${config.botPort}`);
});

// -----------------------------------------------------------------------------
// LOGIN BOT KE DISCORD
// -----------------------------------------------------------------------------
if (!config.discordToken) {
  console.warn("⚠️ PERINGATAN: DISCORD_BOT_TOKEN belum diisi di file .env. Bot tidak dapat terhubung ke Discord.");
  console.warn("👉 Silakan isi DISCORD_BOT_TOKEN dan DISCORD_CLIENT_ID pada bot/.env untuk mengaktifkan bot.");
} else {
  client.login(config.discordToken).catch((err) => {
    console.error("❌ Gagal login ke Discord:", err.message);
  });
}

// Graceful Shutdown
process.on("SIGINT", () => {
  console.log("🛑 Mematikan Nara Discord Bot...");
  deliveryPoller.stop();
  client.destroy();
  server.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("🛑 Mematikan Nara Discord Bot (SIGTERM)...");
  deliveryPoller.stop();
  client.destroy();
  server.close();
  process.exit(0);
});
