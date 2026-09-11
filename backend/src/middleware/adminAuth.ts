import type { Request, Response, NextFunction } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

interface CachedAdminUser {
  user: {
    id: string;
    email: string;
    role: string;
    fullName?: string;
  };
  expiresAt: number;
}

// In-memory cache for fast verification (TTL 60 seconds)
const tokenCache = new Map<string, CachedAdminUser>();

// Extend Express Request interface
export interface AuthenticatedAdminRequest extends Request {
  adminUser?: {
    id: string;
    email: string;
    role: string;
    fullName?: string;
  };
}

export const adminAuthMiddleware = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Akses ditolak: Autentikasi administrator diperlukan.",
      });
      return;
    }

    const token = authHeader.split(" ")[1]?.trim();
    if (!token) {
      res.status(401).json({
        success: false,
        message: "Token autentikasi tidak valid.",
      });
      return;
    }

    // 1. Check in-memory cache
    const cached = tokenCache.get(token);
    if (cached && Date.now() < cached.expiresAt) {
      req.adminUser = cached.user;
      next();
      return;
    }

    // 2. Verify with Supabase Auth API
    const supabaseUrl = process.env.SUPABASE_URL || "https://eakaptprmmpabiufgtwc.supabase.co";
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: supabaseAnonKey,
      },
    });

    if (!verifyRes.ok) {
      tokenCache.delete(token);
      res.status(401).json({
        success: false,
        message: "Sesi admin tidak valid atau telah kedaluwarsa. Silakan login kembali.",
      });
      return;
    }

    const authUser = (await verifyRes.json()) as any;
    if (!authUser || !authUser.id) {
      res.status(401).json({
        success: false,
        message: "Data pengguna tidak dapat diverifikasi.",
      });
      return;
    }

    // 3. Strict RBAC verification
    let isAuthorizedAdmin = false;
    let fullName = authUser.user_metadata?.full_name || "Administrator";

    // A. Check app_metadata.role
    if (authUser.app_metadata?.role === "admin") {
      isAuthorizedAdmin = true;
    }

    // B. Check public.users in database
    const [dbUser] = await db.select().from(users).where(eq(users.id, authUser.id));
    if (dbUser && dbUser.role === "admin") {
      isAuthorizedAdmin = true;
      fullName = dbUser.fullName || fullName;
    }

    if (!isAuthorizedAdmin) {
      res.status(403).json({
        success: false,
        message: "Akses ditolak: Akun Anda tidak memiliki hak akses administrator.",
      });
      return;
    }

    const adminData = {
      id: authUser.id,
      email: authUser.email || "",
      role: "admin",
      fullName,
    };

    // Cache for 60 seconds
    tokenCache.set(token, {
      user: adminData,
      expiresAt: Date.now() + 60 * 1000,
    });

    req.adminUser = adminData;
    next();
  } catch (err: any) {
    console.error("Admin auth middleware error:", err);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan pada verifikasi keamanan server.",
    });
  }
};
