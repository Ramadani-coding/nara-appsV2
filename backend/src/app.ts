import express from "express";
import cors from "cors";
import apiRouter from "./routes/index.js";
import { globalApiLimiter } from "./middleware/rateLimiter.js";

export const app = express();

// Konfigurasi trust proxy untuk deployment di balik Nginx reverse proxy
app.set("trust proxy", 1);

// Konfigurasi CORS yang aman untuk Production & Development
const rawFrontendUrls = process.env.FRONTEND_URL || "";
const allowedOrigins = rawFrontendUrls
  ? rawFrontendUrls.split(",").map((u) => u.trim().replace(/\/$/, ""))
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // 1. Izinkan request tanpa origin (seperti webhook Midtrans, Gojek, cURL, server-to-server)
    if (!origin) return callback(null, true);

    // 2. Di mode development, izinkan akses lokal
    if (process.env.NODE_ENV !== "production") {
      return callback(null, true);
    }

    // 3. Di mode production, pastikan origin terdaftar di FRONTEND_URL
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS policy violation: Origin ${origin} not allowed`), false);
  },
  credentials: true,
}));
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

// Root welcome endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to Nara Digital Store Backend API",
    version: "1.0.0",
    docs: "/api/health",
  });
});

// Global API Rate Limiter
app.use("/api", globalApiLimiter);

// API Routes
app.use("/api", apiRouter);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

export default app;
