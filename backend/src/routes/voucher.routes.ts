import { Router, type Request, type Response } from "express";
import { voucherService } from "../services/voucher.service.js";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";
import { adminAuthLimiter } from "../middleware/rateLimiter.js";

// ============================================================================
// 1. PUBLIC VOUCHER ROUTES (Untuk Halaman Checkout / Konfirmasi Pesanan)
// ============================================================================
export const publicVoucherRouter = Router();

/**
 * GET /api/vouchers/available
 * Mengambil daftar voucher yang aktif & tersedia untuk dipilih pembeli di checkout.
 * Menerima query parameter productId dan quantity untuk kalkulasi estimasi diskon riil.
 */
publicVoucherRouter.get("/available", async (req: Request, res: Response) => {
  try {
    const productId = req.query.productId ? Number(req.query.productId) : undefined;
    const quantity = req.query.quantity ? Number(req.query.quantity) : 1;
    const packageId = req.query.packageId ? String(req.query.packageId) : undefined;
    const providerId = req.query.providerId ? String(req.query.providerId) : undefined;
    const price = req.query.price ? Number(req.query.price) : undefined;
    const providerPrice = req.query.providerPrice ? Number(req.query.providerPrice) : undefined;

    const available = await voucherService.getAvailableVouchersForCustomer(
      productId,
      quantity,
      providerId || packageId,
      price,
      providerPrice
    );

    res.json({
      success: true,
      data: available,
    });
  } catch (error: any) {
    console.error("Error fetching available vouchers:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil daftar voucher promo",
      data: [],
    });
  }
});

// ============================================================================
// 2. ADMIN VOUCHER ROUTES (Kelola Voucher Back-Office)
// ============================================================================
export const adminVoucherRouter = Router();

// Proteksi Autentikasi Admin & Rate Limiting
adminVoucherRouter.use(adminAuthLimiter);
adminVoucherRouter.use(adminAuthMiddleware);

/**
 * GET /api/admin/vouchers
 * Mengambil semua voucher (aktif, nonaktif, kadaluarsa) beserta kuota dan statistik pemakaian
 */
adminVoucherRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const list = await voucherService.getAllVouchersAdmin();
    res.json({
      success: true,
      data: list,
    });
  } catch (error: any) {
    console.error("Error fetching admin vouchers:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengambil data voucher",
    });
  }
});

/**
 * POST /api/admin/vouchers
 * Membuat voucher baru dengan persentase potongan harga, kuota pemakaian, dan periode ketersediaan
 */
adminVoucherRouter.post("/", async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      description,
      discountPercent,
      maxDiscountAmount,
      minPurchaseAmount,
      maxUsage,
      startDate,
      endDate,
      minMarginProtection,
      isActive,
    } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: "Kode voucher wajib diisi",
      });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Nama voucher wajib diisi",
      });
    }

    const pct = Number(discountPercent);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      return res.status(400).json({
        success: false,
        message: "Persentase diskon harus berupa angka antara 1% hingga 100%",
      });
    }

    const start = startDate ? new Date(startDate) : new Date();
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Tanggal mulai voucher tidak valid",
      });
    }

    if (!endDate) {
      return res.status(400).json({
        success: false,
        message: "Batas waktu (tanggal berakhir) voucher wajib ditentukan",
      });
    }

    const end = new Date(endDate);
    if (isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({
        success: false,
        message: "Tanggal berakhir harus lebih besar dari tanggal mulai voucher",
      });
    }

    const usage = Number(maxUsage);
    if (isNaN(usage) || usage < 1) {
      return res.status(400).json({
        success: false,
        message: "Batas kali pemakaian (kuota) minimal 1 kali",
      });
    }

    const created = await voucherService.createVoucher({
      code,
      name,
      description,
      discountPercent: pct,
      maxDiscountAmount: maxDiscountAmount !== undefined && maxDiscountAmount !== null && maxDiscountAmount !== "" ? Number(maxDiscountAmount) : null,
      minPurchaseAmount: Number(minPurchaseAmount) || 0,
      maxUsage: usage,
      startDate: start,
      endDate: end,
      minMarginProtection: Number(minMarginProtection) || 0,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
    });

    res.status(201).json({
      success: true,
      message: `Voucher promo ${created.code} berhasil ditambahkan!`,
      data: created,
    });
  } catch (error: any) {
    console.error("Error creating voucher:", error);
    if (error.message?.includes("unique") || error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Kode voucher ini sudah digunakan. Harap gunakan kode lain.",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Gagal membuat voucher baru",
    });
  }
});

