import { 
  Interaction, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  AttachmentBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction
} from "discord.js";
import { apiClient } from "../api/client.js";
import { buildCatalogMessage, buildProductDetailMessage } from "../commands/produk.js";
import { buildUserOrdersMessage } from "../commands/pesanan-saya.js";
import { COLORS, formatRupiah, formatDate, formatStatusBadge } from "../utils/formatters.js";
import { generateQrBuffer } from "../utils/qr.js";
import { config } from "../config.js";

/**
 * Format kredensial akun digital dari delivery content JSON atau teks
 */
export function formatCredentialsContent(deliveryContent: string): { summary: string; fields: { name: string; value: string }[] } {
  try {
    const parsed = JSON.parse(deliveryContent);
    if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
      const fields: { name: string; value: string }[] = [];
      parsed.accounts.forEach((acc: any, idx: number) => {
        const title = `Akun #${idx + 1}` + (acc.profile ? ` (${acc.profile})` : "");
        const lines: string[] = [];
        if (acc.email || acc.username) lines.push(`📧 **Email/Username:** \`${acc.email || acc.username}\``);
        if (acc.password) lines.push(`🔑 **Password:** \`${acc.password}\``);
        if (acc.pin) lines.push(`🔢 **PIN / Profile:** \`${acc.pin}\``);
        if (acc.expired_at || acc.expiry) lines.push(`📅 **Masa Aktif:** \`${acc.expired_at || acc.expiry}\``);
        if (acc.notes || acc.instructions) lines.push(`ℹ️ **Catatan:** ${acc.notes || acc.instructions}`);
        
        // Fallback jika tidak terpetakan
        if (lines.length === 0) {
          lines.push(`\`\`\`json\n${JSON.stringify(acc, null, 2)}\n\`\`\``);
        }

        fields.push({
          name: title,
          value: lines.join("\n"),
        });
      });

      return {
        summary: `Tersedia **${parsed.accounts.length} akun** siap pakai:`,
        fields,
      };
    }
  } catch {}

  // Fallback plain text
  return {
    summary: "Detail Akun Digital:",
    fields: [{ name: "Kredensial Akun", value: `\`\`\`\n${deliveryContent}\n\`\`\`` }],
  };
}

