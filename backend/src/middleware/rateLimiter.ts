import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";

/**
 * Helper untuk menentukan apakah request berasal dari sumber terpercaya internal atau webhook resmi.
 * Webhook Midtrans dan bot internal TIDAK BOLEH terkena rate limit agar tidak terjadi transaksi gagal.
 */
export function isWhitelistedRequest(req: Request): boolean {
  const path = req.originalUrl || req.url || "";

  // 1. Webhook resmi Midtrans
  if (path.includes("/payments/notification") || path.includes("/payments/webhook")) {
    return true;
  }

  // 2. Health check internal docker / monitoring
  if (path === "/api/health" || path === "/health") {
    return true;
  }

  // 3. Traffic loopback lokal / docker internal
  const clientIp = req.ip || req.socket.remoteAddress || "";
  if (clientIp === "127.0.0.1" || clientIp === "::1" || clientIp.startsWith("172.")) {
    // Lewatkan bot internal jika menyertakan header authorization / internal token
    if (req.headers["x-internal-bot"] === "true") {
      return true;
    }
  }

  return false;
}

/**
 * Template handler respon standar ketika rate limit terlampaui (HTTP 429)
 */
function createRateLimitHandler(customMessage: string) {
  return (req: Request, res: Response, _next: NextFunction, options: any) => {
    // Ambil sisa detik dari header reset atau kalkulasi window
    const resetTime = (req as any).rateLimit?.resetTime;
    const retryAfter = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);

    res.status(options.statusCode || 429).json({
      success: false,
      message: customMessage,
      retryAfterSeconds: retryAfter,
    });
  };
}

/**
 * 1. Global API Rate Limiter
 * Melindungi seluruh endpoint /api/* dari web scraping agresif, bot spam, dan DoS flood.
 * Kuota: 180 request / 1 menit per IP (Sangat ramah untuk browsing katalog & navigasi cepat).
 */
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  limit: 180, // Maks 180 request/menit per IP
  standardHeaders: "draft-7", // RateLimit-* headers standar IETF
  legacyHeaders: false, // Matikan header X-RateLimit-* usang
  ipv6Subnet: 56,
  validate: { trustProxy: false },
  skip: (req) => isWhitelistedRequest(req),
  handler: createRateLimitHandler(
    "Terlalu banyak permintaan ke server dalam waktu singkat. Silakan tunggu beberapa detik sebelum mencoba kembali."
  ),
});

/**
 * 2. Order Creation Limiter
 * Melindungi endpoint pembuatan pesanan (POST /api/orders).
 * Mencegah bot spam invoice/QRIS fiktif ke Midtrans dan menjaga ketersediaan database stok.
 * Kuota: 10 pesanan / 10 menit per IP.
 */
export const createOrderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 menit
  limit: 10, // Maks 10 checkout pesanan per 10 menit
  standardHeaders: "draft-7",
  legacyHeaders: false,
  ipv6Subnet: 56,
  validate: { trustProxy: false },
  skip: (req) => isWhitelistedRequest(req),
  handler: createRateLimitHandler(
    "Terlalu banyak pembuatan pesanan dalam waktu singkat. Demi kenyamanan dan keamanan transaksi, silakan tunggu beberapa menit sebelum membuat pesanan baru."
  ),
});

/**
 * 3. Admin & Auth Limiter
 * Melindungi endpoint login dan operasi sensitif admin dari serangan Brute-Force dan Credential Stuffing.
 * Jika request membawa Bearer token (admin sah yang aktif mengelola), kuota diberikan 300 req / 15 menit.
 * Jika request tanpa token / probing bot tak dikenal, kuota dibatasi ketat 20 req / 15 menit.
 */
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  limit: (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return 300; // Kuota wajar untuk admin resmi beraktivitas di dashboard
    }
    return 20; // Batas ketat untuk cegah scanning/probing tanpa token
  },
  standardHeaders: "draft-7",
  legacyHeaders: false,
  ipv6Subnet: 56,
  validate: { trustProxy: false },
  handler: createRateLimitHandler(
    "Terlalu banyak percobaan akses administratif. Akses dibatasi sementara demi keamanan sistem."
  ),
});

/**
 * 4. Phone Validation & OTP Limiter
 * Melindungi endpoint validasi nomor WhatsApp (Fonnte API) dan verifikasi nomor pesanan.
 * Kuota: 15 request / 5 menit per IP.
 */
export const phoneValidationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 menit
  limit: 15, // Maks 15 request per 5 menit
  standardHeaders: "draft-7",
  legacyHeaders: false,
  ipv6Subnet: 56,
  validate: { trustProxy: false },
  skip: (req) => isWhitelistedRequest(req),
  handler: createRateLimitHandler(
    "Terlalu banyak permintaan verifikasi nomor WhatsApp. Silakan tunggu 5 menit sebelum mencoba kembali."
  ),
});

/**
 * 5. Payment Polling Limiter
 * Khusus endpoint pengecekan status transaksi (GET /api/payments/:orderNumber/status).
 * Disesuaikan dengan interval polling frontend (setiap 3.5 detik = ~17 req/menit).
 * Kuota: 60 request / 1 menit per IP (cukup untuk 1-3 tab halaman pembayaran aktif sekaligus).
 */
export const paymentStatusLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 menit
  limit: 60, // Maks 60 request per menit
  standardHeaders: "draft-7",
  legacyHeaders: false,
  ipv6Subnet: 56,
  validate: { trustProxy: false },
  skip: (req) => isWhitelistedRequest(req),
  handler: createRateLimitHandler(
    "Pengecekan status pembayaran terlalu sering. Mohon tunggu beberapa detik, sistem sedang memverifikasi transaksi Anda."
  ),
});
