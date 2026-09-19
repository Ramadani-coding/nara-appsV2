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
import { apiClient, type Product, type ProductCategory } from "../api/client.js";
import { COLORS, formatRupiah } from "../utils/formatters.js";
import { config } from "../config.js";

export const data = new SlashCommandBuilder()
  .setName("produk")
  .setDescription("Jelajahi katalog produk digital premium Nara Store");

const ITEMS_PER_PAGE = 5;

/**
 * Membangun pesan katalog produk (embed + selector kategori + navigasi paging + selector produk)
 */
export async function buildCatalogMessage(selectedCategoryId: number | null = null, page = 1) {
  const [categories, allProducts] = await Promise.all([
    apiClient.getCategories(),
    apiClient.getProducts(),
  ]);

  // Filter produk berdasarkan kategori jika ada
  let filteredProducts = allProducts;
  let activeCategoryName = "Semua Kategori";

  if (selectedCategoryId) {
    filteredProducts = allProducts.filter((p) => p.categoryId === selectedCategoryId);
    const cat = categories.find((c) => c.id === selectedCategoryId);
    if (cat) activeCategoryName = cat.name;
  }

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const currentPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Buat embed katalog produk
  const embed = new EmbedBuilder()
    .setColor(COLORS.primary)
    .setTitle(`🛍️ Katalog Produk — ${config.storeName}`)
    .setDescription(
      `Pilih produk digital premium favorit Anda. Transaksi diproses otomatis 24/7 menggunakan QRIS!\n\n` +
      `📂 **Kategori:** \`${activeCategoryName}\`\n` +
      `📊 **Menampilkan:** \`${totalItems === 0 ? 0 : startIndex + 1}-${Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}\` dari \`${totalItems}\` produk\n` +
      `📄 **Halaman:** \`${currentPage} / ${totalPages}\``
    )
    .setFooter({
      text: `${config.storeName} • Pembayaran QRIS Instan & Garansi Akun`,
    })
    .setTimestamp();

  if (pageProducts.length === 0) {
    embed.addFields({
      name: "Belum Ada Produk",
      value: "Saat ini belum ada produk aktif pada kategori ini.",
    });
  } else {
    for (const prod of pageProducts) {
      const stockBadge =
        prod.stockStatus === "empty" || prod.stockCount <= 0 || prod.isMaintenance
          ? "🔴 Habis / Perbaikan"
          : `🟢 Stok: ${prod.stockCount} akun`;

      const priceText = prod.originalPrice && prod.originalPrice > prod.price
        ? `~~${formatRupiah(prod.originalPrice)}~~ **${formatRupiah(prod.price)}**`
        : `**${formatRupiah(prod.price)}**`;

      embed.addFields({
        name: `${prod.name}`,
        value: `💵 Harga: ${priceText} | ${stockBadge}\n📝 ${prod.description ? (prod.description.length > 85 ? prod.description.substring(0, 82) + "..." : prod.description) : "Akun premium berkualitas & bergaransi."}`,
        inline: false,
      });
    }
  }

  const components: ActionRowBuilder<any>[] = [];

  // 1. Dropdown Kategori
  if (categories.length > 0) {
    const categoryOptions = [
      new StringSelectMenuOptionBuilder()
        .setLabel("Semua Kategori")
        .setValue("cat_all")
        .setDescription("Tampilkan semua produk digital")
        .setDefault(selectedCategoryId === null),
      ...categories.slice(0, 24).map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(c.name.substring(0, 25))
          .setValue(`cat_${c.id}`)
          .setDescription(`Produk kategori ${c.name}`.substring(0, 50))
          .setDefault(selectedCategoryId === c.id)
      ),
    ];

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId("select_category")
      .setPlaceholder("🔍 Filter Kategori...")
      .addOptions(categoryOptions);

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect));
  }

  // 2. Dropdown Pilih Produk untuk Lihat Detail & Beli
  if (pageProducts.length > 0) {
    const productOptions = pageProducts.map((p) => {
      const isAvailable = p.stockStatus !== "empty" && p.stockCount > 0 && !p.isMaintenance;
      return new StringSelectMenuOptionBuilder()
        .setLabel(p.name.substring(0, 50))
        .setValue(`prod_${p.id}`)
        .setDescription(`${formatRupiah(p.price)} • ${isAvailable ? "Tersedia" : "Habis"}`)
        .setEmoji(isAvailable ? "🛒" : "⚠️");
    });

    const productSelect = new StringSelectMenuBuilder()
      .setCustomId("select_product")
      .setPlaceholder("👉 Pilih produk untuk melihat rincian & beli...")
      .addOptions(productOptions);

    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(productSelect));
  }

  // 3. Tombol Navigasi Paging (Prev / Next)
  const prevBtn = new ButtonBuilder()
    .setCustomId(`nav_page_${selectedCategoryId || "all"}_${currentPage - 1}`)
    .setLabel("◀ Sebelumnya")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage <= 1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`nav_page_${selectedCategoryId || "all"}_${currentPage + 1}`)
    .setLabel("Selanjutnya ▶")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages);

  const refreshBtn = new ButtonBuilder()
    .setCustomId(`nav_page_${selectedCategoryId || "all"}_${currentPage}`)
    .setLabel("🔄 Refresh")
    .setStyle(ButtonStyle.Secondary);

  const websiteBtn = new ButtonBuilder()
    .setLabel("🌐 Buka Web Store")
    .setStyle(ButtonStyle.Link)
    .setURL(config.storeUrl);

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, refreshBtn, nextBtn, websiteBtn);
  components.push(navRow);

  return { embeds: [embed], components };
}

