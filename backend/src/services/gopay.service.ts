import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import QRCode from "qrcode";
import "dotenv/config";

export interface GoPaySession {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  expires_in?: number;
  expires_at?: number; // Epoch timestamp ms
  merchant_id?: string;
  phone_number?: string;
  updated_at?: string;
}

export interface DynamicQrisResult {
  qrString: string;
  qrCodeUrl: string; // Base64 data URL PNG
  amount: number;
  expiresAt: Date;
}

export interface GoPayTransaction {
  id: string;
  orderId: string;
  amount: number;
  payerIssuer: string;
  paymentType: string;
  transactionTime: string;
  raw: any;
}

class GopayService {
  private sessionFilePath: string;
  private staticQrString: string;
  private merchantId: string;
  private fallbackTimeoutMs = 10000;

  constructor() {
    this.sessionFilePath = path.resolve(process.cwd(), ".gopay_session.json");
    this.staticQrString = (process.env.GOPAY_QRIS_STATIC || process.env.QRIS_STATIC || "").trim();
    this.merchantId = (process.env.GOPAY_MERCHANT_ID || "").trim();
  }

  // =========================================================================
  // 1. SESSION MANAGEMENT (GoBiz Go-ID Auth)
  // =========================================================================

  public getStaticQrString(): string {
    return (process.env.GOPAY_QRIS_STATIC || process.env.QRIS_STATIC || this.staticQrString || "").trim();
  }

  public getSessionFilePath(): string {
    return this.resolveSessionFilePath();
  }

