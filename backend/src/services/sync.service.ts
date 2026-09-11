import { db } from "../db/index.js";
import { productCategories, products } from "../db/schema.js";
import { premiumkuService, type PremiumkuProduct } from "./premiumku.service.js";
import { eq } from "drizzle-orm";

export const DEFAULT_CATEGORIES = [
  { name: "Desain & Kreatif", slug: "desain-kreatif" },
  { name: "Video & Multimedia", slug: "video-multimedia" },
  { name: "Streaming & Film", slug: "streaming-film" },
  { name: "Musik & Audio", slug: "musik-audio" },
  { name: "AI & Produktivitas", slug: "ai-produktivitas" },
  { name: "VPN & Utilitas", slug: "vpn-utilitas" },
  { name: "Lainnya", slug: "lainnya" },
];

/**
 * Mendeteksi slug kategori yang cocok berdasarkan nama produk
 */
export function categorizeProduct(name: string, productType: string): string {
  const combined = `${name} ${productType}`.toLowerCase();

  if (combined.includes("canva") || combined.includes("alight") || combined.includes("am exp")) {
    return "desain-kreatif";
  }
  if (combined.includes("capcut") || combined.includes("wink") || combined.includes("video edit")) {
    return "video-multimedia";
  }
  if (
    combined.includes("viu") ||
    combined.includes("netflix") ||
    combined.includes("prime") ||
    combined.includes("vidio") ||
    combined.includes("vd mobile") ||
    combined.includes("wetv") ||
    combined.includes("disney") ||
    combined.includes("drama") ||
    combined.includes("streaming")
  ) {
    return "streaming-film";
  }
  if (combined.includes("spotify") || combined.includes("youtube") || combined.includes("yt") || combined.includes("musik")) {
    return "musik-audio";
  }
  if (combined.includes("gemini") || combined.includes("chatgpt") || combined.includes("gpt") || combined.includes("ai")) {
    return "ai-produktivitas";
  }
  if (combined.includes("vpn") || combined.includes("hma")) {
    return "vpn-utilitas";
  }
  return "lainnya";
}

export class SyncService {
  /**
   * Menyiapkan kategori default jika belum ada
   */
  async ensureCategories(): Promise<Map<string, number>> {
    const categoryMap = new Map<string, number>();

    // Ambil kategori yang sudah tersimpan
    const existing = await db.select().from(productCategories);
    for (const cat of existing) {
      categoryMap.set(cat.slug, cat.id);
    }

    // Masukkan kategori default yang belum ada
    for (const def of DEFAULT_CATEGORIES) {
      if (!categoryMap.has(def.slug)) {
        const [inserted] = await db
          .insert(productCategories)
          .values(def)
          .returning({ id: productCategories.id, slug: productCategories.slug });
        categoryMap.set(inserted.slug, inserted.id);
      }
    }

    return categoryMap;
  }

  /**
   * Mengambil semua produk dari API Premiumku dan menyinkronkannya ke database PostgreSQL
   */
  async syncProductsFromProvider() {
    console.log("🔄 Memulai sinkronisasi produk dari API Premiumku...");
    const rawProducts: PremiumkuProduct[] = await premiumkuService.fetchProducts();
    console.log(`📦 Ditemukan ${rawProducts.length} produk dari Premiumku.`);

    const categoryMap = await this.ensureCategories();

    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of rawProducts) {
      const providerServiceId = item.id.toString();
      const slugCategory = categorizeProduct(item.name, item.product_type || "");
      const categoryId = categoryMap.get(slugCategory) || categoryMap.get("lainnya") || null;

      // Cek apakah produk sudah ada di database
      const [existingProduct] = await db
        .select()
        .from(products)
        .where(eq(products.providerServiceId, providerServiceId));

      const marginValue = existingProduct?.marginValue ?? 0;
      const providerPrice = item.price;
      const finalPrice = providerPrice + marginValue;

      const payload = {
        categoryId,
        providerServiceId,
        name: item.name,
        description: item.description || "",
        productType: item.product_type || item.name,
        providerPrice: providerPrice,
        marginValue: marginValue,
        price: finalPrice,
        originalPrice: item.original_price || Math.round(finalPrice * 1.5),
        stockStatus: item.stock > 0 ? "available" : "empty",
        stockCount: item.stock,
        imageUrl: item.image,
        isActive: existingProduct ? existingProduct.isActive : true,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existingProduct) {
        await db
          .update(products)
          .set(payload)
          .where(eq(products.id, existingProduct.id));
        updatedCount++;
      } else {
        await db
          .insert(products)
          .values({
            ...payload,
            createdAt: new Date(),
          });
        insertedCount++;
      }
    }

    console.log(`✅ Sinkronisasi selesai: ${insertedCount} produk baru ditambahkan, ${updatedCount} diperbarui.`);
    return {
      total: rawProducts.length,
      inserted: insertedCount,
      updated: updatedCount,
    };
  }
}

export const syncService = new SyncService();