/**
 * Membangun pesan detail produk tunggal dengan tombol "🛒 Beli Sekarang"
 */
export function buildProductDetailMessage(product: Product, backCategoryId: number | null = null, backPage = 1) {
  const isAvailable = product.stockStatus !== "empty" && product.stockCount > 0 && !product.isMaintenance;

  const embed = new EmbedBuilder()
    .setColor(isAvailable ? COLORS.accent : COLORS.neutral)
    .setTitle(`📦 ${product.name}`)
    .setDescription(product.description || "Tidak ada deskripsi rinci untuk produk ini.")
    .addFields(
      {
        name: "💵 Harga Jual",
        value: product.originalPrice && product.originalPrice > product.price
          ? `~~${formatRupiah(product.originalPrice)}~~ **${formatRupiah(product.price)}** (Diskon!)`
          : `**${formatRupiah(product.price)}**`,
        inline: true,
      },
      {
        name: "📊 Ketersediaan Stok",
        value: isAvailable
          ? `🟢 **Tersedia** (${product.stockCount} akun)`
          : "🔴 **Stok Habis / Dalam Pemeliharaan**",
        inline: true,
      },
      {
        name: "📂 Kategori",
        value: product.category?.name || "Umum",
        inline: true,
      },
      {
        name: "⚡ Pemrosesan",
        value: "Otomatis & Instan via QRIS Midtrans (dikirim ke DM Discord)",
        inline: false,
      }
    )
    .setFooter({
      text: `${config.storeName} • Pembelian aman & terenkripsi`,
    })
    .setTimestamp();

  if (product.imageUrl && product.imageUrl.startsWith("http")) {
    embed.setImage(product.imageUrl);
  }

  const buyBtn = new ButtonBuilder()
    .setCustomId(`buy_${product.id}`)
    .setLabel(isAvailable ? "🛒 Beli Sekarang (QRIS)" : "⚠️ Stok Habis")
    .setStyle(isAvailable ? ButtonStyle.Success : ButtonStyle.Secondary)
    .setDisabled(!isAvailable);

  const backBtn = new ButtonBuilder()
    .setCustomId(`back_catalog_${backCategoryId || "all"}_${backPage}`)
    .setLabel("🔙 Kembali ke Katalog")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buyBtn, backBtn);

  return { embeds: [embed], components: [row] };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const catalog = await buildCatalogMessage(null, 1);
  await interaction.editReply(catalog);
}