  private resolveSessionFilePath(): string {
    if (process.env.GOPAY_SESSION_PATH) {
      return path.resolve(process.env.GOPAY_SESSION_PATH);
    }
    const candidates = [
      this.sessionFilePath,
      path.resolve(process.cwd(), ".gopay_session.json"),
      path.resolve(process.cwd(), "backend", ".gopay_session.json"),
      path.resolve(process.cwd(), "..", ".gopay_session.json"),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return candidates[0];
  }

  public loadSession(): GoPaySession | null {
    try {
      // 1. Dukung pembacaan sesi langsung dari Environment Variable GOPAY_SESSION_JSON
      // (Sangat berguna di hosting production / cloud tanpa perlu upload file manual)
      if (process.env.GOPAY_SESSION_JSON) {
        try {
          const session = JSON.parse(process.env.GOPAY_SESSION_JSON);
          if (session && session.access_token) {
            return session;
          }
        } catch (envJsonErr: any) {
          console.warn("⚠️ [GoPay] GOPAY_SESSION_JSON pada .env tidak berformat JSON valid:", envJsonErr.message);
        }
      }

      // 2. Cek lokasi file di disk
      const targetPath = this.resolveSessionFilePath();
      if (!fs.existsSync(targetPath)) {
        return null;
      }
      const raw = fs.readFileSync(targetPath, "utf-8");
      const session = JSON.parse(raw);
      if (!session || !session.access_token) {
        return null;
      }
      this.sessionFilePath = targetPath;
      return session;
    } catch (err: any) {
      console.warn("⚠️ Gagal membaca berkas sesi GoPay:", err.message);
      return null;
    }
  }

  public saveSession(session: GoPaySession): void {
    try {
      const targetPath = this.resolveSessionFilePath();
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      session.updated_at = new Date().toISOString();
      fs.writeFileSync(targetPath, JSON.stringify(session, null, 2), {
        encoding: "utf-8",
        mode: 0o600, // Secure file permissions (owner read/write only)
      });
      this.sessionFilePath = targetPath;
      console.log("✅ Sesi GoPay Merchant berhasil disimpan ke:", targetPath);
    } catch (err: any) {
      console.error("❌ Gagal menyimpan sesi GoPay:", err.message);
    }
  }

  public isSessionExpired(session: GoPaySession | null): boolean {
    if (!session || !session.access_token) return true;
    if (!session.expires_at) return false;
    // Anggap expired jika tersisa kurang dari 5 menit
    return Date.now() >= session.expires_at - 5 * 60 * 1000;
  }

  public async refreshSession(): Promise<boolean> {
    const session = this.loadSession();
    if (!session || !session.refresh_token) {
      console.warn("⚠️ [GoPay] Tidak dapat auto-refresh: Refresh token tidak ditemukan di sesi.");
      return false;
    }

    console.log("🔄 [GoPay] Mengirim request pembaruan token ke GoBiz API...");
    try {
      const response = await fetch("https://api.gobiz.co.id/goid/token", {
        method: "POST",
        headers: {
          "accept": "application/json, text/plain, */*",
          "accept-language": "id",
          "authentication-type": "go-id",
          "content-type": "application/json",
          "gojek-country-code": "ID",
          "gojek-timezone": "Asia/Jakarta",
          "origin": "https://portal.gofoodmerchant.co.id",
          "referer": "https://portal.gofoodmerchant.co.id/",
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
          "x-appid": "go-biz-web-dashboard",
          "x-appversion": "platform-v3.111.0-1708bc9a",
          "x-deviceos": "Web",
          "x-phonemake": "Windows 10 64-bit",
          "x-phonemodel": "Chrome 150.0.0.0 on Windows 10 64-bit",
          "x-platform": "Web",
          "x-uniqueid": crypto.randomUUID(),
          "x-user-locale": "en-GB",
          "x-user-type": "merchant",
        },
        body: JSON.stringify({
          client_id: "go-biz-web-new",
          grant_type: "refresh_token",
          data: {
            refresh_token: session.refresh_token,
            phone_number: session.phone_number || "",
            country_code: "62",
          },
        }),
        signal: AbortSignal.timeout(this.fallbackTimeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [GoPay] Gagal refresh token (${response.status}):`, errorText);
        return false;
      }

      const resData: any = await response.json();
      const payload = resData.data || resData;

      if (!payload.access_token) {
        console.error("❌ [GoPay] Respon refresh tidak memuat access_token valid:", resData);
        return false;
      }

      const expiresInSec = payload.expires_in || 3600 * 24 * 30; // Default 30 hari jika tak terdefinisi
      const updatedSession: GoPaySession = {
        ...session,
        access_token: payload.access_token,
        refresh_token: payload.refresh_token || session.refresh_token,
        expires_in: expiresInSec,
        expires_at: Date.now() + expiresInSec * 1000,
      };

      this.saveSession(updatedSession);
      console.log("🎉 [GoPay] Sesi token GoBiz berhasil di-refresh otomatis!");
      return true;
    } catch (err: any) {
      console.error("❌ [GoPay] Exception saat auto-refresh token:", err.message);
      return false;
    }
  }

  public async getValidHeaders(): Promise<Record<string, string> | null> {
    let session = this.loadSession();
    if (!session) return null;

    if (this.isSessionExpired(session)) {
      console.log("⏳ [GoPay] Token mendekati kadaluarsa, memicu refresh otomatis...");
      const refreshed = await this.refreshSession();
      if (refreshed) {
        session = this.loadSession();
      }
    }

    if (!session || !session.access_token) return null;

    return {
      "Authorization": `Bearer ${session.access_token}`,
      "Cookie": `access_token=${session.access_token}; refresh_token=${session.refresh_token}; auth_method=goid`,
      "authentication-type": "go-id",
      "Accept": "application/json, text/plain, */*",
      "gojek-country-code": "ID",
      "gojek-timezone": "Asia/Jakarta",
      "Origin": "https://portal.gofoodmerchant.co.id",
      "Referer": "https://portal.gofoodmerchant.co.id/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
      "x-appid": "go-biz-web-dashboard",
      "x-appversion": "platform-v3.111.0-1708bc9a",
      "x-deviceos": "Web",
      "x-phonemake": "Windows 10 64-bit",
      "x-phonemodel": "Chrome 150.0.0.0 on Windows 10 64-bit",
      "x-platform": "Web",
      "x-uniqueid": crypto.randomUUID(),
      "x-user-locale": "en-GB",
      "x-user-type": "merchant",
    };
  }

  public isAvailable(): boolean {
    const staticQr = this.getStaticQrString();
    const hasStatic = Boolean(staticQr && staticQr.startsWith("00020101"));
    const session = this.loadSession();
    const hasToken = Boolean(session && session.access_token);

    if (!hasStatic) {
      console.warn("⚠️ [GoPay Gateway] Tidak aktif: GOPAY_QRIS_STATIC belum disetel di .env (wajib diawali '00020101').");
    }
    if (!hasToken) {
      console.warn("⚠️ [GoPay Gateway] Tidak aktif: Sesi GoPay (.gopay_session.json atau GOPAY_SESSION_JSON) belum ditemukan di server.");
    }

    return hasStatic && hasToken;
  }

  // =========================================================================
  // 2. GENERATOR QRIS DINAMIS STANDAR EMVCo (CRC-16 CCITT)
  // =========================================================================

  private calculateCRC16(payload: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, "0");
  }

  /**
   * Mengubah QRIS Statis menjadi QRIS Dinamis standar EMVCo dengan menyuntikkan nominal
   */
  public generateDynamicQRIS(amount: number): string | null {
    const staticQr = this.getStaticQrString();
    if (!staticQr) return null;
    let payload = staticQr.trim();

    // Hapus Tag 63 (CRC lama) jika ada
    const idx63 = payload.indexOf("6304");
    if (idx63 !== -1) {
      payload = payload.substring(0, idx63);
    }

    // Parse TLV Tags
    const tags: Array<{ tag: string; val: string }> = [];
    let i = 0;
    try {
      while (i < payload.length) {
        const tag = payload.substring(i, i + 2);
        const length = parseInt(payload.substring(i + 2, i + 4), 10);
        if (isNaN(length)) break;
        const val = payload.substring(i + 4, i + 4 + length);
        tags.push({ tag, val });
        i += 4 + length;
      }
    } catch {
      return null;
    }

    const amountStr = Math.round(amount).toString();
    const newTags: Array<{ tag: string; val: string }> = [];
    let hasTag54 = false;

    for (const item of tags) {
      if (item.tag === "01") {
        // Tag 01: 11 (Static) -> 12 (Dynamic)
        newTags.push({ tag: "01", val: "12" });
      } else if (item.tag === "54") {
        newTags.push({ tag: "54", val: amountStr });
        hasTag54 = true;
      } else if (item.tag === "58" && !hasTag54) {
        newTags.push({ tag: "54", val: amountStr });
        hasTag54 = true;
        newTags.push(item);
      } else {
        newTags.push(item);
      }
    }

    if (!hasTag54) {
      newTags.push({ tag: "54", val: amountStr });
    }

    let result = "";
    for (const item of newTags) {
      const lenStr = item.val.length.toString().padStart(2, "0");
      result += `${item.tag}${lenStr}${item.val}`;
    }

    result += "6304";
    const checksum = this.calculateCRC16(result);
    return result + checksum;
  }

  /**
   * Membuat QRIS Dinamis lengkap dengan Data URL gambar PNG lokal
   */
  public async createQrisCharge(amount: number, expiryMinutes = 15): Promise<DynamicQrisResult> {
    if (!this.staticQrString) {
      throw new Error("GOPAY_QRIS_STATIC belum dikonfigurasi di environment variables (.env)");
    }

    const dynamicCode = this.generateDynamicQRIS(amount);
    if (!dynamicCode) {
      throw new Error("Gagal menguraikan struktur EMVCo dari GOPAY_QRIS_STATIC");
    }

    // Render QR Code ke Base64 PNG Data URL secara in-memory (0 latency, 0 external deps)
    const qrDataUrl = await QRCode.toDataURL(dynamicCode, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    return {
      qrString: dynamicCode,
      qrCodeUrl: qrDataUrl,
      amount: Math.round(amount),
      expiresAt,
    };
  }

  // =========================================================================
  // 3. PEMANTAU TRANSAKSI MUTASI (Real-Time Settlement Check)
  // =========================================================================

  /**
   * Memeriksa mutasi masuk di GoPay Merchant Analytics API
   */
  public async verifyPayment(
    targetAmount: number,
    startTime: Date | string,
    claimedTxIds: Set<string> = new Set()
  ): Promise<GoPayTransaction | null> {
    let headers = await this.getValidHeaders();
    if (!headers) {
      throw new Error("Sesi GoPay Merchant belum ada atau kadaluarsa. Harap login via `npm run gopay:login`.");
    }

    // Gunakan buffer 5 menit ke belakang untuk mengantisipasi selisih jam (clock skew) antara server dan Gojek
    const filterStartMs = new Date(startTime).getTime();
    const filterStartDate = new Date(filterStartMs - 5 * 60 * 1000);
    const startIso = filterStartDate.toISOString();
    const nowIso = new Date().toISOString();
    const merchantIdParam = this.merchantId ? `&merchant_ids=${encodeURIComponent(this.merchantId)}` : "";

    const fetchUrl = `https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions?from=0&size=30&statuses=SETTLEMENT,CAPTURE&payment_types=QRIS,GOPAY,OFFLINE_CREDIT_CARD,OFFLINE_DEBIT_CARD&start_time=${encodeURIComponent(startIso)}&end_time=${encodeURIComponent(nowIso)}${merchantIdParam}`;

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(this.fallbackTimeoutMs),
      });
    } catch (fetchErr: any) {
      console.warn("⚠️ [GoPay] Gagal menghubungi Gojek Analytics API:", fetchErr.message);
      return null;
    }

    // Tangani 401 Unauthorized secara proaktif
    if (response.status === 401) {
      console.warn("⚠️ [GoPay] Mendapat 401 Unauthorized dari Gojek API. Menjalankan auto-refresh sesi...");
      const refreshed = await this.refreshSession();
      if (refreshed) {
        headers = await this.getValidHeaders();
        if (headers) {
          try {
            response = await fetch(fetchUrl, {
              method: "GET",
              headers,
              signal: AbortSignal.timeout(this.fallbackTimeoutMs),
            });
          } catch {
            return null;
          }
        }
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`⚠️ [GoPay] Status HTTP ${response.status} dari Gojek Analytics:`, errText);
      return null;
    }

    const json: any = await response.json();
    const transactions = json.transactions || json.data?.transactions || json.data || [];

    for (const tx of transactions) {
      const rawGross = parseFloat(tx.gross_amount || tx.real_gross_amount || tx.amount?.value || tx.amount || "0");
      let txAmount = Math.round(rawGross);

      // Normalisasi nominal: Gojek Merchant Analytics API mengembalikan nominal dalam sen / minor unit (x100)
      // Contoh: Rp 3.060 dikembalikan sebagai 306000.
      if (txAmount === targetAmount * 100 || (rawGross > 0 && Math.round(rawGross / 100) === targetAmount)) {
        txAmount = targetAmount;
      }

      const txTimestamp = new Date(tx.transaction_time || tx.settlement_time || tx.created_at || 0).getTime();
      const txId = String(tx.id || tx.order_id || tx.wallstreet_transaction_id || "");

      // Pastikan nominal persis sama, waktu transaksi valid, dan belum pernah diklaim
      if (txAmount === targetAmount && txTimestamp >= filterStartMs - 5 * 60 * 1000) {
        if (claimedTxIds.has(txId)) {
          continue; // Transaksi sudah dipakai di DB
        }

        return {
          id: txId,
          orderId: tx.order_id || txId,
          amount: txAmount,
          payerIssuer: tx.qris_provider_aspi_issuer || tx.payer_issuer || "GoPay / QRIS Bank",
          paymentType: tx.payment_type || "QRIS",
          transactionTime: tx.transaction_time || tx.settlement_time || new Date().toISOString(),
          raw: tx,
        };
      }
    }

    return null;
  }
}

export const gopayService = new GopayService();
