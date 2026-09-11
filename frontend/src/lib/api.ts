/**
 * Client API untuk menghubungkan Frontend Nara Store ke Backend & Supabase Database
 */

export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5001/api';
export const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://eakaptprmmpabiufgtwc.supabase.co';
export const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVha2FwdHBybW1wYWJpdWZndHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5NDM2MDQsImV4cCI6MjEwNDUxOTYwNH0.1zF66Q8DosMcHB1xleYi4bbUy9QSjIWKPD-OaXYwZ4A';

export interface BackendProduct {
  id: number;
  categoryId: number | null;
  providerServiceId: string;
  name: string;
  description: string;
  productType: string;
  price: number;
  providerPrice?: number | null;
  marginValue?: number | null;
  originalPrice: number | null;
  stockStatus: string;
  stockCount: number;
  imageUrl: string | null;
  isActive: boolean;
  isMaintenance?: boolean;
  maxAllowedQty?: number;
  category?: {
    id: number;
    name: string;
    slug: string;
  };
}

export interface BackendCategory {
  id: number;
  name: string;
  slug: string;
  products?: BackendProduct[];
}

/**
 * Mengambil produk dari Backend API (dengan fallback otomatis ke Supabase Data API)
 */
export async function fetchLiveProducts(): Promise<BackendProduct[]> {
  // 1. Coba ambil dari Backend Express API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${API_BASE_URL}/products`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        return json.data;
      }
    }
  } catch (_backendErr) {
    // Backend mungkin belum running atau jaringan lokal sedang switch
  }

  // 2. Fallback langsung ke Supabase REST Data API
  try {
    const sbRes = await fetch(`${SUPABASE_URL}/rest/v1/products?select=*,category:product_categories(*)&order=id.asc`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (sbRes.ok) {
      const data = await sbRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          id: item.id,
          categoryId: item.category_id,
          providerServiceId: item.provider_service_id,
          name: item.name,
          description: item.description,
          productType: item.product_type,
          price: item.price,
          providerPrice: item.provider_price ?? item.price,
          marginValue: item.margin_value ?? 0,
          originalPrice: item.original_price,
          stockStatus: item.stock_status,
          stockCount: item.stock_count,
          imageUrl: item.image_url,
          isActive: item.is_active,
          category: item.category,
        }));
      }
    }
  } catch (_sbErr) {
    console.warn('⚠️ Gagal mengambil dari Supabase Data API');
  }

  return [];
}

export interface PremkuBalanceData {
  saldo: number;
  username?: string;
  cached?: boolean;
}

/**
 * Mengambil saldo terkini dari akun Premiumku via Backend API (dengan fallback cache & offline default)
 */
export async function fetchPremkuBalance(): Promise<PremkuBalanceData> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await adminFetch("/premku/balance", {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      if (json.success && typeof json.saldo === 'number') {
        try {
          localStorage.setItem('nara_premku_saldo', json.saldo.toString());
        } catch {}
        return {
          saldo: json.saldo,
          username: json.username,
          cached: json.cached,
        };
      }
    }
  } catch (_err) {
    // Backend offline or network switch
  }

  // Fallback ke cache localStorage jika ada data sebelumnya
  try {
    const cached = localStorage.getItem('nara_premku_saldo');
    if (cached !== null) {
      const parsed = parseInt(cached, 10);
      if (!isNaN(parsed)) {
        return { saldo: parsed, cached: true };
      }
    }
  } catch {}

  // Fallback default jika belum ada data atau gagal memuat
  return { saldo: 0, cached: true };
}

/**
 * Helper untuk memanggil endpoint API Administrator (/api/admin/*)
 * dengan otentikasi Bearer JWT Supabase secara otomatis
 */
