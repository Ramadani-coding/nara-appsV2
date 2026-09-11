import { Router, type Request, type Response } from "express";
import { db } from "../db/index.js";
import { productCategories } from "../db/schema.js";

const router = Router();

/**
 * GET /api/categories
 * Mengambil semua kategori produk
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const categories = await db.query.productCategories.findMany({
      with: {
        products: true,
      },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      message: "Gagal mengambil kategori produk",
      error: error.message,
    });
  }
});

export default router;
