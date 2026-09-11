import "dotenv/config";

export interface PremiumkuProduct {
  id: number;
  name: string;
  description: string;
  product_type: string;
  price: number;
  original_price?: number;
  status: string;
  stock: number;
  image: string;
}

export interface PremiumkuProductsResponse {
  success: boolean;
  products: PremiumkuProduct[];
  message?: string;
}

export interface PremiumkuStockResponse {
  success: boolean;
  product_id: number;
  stock: number;
  status: string;
  message?: string;
}

export interface PremiumkuOrderParams {
  productId: number;
  qty: number;
  refId: string;
}

export interface PremiumkuOrderResponse {
  success: boolean;
  message: string;
  invoice?: string;
  product?: string;
  qty?: number;
  price?: number;
  total?: number;
  balance_before?: number;
  balance_after?: number;
}

export interface PremiumkuOrderStatusResponse {
  success: boolean;
  invoice?: string;
  status?: "pending" | "processing" | "success" | "failed";
  product?: string;
  accounts?: Array<{
    username?: string;
    password?: string;
    email?: string;
    token?: string;
    link?: string;
    [key: string]: any;
  }>;
  message?: string;
}

export interface PremiumkuProfile {
  username: string;
  whatsapp: string;
  saldo: number;
  registered_at: string;
}

export interface PremiumkuProfileResponse {
  success: boolean;
  data?: PremiumkuProfile;
  message?: string;
}

export class PremiumkuService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = (process.env.PREMIUMKU_BASE_URL || "https://premku.com/api").replace(/\/$/, "");
    this.apiKey = process.env.PREMIUMKU_API_KEY || "";
  }

  /**
   * Mengambil semua produk yang tersedia dari API Premiumku
   */
  async fetchProducts(): Promise<PremiumkuProduct[]> {
    try {
      const payload = this.apiKey ? { api_key: this.apiKey } : {};
      const res = await fetch(`${this.baseUrl}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "NaraStore/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        throw new Error(`Gagal menghubungi API Premiumku: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as PremiumkuProductsResponse;
      if (!data.success && data.message) {
        throw new Error(`API Premiumku error: ${data.message}`);
      }

      return data.products || [];
    } catch (error: any) {
      console.error("❌ Error fetching products from Premiumku:", error.message);
      throw error;
    }
  }

  /**
   * Cek stok realtime untuk produk tertentu
   */
  async checkStock(productId: number): Promise<PremiumkuStockResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "NaraStore/1.0",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          product_id: productId,
        }),
        signal: AbortSignal.timeout(8000),
      });

      return (await res.json()) as PremiumkuStockResponse;
    } catch (error: any) {
      console.error(`❌ Error checking stock for product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Melakukan Create Order ke Premiumku dengan idempotency ref_id
   */
  async createOrder(params: PremiumkuOrderParams): Promise<PremiumkuOrderResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/order`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "NaraStore/1.0",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          product_id: params.productId,
          qty: params.qty,
          ref_id: params.refId,
        }),
        signal: AbortSignal.timeout(10000),
      });

      return (await res.json()) as PremiumkuOrderResponse;
    } catch (error: any) {
      console.error(`❌ Error creating order for ref_id ${params.refId}:`, error.message);
      throw error;
    }
  }

  /**
   * Cek status pesanan berdasarkan nomor invoice Premiumku
   */
  async checkOrderStatus(invoice: string): Promise<PremiumkuOrderStatusResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "NaraStore/1.0",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          invoice: invoice,
        }),
        signal: AbortSignal.timeout(8000),
      });

      return (await res.json()) as PremiumkuOrderStatusResponse;
    } catch (error: any) {
      console.error(`❌ Error checking status for invoice ${invoice}:`, error.message);
      throw error;
    }
  }

  /**
   * Mengambil data profil dan saldo akun Premiumku
   */
  async getProfile(): Promise<PremiumkuProfileResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "NaraStore/1.0",
        },
        body: JSON.stringify({
          api_key: this.apiKey,
        }),
        signal: AbortSignal.timeout(8000),
      });

      return (await res.json()) as PremiumkuProfileResponse;
    } catch (error: any) {
      console.error("❌ Error fetching profile from Premiumku:", error.message);
      throw error;
    }
  }
}

export const premiumkuService = new PremiumkuService();