export async function handleInteraction(interaction: Interaction) {
  try {
    // -------------------------------------------------------------------------
    // 1. SELECT MENU INTERACTIONS
    // -------------------------------------------------------------------------
    if (interaction.isStringSelectMenu()) {
      const selectMenu = interaction as StringSelectMenuInteraction;
      const customId = selectMenu.customId;
      const selectedValue = selectMenu.values[0];

      // A. Pilih Kategori
      if (customId === "select_category") {
        await selectMenu.deferUpdate();
        const categoryId = selectedValue === "cat_all" ? null : parseInt(selectedValue.replace("cat_", ""), 10);
        const catalogMsg = await buildCatalogMessage(categoryId, 1);
        await selectMenu.editReply(catalogMsg);
        return;
      }

      // B. Pilih Produk dari Katalog
      if (customId === "select_product") {
        await selectMenu.deferUpdate();
        const productId = parseInt(selectedValue.replace("prod_", ""), 10);
        const product = await apiClient.getProduct(productId);
        if (!product) {
          await selectMenu.followUp({ content: "⚠️ Produk tidak ditemukan atau sudah tidak aktif.", ephemeral: true });
          return;
        }
        const detailMsg = buildProductDetailMessage(product);
        await selectMenu.editReply(detailMsg);
        return;
      }

      // C. Pilih Pesanan Saya dari Riwayat
      if (customId === "select_my_order") {
        await selectMenu.deferUpdate();
        const orderNumber = selectedValue.replace("order_detail_", "");
        const order = await apiClient.getOrderDetail(orderNumber);
        if (!order) {
          await selectMenu.followUp({ content: "⚠️ Pesanan tidak ditemukan.", ephemeral: true });
          return;
        }

        const status = formatStatusBadge(order.status);
        const firstItem = order.items && order.items[0];
        const productName = firstItem?.productName || "Produk Digital";

        const embed = new EmbedBuilder()
          .setColor(status.color)
          .setTitle(`🧾 Rincian Pesanan #${order.orderNumber}`)
          .setDescription(`Status: **${status.emoji} ${status.label}**\nProduk: **${productName}** (x${firstItem?.quantity || 1})`)
          .addFields(
            { name: "💵 Total Pembayaran", value: formatRupiah(order.totalAmount), inline: true },
            { name: "📅 Waktu Pemesanan", value: formatDate(order.createdAt), inline: true },
            { name: "🔖 Ref ID", value: `\`${order.refId}\``, inline: true }
          )
          .setFooter({ text: `${config.storeName}` })
          .setTimestamp();

        const components: ActionRowBuilder<ButtonBuilder>[] = [];
        const btnRow = new ActionRowBuilder<ButtonBuilder>();

        if (order.status === "completed" && order.deliveries && order.deliveries.length > 0) {
          const delivery = order.deliveries[0];
          const formatted = formatCredentialsContent(delivery.content);
          embed.addFields({ name: "🎉 Pengiriman Produk", value: formatted.summary, inline: false });
          for (const f of formatted.fields) {
            embed.addFields(f);
          }
        } else if (order.status === "waiting_payment") {
          btnRow.addComponents(
            new ButtonBuilder()
              .setCustomId(`check_status_${order.orderNumber}`)
              .setLabel("🔄 Cek Status Pembayaran")
              .setStyle(ButtonStyle.Primary)
          );
        }

        btnRow.addComponents(
          new ButtonBuilder()
            .setCustomId("back_to_my_orders")
            .setLabel("🔙 Kembali ke Riwayat")
            .setStyle(ButtonStyle.Secondary)
        );

        components.push(btnRow);
        await selectMenu.editReply({ embeds: [embed], components });
        return;
      }
    }

    // -------------------------------------------------------------------------
    // 2. BUTTON INTERACTIONS
    // -------------------------------------------------------------------------
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const customId = btn.customId;

      // A. Navigasi Halaman Katalog
      if (customId.startsWith("nav_page_")) {
        await btn.deferUpdate();
        const parts = customId.replace("nav_page_", "").split("_");
        const categoryId = parts[0] === "all" ? null : parseInt(parts[0], 10);
        const page = parseInt(parts[1], 10) || 1;
        const catalogMsg = await buildCatalogMessage(categoryId, page);
        await btn.editReply(catalogMsg);
        return;
      }

      // B. Kembali ke Katalog
      if (customId.startsWith("back_catalog_")) {
        await btn.deferUpdate();
        const parts = customId.replace("back_catalog_", "").split("_");
        const categoryId = parts[0] === "all" ? null : parseInt(parts[0], 10);
        const page = parseInt(parts[1], 10) || 1;
        const catalogMsg = await buildCatalogMessage(categoryId, page);
        await btn.editReply(catalogMsg);
        return;
      }

      // C. Kembali ke Riwayat Pesanan Saya
      if (customId === "back_to_my_orders" || customId === "refresh_my_orders") {
        await btn.deferUpdate();
        const ordersMsg = await buildUserOrdersMessage(btn.user.id);
        await btn.editReply(ordersMsg);
        return;
      }

      // D. Buka Katalog dari Riwayat / Help
      if (customId === "open_catalog_from_orders" || customId === "open_catalog_from_help") {
        await btn.deferReply({ ephemeral: true });
        const catalogMsg = await buildCatalogMessage(null, 1);
        await btn.editReply(catalogMsg);
        return;
      }

      // E. TOMBOL "BELI SEKARANG" (CHECKOUT QRIS)
      if (customId.startsWith("buy_")) {
        const productId = parseInt(customId.replace("buy_", ""), 10);
        await btn.deferReply({ ephemeral: true });

        try {
          // Buat pesanan di backend
          const orderRes = await apiClient.createBotOrder(productId, btn.user.id, 1);
          const orderData = orderRes.data;
          const payment = orderData.payment;

          // Siapkan buffer gambar QRIS
          let qrBuffer: Buffer | null = null;
          if (payment.qrString) {
            qrBuffer = await generateQrBuffer(payment.qrString);
          }

          const qrisAttachment = qrBuffer
            ? new AttachmentBuilder(qrBuffer, { name: `qris-${orderData.orderNumber}.png` })
            : null;

          const expiryText = payment.expiryTime ? formatDate(payment.expiryTime) : "15 Menit";

          const qrisEmbed = new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle(`🧾 Pembayaran QRIS — #${orderData.orderNumber}`)
            .setDescription(
              `Pesanan berhasil dibuat untuk produk **${orderData.productName}**!\n` +
              `Silakan scan kode QRIS di bawah ini dengan aplikasi e-wallet atau mobile banking favorit Anda.\n\n` +
              `💰 **Total Tagihan:** \`${formatRupiah(orderData.totalAmount)}\`\n` +
              `⏱️ **Batas Waktu Pembayaran:** \`${expiryText}\`\n` +
              `🔖 **Nomor Pesanan:** \`${orderData.orderNumber}\``
            )
            .addFields(
              {
                name: "📱 Cara Membayar",
                value: 
                  "1. Buka aplikasi **GoPay / OVO / Dana / ShopeePay / BCA / Mandiri / Livin / Mobile Banking** lainnya.\n" +
                  "2. Pilih menu **Scan QRIS**.\n" +
                  "3. Arahkan kamera ke kode QR di bawah dan selesaikan transaksi.\n" +
                  "4. Pembayaran akan terkonfirmasi otomatis dalam hitungan detik!",
                inline: false,
              },
              {
                name: "⚡ Pengiriman Otomatis ke DM",
                value: "Setelah pembayaran berhasil diverifikasi, sistem akan langsung mengirimkan detail akun ke **DM Discord** Anda secara privat.",
                inline: false,
              },
              ...(payment.qrCodeUrl ? [{
                name: "🧪 URL Simulasi Midtrans Sandbox",
                value: `Salin URL di bawah ini lalu paste ke simulator Midtrans:\n\`\`\`\n${payment.qrCodeUrl}\n\`\`\``,
                inline: false,
              }] : [])
            )
            .setFooter({
              text: `${config.storeName} • Pembayaran resmi Midtrans QRIS`,
            })
            .setTimestamp();

          if (payment.qrCodeUrl) {
            qrisEmbed.setImage(payment.qrCodeUrl);
          } else if (qrisAttachment) {
            qrisEmbed.setImage(`attachment://qris-${orderData.orderNumber}.png`);
          }

          const actionButtons: ButtonBuilder[] = [
            new ButtonBuilder()
              .setCustomId(`check_status_${orderData.orderNumber}`)
              .setLabel("🔄 Cek Status Pembayaran")
              .setStyle(ButtonStyle.Primary),
          ];

          if (payment.qrCodeUrl) {
            actionButtons.push(
              new ButtonBuilder()
                .setLabel("🧪 Buka Simulator Midtrans")
                .setStyle(ButtonStyle.Link)
                .setURL("https://simulator.sandbox.midtrans.com/qris/index")
            );
          }

          actionButtons.push(
            new ButtonBuilder()
              .setCustomId("open_catalog_from_orders")
              .setLabel("🛍️ Belanja Produk Lain")
              .setStyle(ButtonStyle.Secondary)
          );

          const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(actionButtons);

          await btn.editReply({
            embeds: [qrisEmbed],
            components: [actionRow],
            files: qrisAttachment ? [qrisAttachment] : [],
          });
        } catch (err: any) {
          console.error("❌ Gagal memproses pembelian via bot:", err);
          await btn.editReply({
            content: `❌ **Gagal membuat pesanan:** ${err.message || "Terjadi kesalahan pada sistem backend."}`,
            components: [],
          });
        }
        return;
      }

      // F. CEK STATUS PEMBAYARAN
      if (customId.startsWith("check_status_")) {
        const orderNumber = customId.replace("check_status_", "");
        await btn.deferReply({ ephemeral: true });

        const order = await apiClient.getOrderDetail(orderNumber);
        if (!order) {
          await btn.editReply({ content: "⚠️ Pesanan tidak ditemukan.", components: [] });
          return;
        }

        const status = formatStatusBadge(order.status);
        const firstItem = order.items && order.items[0];
        const productName = firstItem?.productName || "Produk Digital";

        if (order.status === "completed") {
          const embed = new EmbedBuilder()
            .setColor(COLORS.success)
            .setTitle(`🎉 Pembayaran Dikonfirmasi — #${order.orderNumber}`)
            .setDescription(
              `Pembayaran Anda sebesar **${formatRupiah(order.totalAmount)}** telah berhasil diverifikasi!\n` +
              `Produk **${productName}** telah selesai diproses dan detail akun dikirimkan ke DM Discord Anda.`
            )
            .setFooter({ text: config.storeName })
            .setTimestamp();

          // Jika ada kredensial, sertakan tombol tampilkan kredensial langsung
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`view_creds_${order.id}`)
              .setLabel("👁️ Lihat Detail Akun Di Sini")
              .setStyle(ButtonStyle.Success)
          );

          await btn.editReply({ embeds: [embed], components: [row] });
          return;
        }

        if (order.status === "paid" || order.status === "processing") {
          const embed = new EmbedBuilder()
            .setColor(COLORS.primary)
            .setTitle(`⏳ Sedang Diproses — #${order.orderNumber}`)
            .setDescription(
              `Pembayaran telah diterima! Sistem kami sedang memproses akun digital Anda secara otomatis ke penyedia.\n` +
              `Harap tunggu 1-2 menit, kredensial akan otomatis meluncur ke DM Anda.`
            )
            .setFooter({ text: config.storeName })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`check_status_${order.orderNumber}`)
              .setLabel("🔄 Cek Lagi")
              .setStyle(ButtonStyle.Primary)
          );

          await btn.editReply({ embeds: [embed], components: [row] });
          return;
        }

        if (order.status === "waiting_payment") {
          const embed = new EmbedBuilder()
            .setColor(COLORS.warning)
            .setTitle(`🟡 Menunggu Pembayaran — #${order.orderNumber}`)
            .setDescription(
              `Kami belum mendeteksi pembayaran untuk pesanan ini.\n` +
              `Silakan selesaikan scan QRIS di aplikasi e-wallet / mobile banking Anda senilai **${formatRupiah(order.totalAmount)}**.\n\n` +
              `Setelah transfer berhasil, klik tombol **Cek Status Pembayaran** kembali.`
            )
            .setFooter({ text: config.storeName })
            .setTimestamp();

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(`check_status_${order.orderNumber}`)
              .setLabel("🔄 Cek Status Lagi")
              .setStyle(ButtonStyle.Primary)
          );

          await btn.editReply({ embeds: [embed], components: [row] });
          return;
        }

        // Status failed / expired
        const embed = new EmbedBuilder()
          .setColor(COLORS.danger)
          .setTitle(`❌ Status: ${status.label} — #${order.orderNumber}`)
          .setDescription(`Pesanan ini berstatus **${status.label}**. Silakan buat pesanan baru melalui command \`/produk\`.`)
          .setFooter({ text: config.storeName });

        await btn.editReply({ embeds: [embed], components: [] });
        return;
      }

      // G. TAMPILKAN KREDENSIAL AKUN LANGSUNG DI DISCORD (EPHEMERAL)
      if (customId.startsWith("view_creds_")) {
        const orderId = parseInt(customId.replace("view_creds_", ""), 10);
        await btn.deferReply({ ephemeral: true });

        // Ambil user orders untuk memastikan kepemilikan
        const userOrders = await apiClient.getUserOrders(btn.user.id);
        const order = userOrders.find((o) => o.id === orderId);

        if (!order || !order.deliveries || order.deliveries.length === 0) {
          await btn.editReply({
            content: "⚠️ Kredensial akun belum tersedia atau pesanan tidak cocok dengan akun Anda.",
          });
          return;
        }

        const delivery = order.deliveries[0];
        const formatted = formatCredentialsContent(delivery.content);

        const embed = new EmbedBuilder()
          .setColor(COLORS.success)
          .setTitle(`🔑 Detail Akun — #${order.orderNumber}`)
          .setDescription(
            `Produk: **${delivery.productName}**\n` +
            `Waktu Pengiriman: ${formatDate(delivery.deliveredAt)}\n\n` +
            formatted.summary
          )
          .setFooter({ text: `${config.storeName} • Jangan bagikan data ini kepada siapa pun` })
          .setTimestamp();

        for (const f of formatted.fields) {
          embed.addFields(f);
        }

        await btn.editReply({ embeds: [embed] });
        return;
      }
    }
  } catch (err: any) {
    console.error("❌ Error handling interaction:", err);
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: `⚠️ Terjadi kendala teknis: ${err.message || "Unknown error"}`,
          ephemeral: true,
        }).catch(() => {});
      } else {
        await interaction.reply({
          content: `⚠️ Terjadi kendala teknis: ${err.message || "Unknown error"}`,
          ephemeral: true,
        }).catch(() => {});
      }
    }
  }
}
