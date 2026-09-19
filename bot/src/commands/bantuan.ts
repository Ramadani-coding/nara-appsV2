import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle 
} from "discord.js";
import { COLORS } from "../utils/formatters.js";
import { config } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("bantuan")
  .setDescription("Panduan berbelanja dan bantuan pelanggan Nara Store");

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📖 Panduan & Bantuan — ${config.storeName}`)
    .setDescription(
      `Selamat datang di **${config.storeName}**! Bot ini memungkinkan Anda membeli produk digital premium (Canva, CapCut, Spotify, Netflix, YouTube Premium, dll.) secara instan 24 jam.\n\n` +
      `### 🚀 Perintah Slash yang Tersedia:\n` +
      `• \`/produk\` — Buka katalog produk digital, filter kategori, cek harga & stok real-time, lalu klik tombol **Beli Sekarang**.\n` +
      `• \`/pesanan-saya\` — Cek status pesanan, pembayaran QRIS, atau ambil kredensial akun digital milik Anda.\n` +
      `• \`/bantuan\` — Menampilkan panduan ini.\n\n` +
      `### 💳 Alur Pembayaran QRIS:\n` +
      `1. Pilih produk di \`/produk\` lalu tekan tombol **Beli Sekarang**.\n` +
      `2. Bot akan menampilkan **Gambar Kode QRIS** eksklusif dengan total nominal.\n` +
      `3. Buka aplikasi e-wallet (GoPay, OVO, Dana, ShopeePay) atau Mobile Banking (BCA, Mandiri, BRI, BNI, dll.).\n` +
      `4. Scan QRIS dan selesaikan pembayaran sebelum batas waktu berakhir.\n` +
      `5. Setelah terkonfirmasi, produk digital **langsung otomatis dikirim ke DM Discord Anda**!`
    )
    .addFields(
      {
        name: "🔒 Privasi & Keamanan",
        value: "Pembelian via bot berstatus Guest (cukup ID Discord Anda). Anda tidak perlu membagikan nomor HP/email.",
        inline: false,
      },
      {
        name: "💬 Bantuan Admin & Garansi Akun",
        value: `Jika ada kendala pembayaran atau klaim garansi akun, hubungi WhatsApp Admin: **${config.adminPhone}**`,
        inline: false,
      }
    )
    .setFooter({
      text: `${config.storeName} • Auto-Order 24/7 Terpercaya`,
    })
    .setTimestamp();

  const catalogBtn = new ButtonBuilder()
    .setCustomId("open_catalog_from_help")
    .setLabel("🛍️ Buka Katalog Produk (/produk)")
    .setStyle(ButtonStyle.Primary);

  const websiteBtn = new ButtonBuilder()
    .setLabel("🌐 Kunjungi Website")
    .setStyle(ButtonStyle.Link)
    .setURL(config.storeUrl);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(catalogBtn, websiteBtn);

  await interaction.editReply({ embeds: [embed], components: [row] });
}
