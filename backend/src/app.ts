import express from "express";
import cors from "cors";
import apiRouter from "./routes/index.js";

export const app = express();

// Konfigurasi trust proxy untuk deployment di balik Nginx reverse proxy
app.set("trust proxy", 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root welcome endpoint
app.get("/", (_req, res) => {
  res.json({
    message: "Welcome to Nara Digital Store Backend API",
    version: "1.0.0",
    docs: "/api/health",
  });
});

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
