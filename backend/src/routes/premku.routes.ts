import { Router, type Request, type Response } from "express";
import { premiumkuService } from "../services/premiumku.service.js";
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

export default router;
