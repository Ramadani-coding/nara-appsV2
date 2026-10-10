import { db } from "../db/index.js";
import { vouchers, products, type Voucher } from "../db/schema.js";
import { eq, and, or, sql, desc, gte, lte } from "drizzle-orm";

export interface VoucherDiscountCalculation {
  voucher: Voucher;
  nominalDiscount: number;
  effectiveDiscount: number;
  isCappedByMargin: boolean;
  maxAllowedDiscount: number;
  totalSellingPrice: number;
  finalAmount: number;
  isEligible: boolean;
  ineligibilityReason?: string;
}

export class VoucherService {
  /**
   * Menghitung potongan harga voucher secara aman dengan Proteksi Margin Anti-Rugi.
   * Diskon tidak boleh melebihi keuntungan bersih (margin) produk terhadap HPP supplier.
   */
  calculateDiscount(
    voucher: Voucher,
    product: {
      price: number;
      providerPrice?: number | null;
      marginValue?: number | null;
    },
    quantity: number = 1
  ): VoucherDiscountCalculation {
    const qty = Math.max(1, quantity);
    const totalSellingPrice = product.price * qty;

    // 1. Tentukan modal supplier (HPP) riil
    let unitCost = 0;
    if (product.providerPrice !== undefined && product.providerPrice !== null && product.providerPrice > 0) {
      unitCost = product.providerPrice;
    } else if (product.marginValue !== undefined && product.marginValue !== null && product.marginValue > 0) {
      unitCost = Math.max(0, product.price - product.marginValue);
    } else {
      // Fallback aman: jika tidak ada data modal, anggap margin 0 demi mencegah risiko
      unitCost = product.price;
    }

    const totalCost = unitCost * qty;
    // Total margin riil yang tersedia pada transaksi ini
    const totalMargin = Math.max(0, totalSellingPrice - totalCost);

    // Proteksi batas laba minimum yang wajib disisakan (default 0)
    const minProtection = Math.max(0, (voucher.minMarginProtection || 0) * qty);
    const maxAllowedDiscount = Math.max(0, totalMargin - minProtection);

    // 2. Hitung diskon nominal berdasarkan persentase
    let nominalDiscount = Math.round((totalSellingPrice * voucher.discountPercent) / 100);

    // Batasi jika admin mengatur plafon diskon maksimum dalam Rupiah
    if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) {
      nominalDiscount = Math.min(nominalDiscount, voucher.maxDiscountAmount);
    }

    // 3. PROTEKSI MARGIN ANTI-RUGI:
    // Potongan harga efektif TIDAK BOLEH melebihi maxAllowedDiscount (margin produk)
    const effectiveDiscount = Math.min(nominalDiscount, maxAllowedDiscount);
    const isCappedByMargin = effectiveDiscount < nominalDiscount && maxAllowedDiscount > 0;
    const finalAmount = Math.max(1, totalSellingPrice - effectiveDiscount);

    // 4. Validasi Kelayakan (Eligibility)
    const now = new Date();
    let isEligible = true;
    let ineligibilityReason: string | undefined = undefined;

    if (!voucher.isActive) {
      isEligible = false;
      ineligibilityReason = "Voucher sedang dinonaktifkan oleh administrator";
    } else if (now < new Date(voucher.startDate)) {
      isEligible = false;
      ineligibilityReason = "Periode voucher belum dimulai";
    } else if (now > new Date(voucher.endDate)) {
      isEligible = false;
      ineligibilityReason = "Masa berlaku voucher telah berakhir (expired)";
    } else if (voucher.usedCount >= voucher.maxUsage) {
      isEligible = false;
      ineligibilityReason = "Kuota pemakaian voucher telah habis";
    } else if (totalSellingPrice < voucher.minPurchaseAmount) {
      isEligible = false;
      ineligibilityReason = `Minimal pembelian Rp ${voucher.minPurchaseAmount.toLocaleString("id-ID")}`;
    } else if (maxAllowedDiscount <= 0 || effectiveDiscount <= 0) {
      isEligible = false;
      ineligibilityReason = "Margin produk tidak mencukupi untuk diskon voucher ini (proteksi anti-rugi)";
    }

