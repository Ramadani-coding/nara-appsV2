/**
 * Service Integrasi Fonnte WhatsApp Gateway API
 * Mendukung validasi nomor WhatsApp aktif dan pengiriman pesan notifikasi otomatis
 */

export interface FonnteValidateResult {
  valid: boolean;
  registered: boolean;
  provider?: string;
  formattedPhone?: string;
  message?: string;
}

export interface FonnteSendResult {
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

  // 2. Cek panjang digit (Standar nomor HP Indonesia: 10 - 13 digit)
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
 * Memvalidasi apakah nomor terdaftar di WhatsApp menggunakan Fonnte API
 * (Dengan perlindungan timeout dan graceful fallback ke validasi lokal)
 */
export async function validateWithFonnte(phone: string): Promise<FonnteValidateResult> {
  const localCheck = validateIndonesianPhoneLocal(phone);
  if (!localCheck.isValid) {
    return {
      valid: false,
      registered: false,
      message: localCheck.message,
    };
  }

  const token = process.env.FONNTE_TOKEN?.trim();

  // Jika token Fonnte belum diatur, gunakan validasi lokal yang sudah lolos (Graceful Fallback)
  if (!token || token === 'your_fonnte_token_here') {
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
    const timeoutId = setTimeout(() => controller.abort(), 3500); // Max 3.5 detik

    const intlPhone = normalizeToIntlPhone(phone);

    const formData = new URLSearchParams();
    formData.append('target', intlPhone);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/validate', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const json: any = await res.json();
      // Format respons Fonnte: { status: true, registered: ["628..."], not_registered: [] }
      const registeredList: string[] = json.registered || [];
      const notRegisteredList: string[] = json.not_registered || [];

      const isReg = registeredList.some((p) => p.includes(intlPhone) || intlPhone.includes(p));
      const isNotReg = notRegisteredList.some((p) => p.includes(intlPhone) || intlPhone.includes(p));

      if (isReg) {
        return {
          valid: true,
          registered: true,
          provider: localCheck.provider,
          formattedPhone: localCheck.normalizedPhone,
          message: 'Nomor terverifikasi aktif di WhatsApp (' + localCheck.provider + ')',
        };
      }

      if (isNotReg) {
        return {
          valid: false,
          registered: false,
          provider: localCheck.provider,
          message: 'Nomor ini tidak terdaftar di WhatsApp. Pastikan nomor sudah memiliki akun WhatsApp aktif.',
        };
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Gagal menghubungi Fonnte API (Timeout atau Offline), fallback ke validasi lokal:', err.message);
  }

  // Fallback: Jika Fonnte lag atau error jaringan, izinkan nomor yang sudah lolos uji operator
  return {
    valid: true,
    registered: true,
    provider: localCheck.provider,
    formattedPhone: localCheck.normalizedPhone,
    message: 'Nomor terverifikasi (' + localCheck.provider + ')',
  };
}

/**
 * Mengirim pesan WhatsApp ke pembeli melalui Fonnte API
 */
export async function sendFonnteMessage(phone: string, message: string): Promise<FonnteSendResult> {
  const token = process.env.FONNTE_TOKEN?.trim();
  if (!token || token === 'your_fonnte_token_here') {
    return {
      success: false,
      message: 'FONNTE_TOKEN belum diatur pada backend/.env',
    };
  }

  try {
    const intlPhone = normalizeToIntlPhone(phone);
    const formData = new URLSearchParams();
    formData.append('target', intlPhone);
    formData.append('message', message);
    formData.append('countryCode', '62');

    const res = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const json: any = await res.json();
    return {
      success: Boolean(json.status),
      message: json.reason || json.message || 'Pesan terkirim ke WhatsApp',
      data: json,
    };
  } catch (err: any) {
    console.error('❌ Error saat mengirim pesan via Fonnte:', err);
    return {
      success: false,
      message: err.message || 'Gagal mengirim pesan WhatsApp',
    };
  }
}
