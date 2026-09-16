/**
 * Service Integrasi WhatsApp Gateway (GoWA Self-Hosted & Fallback)
 * Mendukung validasi nomor WhatsApp aktif dan pengiriman pesan notifikasi otomatis
 * Menggunakan GoWA REST API (https://github.com/aldinokemal/go-whatsapp-web-multidevice)
 */

export interface WhatsAppValidateResult {
  valid: boolean;
  registered: boolean;
  provider?: string;
  formattedPhone?: string;
  message?: string;
}

export interface WhatsAppSendResult {
  success: boolean;
  message?: string;
  data?: any;
}

// Prefix Provider Seluler Resmi Indonesia
const INDONESIAN_OPERATORS: Record<string, string[]> = {
  Telkomsel: ['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'],
  'Indosat Ooredoo': ['0814', '0815', '0816', '0855', '0856', '0857', '0858'],
  'XL Axiata': ['0817', '0818', '0819', '0859', '0877', '0878'],
  Axis: ['0831', '0832', '0833', '0838'],
  Smartfren: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'],
  'Tri (3)': ['0895', '0896', '0897', '0898', '0899'],
};

// Daftar pola nomor fiktif / dummy yang umum dipakai asal ketik
const DUMMY_PHONE_PATTERNS = [
  /^08123456789/,
  /^08987654321/,
  /^0812345678/,
  /^08(\d)\1{7,}$/, // Angka kembar berulang (misal 08111111111, 08555555555)
  /^0800/,          // Bebas pulsa
  /^0809/,          // Premium call
];

/**
 * Normalisasi nomor telepon ke format lokal (diawali 08)
 */
export function normalizeToLocalPhone(rawPhone: string): string {
  let cleaned = String(rawPhone || '').replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (cleaned.startsWith('8')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Normalisasi nomor telepon ke format internasional (diawali 62)
 */
export function normalizeToIntlPhone(rawPhone: string): string {
  let cleaned = String(rawPhone || '').replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
}

/**
 * Format nomor WhatsApp ke format JID (contoh: 628xxxxxxxx@s.whatsapp.net)
 */
export function formatToWhatsAppJid(rawPhone: string): string {
  const intl = normalizeToIntlPhone(rawPhone);
  if (intl.includes('@')) return intl;
  return `${intl}@s.whatsapp.net`;
}

/**
 * Deteksi operator seluler berdasarkan 4 digit pertama
 */
export function detectIndonesianOperator(phone: string): string | null {
  const norm = normalizeToLocalPhone(phone);
  if (norm.length < 4) return null;
  const prefix4 = norm.slice(0, 4);

  for (const [operator, prefixes] of Object.entries(INDONESIAN_OPERATORS)) {
    if (prefixes.includes(prefix4)) {
      return operator;
    }
  }
  return null;
}

/**
 * Validasi lokal nomor seluler Indonesia (0 ms / Real-time)
 */
export function validateIndonesianPhoneLocal(rawPhone: string): {
  isValid: boolean;
  provider?: string;
  message?: string;
  normalizedPhone?: string;
} {
  const clean = normalizeToLocalPhone(rawPhone);

  // 1. Cek awalan nomor seluler
  if (!clean.startsWith('08')) {
    return {
      isValid: false,
      message: 'Nomor harus diawali 08 atau +62 (Nomor seluler Indonesia)',
    };
  }

  // 2. Cek panjang digit (Standar nomor HP Indonesia: 10 - 14 digit)
  if (clean.length < 10) {
    return {
      isValid: false,
      message: `Nomor terlalu pendek (${clean.length} digit). Minimal 10 digit.`,
    };
  }

  if (clean.length > 14) {
    return {
      isValid: false,
      message: `Nomor terlalu panjang (${clean.length} digit). Maksimal 14 digit.`,
    };
  }

  // 3. Deteksi Operator Seluler Resmi
  const provider = detectIndonesianOperator(clean);
  if (!provider) {
    return {
      isValid: false,
      message: 'Prefix operator tidak dikenal. Pastikan nomor dari operator resmi (Telkomsel, Indosat, XL, Tri, Smartfren, Axis).',
    };
  }

  // 4. Deteksi Nomor Dummy / Fiktif
  for (const pattern of DUMMY_PHONE_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isValid: false,
        message: 'Nomor tidak valid / terdeteksi sebagai nomor contoh fiktif.',
      };
    }
  }

  return {
    isValid: true,
    provider,
    normalizedPhone: clean,
  };
}

