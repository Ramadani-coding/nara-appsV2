import { Client, EmbedBuilder } from "discord.js";
import { apiClient, type Order } from "../api/client.js";
import { formatCredentialsContent } from "../interactions/handlers.js";
import { COLORS, formatRupiah, formatDate } from "../utils/formatters.js";
import { config } from "../config.js";

export class DeliveryPollerService {
  private client: Client;
  private intervalId: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly pollIntervalMs = 5000; // 5 detik

  constructor(client: Client) {
    this.client = client;
  }

  start() {
    console.log("🚀 Service pengiriman otomatis (Delivery Poller) bot Discord aktif.");
    this.intervalId = setInterval(() => {
      this.checkAndDeliverPendingOrders().catch((err) =>
        console.error("❌ Error in delivery poller loop:", err.message)
      );
    }, this.pollIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log("⏹️ Delivery Poller dihentikan.");
  }

  /**
   * Dipanggil secara instan oleh Webhook internal atau berkala oleh Poller
   */
  async checkAndDeliverPendingOrders() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingOrders = await apiClient.getPendingDeliveries();
      if (pendingOrders.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`📦 Menemukan ${pendingOrders.length} pesanan siap kirim ke DM Discord...`);

      for (const order of pendingOrders) {
        await this.deliverOrderToUser(order);
      }
    } catch (err: any) {
      console.error("❌ Gagal mengecek antrean pengiriman bot:", err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Mengirim kredensial produk digital ke DM Discord pembeli
   */
  private async deliverOrderToUser(order: Order) {
    if (!order.discordUserId) return;

    const firstItem = order.items && order.items[0];
    const productName = firstItem?.productName || "Produk Digital";
    const delivery = order.deliveries && order.deliveries[0];

    if (!delivery || !delivery.content) {
      console.warn(`⚠️ Pesanan #${order.orderNumber} completed tapi belum ada record delivery akun.`);
      return;
    }

    try {
      // Ambil user object Discord
      const user = await this.client.users.fetch(order.discordUserId);
      if (!user) {
        console.warn(`⚠️ User Discord ${order.discordUserId} tidak ditemukan.`);
        return;
      }

      const formatted = formatCredentialsContent(delivery.content);

      const dmEmbed = new EmbedBuilder()
        .setColor(COLORS.success)
        .setTitle(`🎉 Pembelian Berhasil — #${order.orderNumber}`)
        .setDescription(
          `Halo **${user.username}**! Terima kasih telah berbelanja di **${config.storeName}**.\n` +
          `Pesanan Anda untuk produk **${productName}** telah selesai diproses otomatis!\n\n` +
          `💰 **Total:** ${formatRupiah(order.totalAmount)}\n` +
          `📅 **Waktu Selesai:** ${formatDate(order.completedAt || new Date())}\n\n` +
          `--- \n` +
          `### 🔐 Kredensial Akun Digital Anda:\n` +
          formatted.summary
        )
        .setFooter({
          text: `${config.storeName} • Jangan berikan kredensial ini kepada pihak lain`,
        })
        .setTimestamp();

      for (const f of formatted.fields) {
        dmEmbed.addFields(f);
      }

      dmEmbed.addFields(
        {
          name: "ℹ️ Panduan & Tips",
          value: 
            "• Gunakan kredensial di atas sesuai aplikasi/layanan masing-masing.\n" +
            "• Jangan mengubah email/password utama jika akun berstatus sharing.\n" +
            "• Data ini juga dapat Anda lihat kapan saja melalui command `/pesanan-saya`.",
          inline: false,
        },
        {
          name: "💬 Garansi & Bantuan",
          value: `Ada pertanyaan atau kendala login? Hubungi WhatsApp Admin: **${config.adminPhone}**`,
          inline: false,
        }
      );

      // Kirim pesan langsung ke DM
      await user.send({ embeds: [dmEmbed] });

      console.log(`✅ Sukses mengirimkan produk #${order.orderNumber} ke DM Discord @${user.tag} (${user.id})`);

      // Tandai di backend bahwa DM telah berhasil dikirim
      await apiClient.markDeliverySent(order.id);
    } catch (err: any) {
      console.error(`⚠️ Gagal mengirim DM ke user ${order.discordUserId} untuk pesanan #${order.orderNumber}:`, err.message);
      // Jika user mematikan DM (50007: Cannot send messages to this user), kita tandai atau biarkan
      // agar user tetap bisa melihat akunnya via slash command /pesanan-saya
      if (err.code === 50007) {
        console.warn(`ℹ️ User ${order.discordUserId} menonaktifkan DM privat. Akun tetap tersedia via /pesanan-saya.`);
        await apiClient.markDeliverySent(order.id);
      }
    }
  }
}
