import { 
  SlashCommandBuilder, 
  ChatInputCommandInteraction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from "discord.js";
import { apiClient, type Order } from "../api/client.js";
import { COLORS, formatRupiah, formatDate, formatStatusBadge } from "../utils/formatters.js";
import { config } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("pesanan-saya")
  .setDescription("Cek riwayat dan status pesanan produk digital Anda");

export async function buildUserOrdersMessage(discordUserId: string) {
  const userOrders = await apiClient.getUserOrders(discordUserId);

  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`📋 Riwayat Pesanan Anda — ${config.storeName}`)
    .setDescription(
      `Berikut adalah daftar transaksi produk digital yang terhubung dengan akun Discord Anda.\n` +
      `Data bersifat privat dan hanya dapat dilihat oleh Anda.\n\n` +
      `Total Pesanan: **${userOrders.length}**`
    )
    .setFooter({
      text: `${config.storeName} • Gunakan tombol di bawah untuk melihat rincian`,
    })
    .setTimestamp();

  if (userOrders.length === 0) {
    embed.addFields({
      name: "Belum Ada Transaksi",
      value: "Anda belum melakukan pembelian produk melalui bot Discord. Gunakan command `/produk` untuk mulai berbelanja!",
    });
    return { embeds: [embed], components: [] };
  }

  // Tampilkan hingga 6 pesanan terbaru di embed
  for (const order of userOrders.slice(0, 6)) {
    const status = formatStatusBadge(order.status);
    const firstItem = order.items && order.items[0];
    const productName = firstItem?.productName || "Produk Digital";

    embed.addFields({
      name: `${status.emoji} #${order.orderNumber} — ${productName}`,
      value: `💵 Total: **${formatRupiah(order.totalAmount)}**\n📌 Status: \`${status.label}\`\n📅 Waktu: ${formatDate(order.createdAt)}`,
      inline: false,
    });
  }

  // Dropdown untuk memilih pesanan spesifik guna melihat rincian
  const selectOptions = userOrders.slice(0, 10).map((o) => {
    const status = formatStatusBadge(o.status);
    const firstItem = o.items && o.items[0];
    return new StringSelectMenuOptionBuilder()
      .setLabel(`#${o.orderNumber}`.substring(0, 25))
      .setValue(`order_detail_${o.orderNumber}`)
      .setDescription(`${status.emoji} ${status.label} • ${firstItem?.productName || "Produk"}`.substring(0, 50));
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("select_my_order")
    .setPlaceholder("🔍 Pilih pesanan untuk membuka detail/akun...")
    .addOptions(selectOptions);

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const refreshBtn = new ButtonBuilder()
    .setCustomId("refresh_my_orders")
    .setLabel("🔄 Refresh Riwayat")
    .setStyle(ButtonStyle.Secondary);

  const shopBtn = new ButtonBuilder()
    .setCustomId("open_catalog_from_orders")
    .setLabel("🛍️ Belanja Lagi (/produk)")
    .setStyle(ButtonStyle.Primary);

  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(refreshBtn, shopBtn);

  return { embeds: [embed], components: [selectRow, btnRow] };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  // Ephemeral reply agar data pesanan privat tidak terbaca anggota server lain
  await interaction.deferReply({ ephemeral: true });
  const msg = await buildUserOrdersMessage(interaction.user.id);
  await interaction.editReply(msg);
}