    return {
      voucher,
      nominalDiscount,
      effectiveDiscount: isEligible ? effectiveDiscount : 0,
      isCappedByMargin,
      maxAllowedDiscount,
      totalSellingPrice,
      finalAmount: isEligible ? finalAmount : totalSellingPrice,
      isEligible,
      ineligibilityReason,
    };
  }

  /**
   * Mengambil daftar voucher yang sedang aktif untuk pelanggan (public)
   * Dilengkapi kalkulasi diskon kontekstual jika productId, packageId, atau harga disertakan.
   */
  async getAvailableVouchersForCustomer(
    productId?: number,
    quantity: number = 1,
    packageIdOrProviderId?: string,
    fallbackPrice?: number,
    fallbackProviderPrice?: number
  ) {
    const now = new Date();

    const activeVouchers = await db.query.vouchers.findMany({
      where: and(
        eq(vouchers.isActive, true),
        lte(vouchers.startDate, now),
        gte(vouchers.endDate, now)
      ),
      orderBy: [desc(vouchers.discountPercent)],
    });

    // 1. Cari produk berdasarkan database ID (products.id)
    let targetProduct: any = null;
    if (productId && !isNaN(productId) && productId > 0) {
      targetProduct = await db.query.products.findFirst({
        where: eq(products.id, productId),
      });
    }

    // 2. Jika belum ditemukan, cari berdasarkan providerServiceId (misal "16" atau "aplikasi-ai-16")
    if (!targetProduct && packageIdOrProviderId) {
      const provStr = String(packageIdOrProviderId).trim();
      // Ekstrak digit angka dari identifier paket jika ada (misal "aplikasi-ai-16" -> "16")
      const trailingNumberMatch = provStr.match(/(\d+)$/);
      const cleanNumericId = trailingNumberMatch ? trailingNumberMatch[1] : null;

      targetProduct = await db.query.products.findFirst({
        where: or(
          eq(products.providerServiceId, provStr),
          cleanNumericId ? eq(products.providerServiceId, cleanNumericId) : undefined
        ),
      });
    }

    // 3. Fallback jika produk belum tersinkron di DB lokal tapi harga valid dari UI checkout
    if (!targetProduct && fallbackPrice && !isNaN(fallbackPrice) && fallbackPrice > 0) {
      const unitCost = fallbackProviderPrice && !isNaN(fallbackProviderPrice) && fallbackProviderPrice > 0
        ? fallbackProviderPrice
        : Math.round(fallbackPrice * 0.7); // Estimasi modal wajar

      targetProduct = {
        id: productId || 0,
        price: fallbackPrice,
        providerPrice: unitCost,
        marginValue: Math.max(0, fallbackPrice - unitCost),
        name: "Produk Pilihan",
      };
    }

    return activeVouchers.map((v) => {
      const remainingUsage = Math.max(0, v.maxUsage - v.usedCount);
      const isQuotaAvailable = remainingUsage > 0;

      if (!targetProduct) {
        return {
          id: v.id,
          code: v.code,
          name: v.name,
          description: v.description,
          discountPercent: v.discountPercent,
          maxDiscountAmount: v.maxDiscountAmount,
          minPurchaseAmount: v.minPurchaseAmount,
          maxUsage: v.maxUsage,
          usedCount: v.usedCount,
          remainingUsage,
          startDate: v.startDate,
          endDate: v.endDate,
          isActive: v.isActive,
          isEligible: isQuotaAvailable,
          ineligibilityReason: isQuotaAvailable ? undefined : "Kuota pemakaian voucher telah habis",
          calculatedDiscount: 0,
          effectiveDiscount: 0,
          isCappedByMargin: false,
        };
      }

      const calc = this.calculateDiscount(v, targetProduct, quantity);

      return {
        id: v.id,
        code: v.code,
        name: v.name,
        description: v.description,
        discountPercent: v.discountPercent,
        maxDiscountAmount: v.maxDiscountAmount,
        minPurchaseAmount: v.minPurchaseAmount,
        maxUsage: v.maxUsage,
        usedCount: v.usedCount,
        remainingUsage,
        startDate: v.startDate,
        endDate: v.endDate,
        isActive: v.isActive,
        isEligible: calc.isEligible && isQuotaAvailable,
        ineligibilityReason: calc.ineligibilityReason || (!isQuotaAvailable ? "Kuota voucher telah habis" : undefined),
        calculatedDiscount: calc.nominalDiscount,
        effectiveDiscount: calc.effectiveDiscount,
        isCappedByMargin: calc.isCappedByMargin,
        maxAllowedDiscount: calc.maxAllowedDiscount,
      };
    });
  }

  /**
   * Mengambil semua voucher untuk dashboard admin (termasuk yang nonaktif & kadaluarsa)
   */
  async getAllVouchersAdmin() {
    return await db.query.vouchers.findMany({
      orderBy: [desc(vouchers.createdAt)],
    });
  }

  /**
   * Menambahkan voucher baru oleh admin
   */
  async createVoucher(data: {
    code: string;
    name: string;
    description?: string;
    discountPercent: number;
    maxDiscountAmount?: number | null;
    minPurchaseAmount?: number;
    maxUsage: number;
    startDate: Date;
    endDate: Date;
    minMarginProtection?: number;
    isActive?: boolean;
  }) {
    const cleanCode = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanCode) {
      throw new Error("Kode voucher tidak valid");
    }

    const [created] = await db
      .insert(vouchers)
      .values({
        code: cleanCode,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        discountPercent: Math.min(100, Math.max(1, Math.round(data.discountPercent))),
        maxDiscountAmount: data.maxDiscountAmount ? Math.max(0, Math.round(data.maxDiscountAmount)) : null,
        minPurchaseAmount: Math.max(0, Math.round(data.minPurchaseAmount || 0)),
        maxUsage: Math.max(1, Math.round(data.maxUsage || 100)),
        usedCount: 0,
        startDate: data.startDate,
        endDate: data.endDate,
        minMarginProtection: Math.max(0, Math.round(data.minMarginProtection || 0)),
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      })
      .returning();

    return created;
  }

  /**
   * Memperbarui voucher oleh admin
   */
  async updateVoucher(
    id: number,
    data: {
      code?: string;
      name?: string;
      description?: string;
      discountPercent?: number;
      maxDiscountAmount?: number | null;
      minPurchaseAmount?: number;
      maxUsage?: number;
      startDate?: Date;
      endDate?: Date;
      minMarginProtection?: number;
      isActive?: boolean;
    }
  ) {
    const existing = await db.query.vouchers.findFirst({
      where: eq(vouchers.id, id),
    });

    if (!existing) {
      throw new Error("Voucher tidak ditemukan");
    }

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.code) {
      updateData.code = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    }
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.discountPercent !== undefined) {
      updateData.discountPercent = Math.min(100, Math.max(1, Math.round(data.discountPercent)));
    }
    if (data.maxDiscountAmount !== undefined) {
      updateData.maxDiscountAmount = data.maxDiscountAmount ? Math.max(0, Math.round(data.maxDiscountAmount)) : null;
    }
    if (data.minPurchaseAmount !== undefined) {
      updateData.minPurchaseAmount = Math.max(0, Math.round(data.minPurchaseAmount));
    }
    if (data.maxUsage !== undefined) {
      updateData.maxUsage = Math.max(existing.usedCount, Math.round(data.maxUsage));
    }
    if (data.startDate !== undefined) updateData.startDate = data.startDate;
    if (data.endDate !== undefined) updateData.endDate = data.endDate;
    if (data.minMarginProtection !== undefined) {
      updateData.minMarginProtection = Math.max(0, Math.round(data.minMarginProtection));
    }
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

    const [updated] = await db
      .update(vouchers)
      .set(updateData)
      .where(eq(vouchers.id, id))
      .returning();

    return updated;
  }

  /**
   * Menghapus voucher oleh admin
   */
  async deleteVoucher(id: number) {
    const existing = await db.query.vouchers.findFirst({
      where: eq(vouchers.id, id),
    });

    if (!existing) {
      throw new Error("Voucher tidak ditemukan");
    }

    await db.delete(vouchers).where(eq(vouchers.id, id));
    return { success: true, message: `Voucher ${existing.code} berhasil dihapus` };
  }

  /**
   * Mengubah status aktif/nonaktif voucher
   */
  async toggleVoucherStatus(id: number) {
    const existing = await db.query.vouchers.findFirst({
      where: eq(vouchers.id, id),
    });

    if (!existing) {
      throw new Error("Voucher tidak ditemukan");
    }

    const [updated] = await db
      .update(vouchers)
      .set({
        isActive: !existing.isActive,
        updatedAt: new Date(),
      })
      .where(eq(vouchers.id, id))
      .returning();

    return updated;
  }
}

export const voucherService = new VoucherService();