export async function adminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  // Import supabase client dynamically or lazily to avoid circular dependencies
  const { supabase } = await import("./supabaseClient");
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const url = endpoint.startsWith("http") 
    ? endpoint 
    : `${API_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

// -----------------------------------------------------------------------------
// ORDERS & MIDTRANS QRIS PAYMENT API
// -----------------------------------------------------------------------------

export interface CreateOrderPayload {
  productId?: number;
  packageId?: string;
  productName: string;
  price: number;
  quantity: number;
  customerPhone: string;
  customerEmail?: string;
}

export interface BackendOrderResponse {
  success: boolean;
  message?: string;
  data: {
    orderId: number;
    orderNumber: string;
    refId: string;
    totalAmount: number;
    status: string;
    customerPhone: string;
    customerEmail?: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    payment: {
      id: number;
      transactionId: string;
      paymentMethod: string;
      qrCodeUrl: string | null;
      qrString: string | null;
      expiryTime: string | null;
      status: string;
    };
    accessToken?: string;
  };
}

export interface BackendOrderDetail {
  id: number;
  orderNumber: string;
  refId: string;
  customerPhone: string;
  customerEmail?: string;
  status: "waiting_payment" | "paid" | "processing" | "completed" | "failed";
  totalAmount: number;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  isLocked?: boolean;
  isVerified?: boolean;
  items: Array<{
    id: number;
    productName: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
  payments: Array<{
    id: number;
    transactionId: string;
    paymentMethod: string;
    qrCodeUrl: string | null;
    status: string;
    settledAt?: string;
    expiryTime?: string | null;
    rawCallback?: any;
  }>;
  deliveries: Array<{
    id: number;
    productName: string;
    content: string;
    status: string;
    deliveredAt: string;
    isLocked?: boolean;
  }>;
}

/**
 * Membuat pesanan baru dan menghasilkan transaksi QRIS Midtrans Core API
 */
export async function createBackendOrder(payload: CreateOrderPayload): Promise<BackendOrderResponse> {
  const res = await fetch(`${API_BASE_URL}/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal membuat pesanan QRIS");
  }

  // Simpan token akses ke sessionStorage (hanya aktif selama tab/sesi browser berlangsung)
  if (json.data?.orderNumber && json.data?.accessToken) {
    try {
      sessionStorage.setItem(`nara_session_token_${json.data.orderNumber}`, json.data.accessToken);
      localStorage.removeItem(`nara_token_${json.data.orderNumber}`);
    } catch {}
  }

  return json;
}

export interface GetBackendOrderOptions {
  customToken?: string;
  skipToken?: boolean;
}

/**
 * Mengambil detail lengkap pesanan dari backend (otomatis menyertakan token otentikasi sesi jika ada)
 */
export async function getBackendOrder(
  orderNumber: string, 
  customTokenOrOptions?: string | GetBackendOrderOptions
): Promise<BackendOrderDetail | null> {
  try {
    const cleanNum = orderNumber.trim().replace(/^#/, "");
    let token: string | undefined = undefined;
    let skipToken = false;

    if (typeof customTokenOrOptions === "string") {
      token = customTokenOrOptions;
    } else if (customTokenOrOptions && typeof customTokenOrOptions === "object") {
      token = customTokenOrOptions.customToken;
      skipToken = Boolean(customTokenOrOptions.skipToken);
    }

    // Selalu hapus token lama dari localStorage agar kredensial tidak bocor permanen
    try {
      localStorage.removeItem(`nara_token_${cleanNum}`);
    } catch {}

    // Ambil token dari sessionStorage HANYA jika skipToken tidak aktif
    if (!skipToken && !token) {
      try {
        token = sessionStorage.getItem(`nara_session_token_${cleanNum}`) || undefined;
      } catch {}
    }

    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(`${API_BASE_URL}/orders/${encodeURIComponent(cleanNum)}`, base);
    const headers: Record<string, string> = { Accept: "application/json" };

    if (!skipToken && token) {
      url.searchParams.set("token", token);
      headers["x-order-token"] = token;
    }

    const res = await fetch(url.toString(), { headers });

    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.error("Gagal mengambil detail order dari backend:", err);
    return null;
  }
}

/**
 * Menghapus token otentikasi sesi agar kredensial terkunci kembali
 */
export function clearOrderSessionToken(orderNumber: string): void {
  const cleanNum = orderNumber.trim().replace(/^#/, "");
  try {
    sessionStorage.removeItem(`nara_session_token_${cleanNum}`);
    sessionStorage.removeItem(`nara_token_${cleanNum}`);
    localStorage.removeItem(`nara_token_${cleanNum}`);
  } catch {}
}

export interface VerifyOrderPhoneResult {
  success: boolean;
  message?: string;
  token?: string;
  data?: BackendOrderDetail;
}

/**
 * Memverifikasi nomor WhatsApp pemesan untuk membuka kredensial akun
 */
export async function verifyBackendOrderPhone(orderNumber: string, phone: string): Promise<VerifyOrderPhoneResult> {
  try {
    const cleanNum = orderNumber.trim().replace(/^#/, "");
    const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(cleanNum)}/verify-phone`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ phone }),
    });

    const json = await res.json();
    if (json.success && json.token) {
      try {
        sessionStorage.setItem(`nara_session_token_${cleanNum}`, json.token);
        localStorage.removeItem(`nara_token_${cleanNum}`);
      } catch {}
    }
    return json;
  } catch (err: any) {
    return {
      success: false,
      message: err.message || "Gagal menghubungi server verifikasi",
    };
  }
}

/**
 * Cek status pembayaran terkini (disertai sinkronisasi otomatis Midtrans)
 */
export async function checkBackendPaymentStatus(orderNumber: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/payments/${encodeURIComponent(orderNumber)}/status`, {
    headers: { Accept: "application/json" },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal memeriksa status pembayaran");
  }

  return json.data;
}

/**
 * Simulasi instan pelunasan pembayaran di mode development/sandbox
 */
export async function simulateBackendPayment(orderNumber: string): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/payments/${encodeURIComponent(orderNumber)}/simulate-pay`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Gagal melakukan simulasi pembayaran");
  }

  return json.data;
}