/**
 * PUT /api/admin/vouchers/:id
 * Mengedit pengaturan voucher (diskon %, masa berlaku, kuota pemakaian, dll.)
 */
adminVoucherRouter.put("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID voucher tidak valid",
      });
    }

    const {
      code,
      name,
      description,
      discountPercent,
      maxDiscountAmount,
      minPurchaseAmount,
      maxUsage,
      startDate,
      endDate,
      minMarginProtection,
      isActive,
    } = req.body;

    const payload: any = {};
    if (code !== undefined) payload.code = code;
    if (name !== undefined) payload.name = name;
    if (description !== undefined) payload.description = description;
    if (discountPercent !== undefined) {
      const pct = Number(discountPercent);
      if (isNaN(pct) || pct <= 0 || pct > 100) {
        return res.status(400).json({
          success: false,
          message: "Persentase diskon harus berupa angka antara 1% hingga 100%",
        });
      }
      payload.discountPercent = pct;
    }
    if (maxDiscountAmount !== undefined) {
      payload.maxDiscountAmount = maxDiscountAmount === null || maxDiscountAmount === "" ? null : Number(maxDiscountAmount);
    }
    if (minPurchaseAmount !== undefined) {
      payload.minPurchaseAmount = Number(minPurchaseAmount) || 0;
    }
    if (maxUsage !== undefined) {
      const u = Number(maxUsage);
      if (isNaN(u) || u < 1) {
        return res.status(400).json({
          success: false,
          message: "Batas pemakaian minimal 1 kali",
        });
      }
      payload.maxUsage = u;
    }
    if (startDate !== undefined) {
      const s = new Date(startDate);
      if (isNaN(s.getTime())) return res.status(400).json({ success: false, message: "Format tanggal mulai salah" });
      payload.startDate = s;
    }
    if (endDate !== undefined) {
      const e = new Date(endDate);
      if (isNaN(e.getTime())) return res.status(400).json({ success: false, message: "Format tanggal berakhir salah" });
      payload.endDate = e;
    }
    if (minMarginProtection !== undefined) {
      payload.minMarginProtection = Number(minMarginProtection) || 0;
    }
    if (isActive !== undefined) {
      payload.isActive = Boolean(isActive);
    }

    const updated = await voucherService.updateVoucher(id, payload);

    res.json({
      success: true,
      message: `Voucher ${updated.code} berhasil diperbarui!`,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error updating voucher:", error);
    if (error.message?.includes("unique") || error.code === "23505") {
      return res.status(400).json({
        success: false,
        message: "Kode voucher ini sudah digunakan oleh voucher lain.",
      });
    }
    res.status(500).json({
      success: false,
      message: error.message || "Gagal memperbarui voucher",
    });
  }
});

/**
 * DELETE /api/admin/vouchers/:id
 * Menghapus voucher oleh admin
 */
adminVoucherRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID voucher tidak valid",
      });
    }

    const result = await voucherService.deleteVoucher(id);
    res.json(result);
  } catch (error: any) {
    console.error("Error deleting voucher:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal menghapus voucher",
    });
  }
});

/**
 * PATCH /api/admin/vouchers/:id/toggle
 * Mengubah status aktif / nonaktif voucher secara instan
 */
adminVoucherRouter.patch("/:id/toggle", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "ID voucher tidak valid",
      });
    }

    const updated = await voucherService.toggleVoucherStatus(id);
    res.json({
      success: true,
      message: `Status voucher ${updated.code} diubah menjadi ${updated.isActive ? "Aktif" : "Nonaktif"}`,
      data: updated,
    });
  } catch (error: any) {
    console.error("Error toggling voucher:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Gagal mengubah status voucher",
    });
  }
});
