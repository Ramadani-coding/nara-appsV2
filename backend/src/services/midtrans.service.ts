import crypto from "node:crypto";
import "dotenv/config";

export interface MidtransItemDetail {
  id: string;
  price: number;
  quantity: number;
  name: string;
}

export interface CreateQrisChargeParams {
  orderNumber: string;
  grossAmount: number;
  customerPhone: string;
  customerEmail?: string;
  items?: MidtransItemDetail[];
}

export interface MidtransQrisChargeResponse {
  statusCode: string;
  statusMessage: string;
  transactionId: string;
  orderId: string;
  grossAmount: string;
  currency: string;
  paymentType: string;
  transactionStatus: string;
  fraudStatus: string;
  qrCodeUrl: string | null;
  qrString: string | null;
  expiryTime: string | null;
  raw: any;
}

export interface MidtransStatusResponse {
  statusCode: string;
  statusMessage: string;
  transactionId: string;
  orderId: string;
  grossAmount: string;
  paymentType: string;
  transactionStatus: string;
  fraudStatus: string;
  signatureKey: string;
  settlementTime?: string;
  raw: any;
}

export class MidtransService {
  private serverKey: string;
  private clientKey: string;
  private isProduction: boolean;
  private baseUrl: string;

  constructor() {
    this.serverKey = process.env.MIDTRANS_SERVER_KEY || "";
    this.clientKey = process.env.MIDTRANS_CLIENT_KEY || "";
    this.isProduction = process.env.MIDTRANS_IS_PRODUCTION === "true";
    this.baseUrl = this.isProduction
      ? "https://api.midtrans.com"
      : "https://api.sandbox.midtrans.com";
  }

  private getAuthHeader(): string {
    return `Basic ${Buffer.from(this.serverKey + ":").toString("base64")}`;
  }

  /**
   * Membuat transaksi pembayaran QRIS menggunakan Midtrans Core API (/v2/charge)
   */
  async createQrisCharge(params: CreateQrisChargeParams): Promise<MidtransQrisChargeResponse> {
    if (!this.serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi di environment variables");
    }

    const payload: any = {
      payment_type: "qris",
      transaction_details: {
        order_id: params.orderNumber,
        gross_amount: Math.round(params.grossAmount),
      },
      qris: {
        acquirer: "gopay",
      },
      customer_details: {
        first_name: params.customerPhone || "Pelanggan",
        phone: params.customerPhone,
        email: params.customerEmail || "customer@narastore.id",
      },
    };

    if (params.items && params.items.length > 0) {
      payload.item_details = params.items.map((item) => ({
        id: String(item.id).substring(0, 50),
        price: Math.round(item.price),
        quantity: item.quantity,
        name: (item.name || "Produk Digital").substring(0, 50),
      }));
    }

    const res = await fetch(`${this.baseUrl}/v2/charge`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    const data = (await res.json()) as any;

    if (!res.ok && data.status_code !== "201" && data.status_code !== "200") {
      const errorMsg = Array.isArray(data.validation_messages)
        ? data.validation_messages.join(", ")
        : data.status_message || res.statusText;
      throw new Error(`Midtrans QRIS Error (${res.status}): ${errorMsg}`);
    }

    // Ambil URL QR Code dari array actions
    const qrAction = Array.isArray(data.actions)
      ? data.actions.find((a: any) => a.name === "generate-qr-code")
      : null;
    const qrCodeUrl = qrAction?.url || null;

    return {
      statusCode: data.status_code,
      statusMessage: data.status_message,
      transactionId: data.transaction_id,
      orderId: data.order_id,
      grossAmount: data.gross_amount,
      currency: data.currency || "IDR",
      paymentType: data.payment_type || "qris",
      transactionStatus: data.transaction_status || "pending",
      fraudStatus: data.fraud_status || "accept",
      qrCodeUrl,
      qrString: data.qr_string || null,
      expiryTime: data.expiry_time || null,
      raw: data,
    };
  }

  /**
   * Mengambil status transaksi dari Midtrans Core API (/v2/{order_id}/status)
   */
  async getTransactionStatus(orderNumber: string): Promise<MidtransStatusResponse> {
    if (!this.serverKey) {
      throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi di environment variables");
    }

    const res = await fetch(`${this.baseUrl}/v2/${encodeURIComponent(orderNumber)}/status`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: this.getAuthHeader(),
      },
      signal: AbortSignal.timeout(10000),
    });

    const data = (await res.json()) as any;

    if (!res.ok) {
      throw new Error(`Midtrans Status Error (${res.status}): ${data.status_message || res.statusText}`);
    }

    return {
      statusCode: data.status_code,
      statusMessage: data.status_message,
      transactionId: data.transaction_id,
      orderId: data.order_id,
      grossAmount: data.gross_amount,
      paymentType: data.payment_type,
      transactionStatus: data.transaction_status,
      fraudStatus: data.fraud_status,
      signatureKey: data.signature_key,
      settlementTime: data.settlement_time,
      raw: data,
    };
  }

  /**
   * Verifikasi signature key webhook Midtrans
   * Rumus: SHA512(order_id + status_code + gross_amount + server_key)
   */
  verifySignature(
    orderId: string,
    statusCode: string,
    grossAmount: string,
    signatureKey: string
  ): boolean {
    if (!this.serverKey || !signatureKey) return false;

    // Normalisasi gross_amount (beberapa respon menyertakan desimal .00)
    const normalizedGrossAmount = grossAmount;
    const sourceString = `${orderId}${statusCode}${normalizedGrossAmount}${this.serverKey}`;
    const calculatedHash = crypto.createHash("sha512").update(sourceString).digest("hex");

    return calculatedHash.toLowerCase() === signatureKey.toLowerCase();
  }

  /**
   * Membatalkan transaksi di Midtrans (/v2/{order_id}/cancel)
   */
  async cancelTransaction(orderNumber: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/v2/${encodeURIComponent(orderNumber)}/cancel`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: this.getAuthHeader(),
      },
      signal: AbortSignal.timeout(10000),
    });

    return await res.json();
  }
}

export const midtransService = new MidtransService();
