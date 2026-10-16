import { Router, type Request, type Response } from "express";
import { premiumkuService } from "../services/premiumku.service.js";
import { orderService } from "../services/order.service.js";
import { adminAuthMiddleware } from "../middleware/adminAuth.js";

const router = Router();

// In-memory cache for balance to avoid excessive requests to premku.com
let cachedBalance: { saldo: number; username?: string; timestamp: number } | null = null;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * GET /api/premku/balance
 * Mengambil saldo real-time akun Premku dengan caching 30 detik (Khusus Administrator)
 */
router.get("/balance", adminAuthMiddleware, async (req: Request, res: Response) => {
  // Support testing/demo override via query parameter ?mock_saldo=10000 or env SIMULATE_PREMKU_SALDO
  if (req.query.mock_saldo) {
    const mockVal = parseInt(req.query.mock_saldo as string, 10);
    if (!isNaN(mockVal)) {
      res.json({
        success: true,
        saldo: mockVal,
        username: "cocode (simulated)",
        cached: false,
      });
      return;
    }
  }

  if (process.env.SIMULATE_PREMKU_SALDO) {
    const envVal = parseInt(process.env.SIMULATE_PREMKU_SALDO, 10);
    if (!isNaN(envVal)) {
      res.json({
        success: true,
        saldo: envVal,
        username: "cocode (simulated)",
        cached: false,
      });
      return;
    }
  }

  const forceFresh = req.query.fresh === "true";
  const now = Date.now();

  if (!forceFresh && cachedBalance && now - cachedBalance.timestamp < CACHE_TTL_MS) {
    res.json({
      success: true,
      saldo: cachedBalance.saldo,
      username: cachedBalance.username,
      cached: true,
    });
    return;
  }

  try {
    const profileRes = await premiumkuService.getProfile();
    if (profileRes.success && profileRes.data) {
      cachedBalance = {
        saldo: profileRes.data.saldo,
        username: profileRes.data.username,
        timestamp: now,
      };
      res.json({
        success: true,
        saldo: profileRes.data.saldo,
        username: profileRes.data.username,
        cached: false,
      });
      return;
    }

    if (cachedBalance) {
      res.json({
        success: true,
        saldo: cachedBalance.saldo,
        username: cachedBalance.username,
        cached: true,
        warning: "Menggunakan data cache terakhir",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: profileRes.message || "Gagal mengambil data akun Premiumku",
      saldo: 0,
    });
  } catch (error: any) {
    if (cachedBalance) {
      res.json({
        success: true,
        saldo: cachedBalance.saldo,
        username: cachedBalance.username,
        cached: true,
        warning: "API Premku timeout/error, menggunakan cache",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: error.message || "Gagal menghubungi API Premiumku",
      saldo: 0,
    });
  }
});

/**
 * Handler pemroses Callback Webhook Premku
 * Dapat dipanggil dari /api/premku/webhook maupun /api/webhook-premku
 */
export async function premkuWebhookHandler(req: Request, res: Response) {
  const signature = (req.headers["x-premku-signature"] as string) || "";
  const rawBody = (req as any).rawBody;

  // 1. Validasi Keamanan Signature HMAC-SHA256
  const isValidSignature = premiumkuService.verifyWebhookSignature(rawBody, signature);
  if (!isValidSignature) {
    console.warn("🚨 [PremkuWebhook] Akses ditolak: Signature HMAC X-Premku-Signature tidak cocok.");
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  // 2. Proses Webhook & Terbitkan Akun ke Pelanggan
  try {
    const result = await orderService.handlePremkuWebhook(req.body, signature, rawBody);
    // Dokumentasi Premku: Wajib balas HTTP 200 OK maksimal dalam 4 detik
    res.status(200).json({ status: true, message: result.message });
  } catch (err: any) {
    console.error("❌ [PremkuWebhook] Gagal memproses webhook:", err);
    res.status(200).json({ status: false, message: err.message || "Webhook processing error" });
  }
}

/**
 * GET /api/premku/webhook
 * Info endpoint untuk verifikasi browser bahwa webhook aktif
 */
router.get("/webhook", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "ready",
    service: "Premku Webhook Endpoint",
    message: "Webhook endpoint aktif dan siap menerima request HTTP POST dari Premku.",
  });
});

/**
 * POST /api/premku/webhook
 */
router.post("/webhook", premkuWebhookHandler);

export default router;
