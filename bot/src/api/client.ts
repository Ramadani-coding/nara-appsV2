import { config } from "../config.js";

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  categoryId: number | null;
  name: string;
  description?: string | null;
  productType?: string | null;
  price: number;
  originalPrice?: number | null;
  stockStatus: string;
  stockCount: number;
  imageUrl?: string | null;
  isActive: boolean;
  isMaintenance?: boolean;
  maxAllowedQty?: number;
  category?: ProductCategory | null;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number | null;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Payment {
  id: number;
  orderId: number;
  transactionId?: string | null;
  paymentMethod: string;
  qrCodeUrl?: string | null;
  qrString?: string | null;
  expiryTime?: string | null;
  status: string;
  rawCallback?: any;
}

export interface Delivery {
  id: number;
  orderId: number;
  productName: string;
  content: string;
  status: string;
  deliveredAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  refId: string;
  customerPhone: string;
  customerEmail?: string | null;
  discordUserId?: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt?: string | null;
  completedAt?: string | null;
  items?: OrderItem[];
  payments?: Payment[];
  deliveries?: Delivery[];
}

export interface CreateBotOrderResponse {
  success: boolean;
  message: string;
  data: {
    orderId: number;
    orderNumber: string;
    refId: string;
    totalAmount: number;
    status: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    payment: {
      id: number;
      transactionId?: string;
      paymentMethod: string;
      qrCodeUrl?: string | null;
      qrString?: string | null;
      expiryTime?: string | null;
      status: string;
    };
  };
}

export class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.backendUrl;
  }

  async getCategories(): Promise<ProductCategory[]> {
    try {
      const res = await fetch(`${this.baseUrl}/categories`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const json: any = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (err: any) {
      console.error("❌ ApiClient.getCategories failed:", err.message);
      return [];
    }
  }

  async getProducts(): Promise<Product[]> {
    try {
      const res = await fetch(`${this.baseUrl}/products`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const json: any = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (err: any) {
      console.error("❌ ApiClient.getProducts failed:", err.message);
      return [];
    }
  }

  async getProduct(id: number): Promise<Product | null> {
    try {
      const res = await fetch(`${this.baseUrl}/products/${id}`);
      if (!res.ok) return null;
      const json: any = await res.json();
      return json.success ? json.data : null;
    } catch (err: any) {
      console.error(`❌ ApiClient.getProduct(${id}) failed:`, err.message);
      return null;
    }
  }

  async createBotOrder(productId: number, discordUserId: string, quantity = 1): Promise<CreateBotOrderResponse> {
    const res = await fetch(`${this.baseUrl}/bot/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, discordUserId, quantity }),
    });

    const json: any = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || `Gagal membuat pesanan (HTTP ${res.status})`);
    }

    return json;
  }

  async getUserOrders(discordUserId: string): Promise<Order[]> {
    try {
      const res = await fetch(`${this.baseUrl}/bot/orders/user/${encodeURIComponent(discordUserId)}`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const json: any = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (err: any) {
      console.error(`❌ ApiClient.getUserOrders(${discordUserId}) failed:`, err.message);
      return [];
    }
  }

  async getOrderDetail(orderNumber: string): Promise<Order | null> {
    try {
      const res = await fetch(`${this.baseUrl}/bot/orders/${encodeURIComponent(orderNumber)}`);
      if (!res.ok) return null;
      const json: any = await res.json();
      return json.success ? json.data : null;
    } catch (err: any) {
      console.error(`❌ ApiClient.getOrderDetail(${orderNumber}) failed:`, err.message);
      return null;
    }
  }

  async getPendingDeliveries(): Promise<Order[]> {
    try {
      const res = await fetch(`${this.baseUrl}/bot/deliveries/pending`);
      if (!res.ok) return [];
      const json: any = await res.json();
      return json.success && Array.isArray(json.data) ? json.data : [];
    } catch (err: any) {
      console.error("❌ ApiClient.getPendingDeliveries failed:", err.message);
      return [];
    }
  }

  async markDeliverySent(orderId: number): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/bot/deliveries/${orderId}/mark-sent`, {
        method: "POST",
      });
      return res.ok;
    } catch (err: any) {
      console.error(`❌ ApiClient.markDeliverySent(${orderId}) failed:`, err.message);
      return false;
    }
  }
}

export const apiClient = new ApiClient();