/**
 * Mendapatkan konfigurasi GoWA dari environment variables
 */
function getGowaConfig() {
  const rawUrl = process.env.GOWA_BASE_URL || 'https://gowa.herama.my.id';
  const baseUrl = rawUrl.replace(/\/+$/, '');
  const deviceId = process.env.GOWA_DEVICE_ID || '83fc1a02-3beb-4dce-8607-9b2dc53da917';
  const user = process.env.GOWA_BASIC_AUTH_USER?.trim() || '';
  const pass = process.env.GOWA_BASIC_AUTH_PASSWORD?.trim() || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (deviceId) {
    headers['X-Device-Id'] = deviceId;
  }

  if (user && pass) {
    const authString = Buffer.from(`${user}:${pass}`).toString('base64');
    headers['Authorization'] = `Basic ${authString}`;
  }

  return { baseUrl, deviceId, headers, hasAuth: Boolean(user && pass) };
}

/**
 * Memvalidasi apakah nomor terdaftar di WhatsApp menggunakan GoWA API
 * (Dengan perlindungan timeout dan graceful fallback ke validasi lokal)
 */
export async function validateWhatsAppNumber(phone: string): Promise<WhatsAppValidateResult> {
  const localCheck = validateIndonesianPhoneLocal(phone);
  if (!localCheck.isValid) {
    return {
      valid: false,
      registered: false,
      message: localCheck.message,
    };
  }

  const { baseUrl, deviceId, headers, hasAuth } = getGowaConfig();

  // Jika basic auth belum diatur di .env, fallback aman ke validasi lokal operator yang lolos
  if (!hasAuth) {
    return {
      valid: true,
      registered: true,
      provider: localCheck.provider,
      formattedPhone: localCheck.normalizedPhone,
      message: 'Nomor valid (Operator ' + localCheck.provider + ')',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // Max 4 detik
    const intlPhone = normalizeToIntlPhone(phone);

    const checkUrl = new URL(`${baseUrl}/user/check`);
    checkUrl.searchParams.set('phone', intlPhone);
    if (deviceId) {
      checkUrl.searchParams.set('device_id', deviceId);
    }

    const res = await fetch(checkUrl.toString(), {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json: any = await res.json();
      const results = json.results || {};
      
      // Cek apakah user ada di WhatsApp
      const isOnWa = results.is_on_whatsapp === true || results.is_registered === true || results.registered === true;
      const isNotOnWa = results.is_on_whatsapp === false || results.is_registered === false || results.registered === false;

      if (isOnWa) {
        return {
          valid: true,
          registered: true,
          provider: localCheck.provider,
          formattedPhone: localCheck.normalizedPhone,
          message: `Nomor terverifikasi aktif di WhatsApp (${localCheck.provider})`,
        };
      }

      if (isNotOnWa) {
        return {
          valid: false,
          registered: false,
          provider: localCheck.provider,
          message: 'Nomor ini tidak terdaftar di WhatsApp. Pastikan nomor sudah memiliki akun WhatsApp aktif.',
        };
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Gagal menghubungi GoWA API untuk cek nomor (Timeout/Offline), fallback ke validasi lokal:', err.message);
  }

  // Fallback: Jika GoWA timeout atau offline, izinkan nomor yang sudah lolos validasi operator
  return {
    valid: true,
    registered: true,
    provider: localCheck.provider,
    formattedPhone: localCheck.normalizedPhone,
    message: 'Nomor terverifikasi (' + localCheck.provider + ')',
  };
}

/**
 * Mengirim pesan WhatsApp ke pembeli melalui GoWA REST API
 */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppSendResult> {
  const { baseUrl, deviceId, headers, hasAuth } = getGowaConfig();

  // Validasi konfigurasi
  if (!hasAuth && !process.env.FONNTE_TOKEN) {
    console.warn('⚠️ Kredensial GoWA (GOWA_BASIC_AUTH_USER / GOWA_BASIC_AUTH_PASSWORD) belum diatur di backend/.env.');
  }

  const jid = formatToWhatsAppJid(phone);

  try {
    const sendUrl = `${baseUrl}/send/message`;
    const bodyPayload = {
      phone: jid,
      message,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 detik

    const res = await fetch(sendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json: any = await res.json();
      console.log(`✅ [GoWA] Pesan berhasil dikirim ke ${jid}:`, json.message || json.code || 'OK');
      return {
        success: true,
        message: json.message || 'Pesan terkirim ke WhatsApp',
        data: json,
      };
    } else {
      const errText = await res.text().catch(() => '');
      console.warn(`⚠️ [GoWA] Gagal mengirim pesan ke ${jid} (HTTP ${res.status}):`, errText);
    }
  } catch (err: any) {
    console.error(`❌ [GoWA] Error saat menghubungi GoWA API:`, err.message);
  }

  // Graceful Fallback ke Fonnte (jika token Fonnte lama masih ada)
  const fonnteToken = process.env.FONNTE_TOKEN?.trim();
  if (fonnteToken && fonnteToken !== 'your_fonnte_token_here') {
    try {
      console.log(`🔄 Mencoba fallback pengiriman via Fonnte untuk ${phone}...`);
      const intlPhone = normalizeToIntlPhone(phone);
      const formData = new URLSearchParams();
      formData.append('target', intlPhone);
      formData.append('message', message);
      formData.append('countryCode', '62');

      const res = await fetch('https://api.fonnte.com/send', {
        method: 'POST',
        headers: { Authorization: fonnteToken },
        body: formData,
      });

      const json: any = await res.json();
      return {
        success: Boolean(json.status),
        message: json.reason || json.message || 'Pesan terkirim via fallback Fonnte',
        data: json,
      };
    } catch (fonnteErr: any) {
      console.error('❌ Error fallback Fonnte:', fonnteErr.message);
    }
  }

  return {
    success: false,
    message: 'Gagal mengirim pesan WhatsApp via GoWA',
  };
}

/**
 * Mengirim 1 notifikasi WhatsApp resmi saat pesanan lunas & akun siap
 * Format pesan ramah, santai (tidak terlalu baku), rapi, dan menarik
 */
export async function sendOrderSuccessNotification(
  phone: string,
  orderNumber: string,
  productName: string,
  totalAmount: number,
  clientUrl: string
): Promise<WhatsAppSendResult> {
  const formattedAmount = totalAmount ? `Rp ${totalAmount.toLocaleString("id-ID")}` : "-";
  const adminPhone = process.env.ADMIN_WHATSAPP_PHONE || "085750231336";
  const cleanAdminPhone = adminPhone.replace(/\D/g, "");
  const intlAdminPhone = cleanAdminPhone.startsWith("0") 
    ? "62" + cleanAdminPhone.slice(1) 
    : cleanAdminPhone;
  const groupUrl = process.env.WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/KeV14EMUo6m1aUlQb9TL0K";

  const message = 
`Halo Kak! Pesanan kamu di *Nara Premium* udah siap nih ✨

📦 *${productName || "Produk Digital"}*
🧾 No. Pesanan: *#${orderNumber}*
💰 Total: *${formattedAmount}* (Lunas)

Langsung ambil email & password akun kamu di sini ya:
👉 ${clientUrl}/invoice/${orderNumber}

📢 *Mau info update stok & promo produk terbaru?*
Yuk gabung ke grup WhatsApp Nara Premium:
👉 ${groupUrl}

Kalau butuh bantuan login atau klaim garansi, silakan hubungi Admin Nara di sini ya:
💬 wa.me/${intlAdminPhone} (${adminPhone})

Makasih & have fun! 🍿🙌`;

  return sendWhatsAppMessage(phone, message);
}

/**
 * Backward compatibility: Mengarahkan notifikasi ke template tunggal yang baru
 */
export async function sendOrderPaidNotification(
  phone: string,
  orderNumber: string,
  productName: string,
  totalAmount: number,
  clientUrl: string
): Promise<WhatsAppSendResult> {
  return sendOrderSuccessNotification(phone, orderNumber, productName, totalAmount, clientUrl);
}

export async function sendOrderCompletedNotification(
  phone: string,
  orderNumber: string,
  productName: string,
  clientUrl: string
): Promise<WhatsAppSendResult> {
  return sendOrderSuccessNotification(phone, orderNumber, productName, 0, clientUrl);
}

// Backward Compatibility Aliases agar kode lama tidak breaking
export const validateWithFonnte = validateWhatsAppNumber;
export const sendFonnteMessage = sendWhatsAppMessage;
export type FonnteValidateResult = WhatsAppValidateResult;
export type FonnteSendResult = WhatsAppSendResult;
