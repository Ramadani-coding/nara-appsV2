import { API_BASE_URL } from './api';

export interface LocalPhoneValidationResult {
  isValid: boolean;
  provider: string | null;
  message?: string;
  normalizedPhone: string;
}

export interface RemotePhoneValidationResult {
  valid: boolean;
  registered: boolean;
  provider?: string;
  formattedPhone?: string;
  message?: string;
}

// Prefix Provider Seluler Resmi Indonesia
export const INDONESIAN_OPERATORS: Record<string, string[]> = {
  Telkomsel: ['0811', '0812', '0813', '0821', '0822', '0823', '0851', '0852', '0853'],
  'Indosat Ooredoo': ['0814', '0815', '0816', '0855', '0856', '0857', '0858'],
  'XL Axiata': ['0817', '0818', '0819', '0859', '0877', '0878'],
  Axis: ['0831', '0832', '0833', '0838'],
  Smartfren: ['0881', '0882', '0883', '0884', '0885', '0886', '0887', '0888', '0889'],
  'Tri (3)': ['0895', '0896', '0897', '0898', '0899'],
};

// Pola nomor dummy / fiktif yang sering dimasukkan asal-asalan
const DUMMY_PATTERNS = [
  /^08123456789/,
  /^08987654321/,
  /^0812345678/,
  /^08(\d)\1{7,}$/, // Angka kembar (misal 08111111111, 08222222222)
  /^0800/,          // Bebas pulsa
  /^0809/,          // Premium call
];

/**
 * Normalisasi nomor HP ke format lokal Indonesia (08...)
 */
export function normalizeToLocalPhone(raw: string): string {
  let cleaned = String(raw || '').replace(/\D/g, '');
  if (cleaned.startsWith('62')) {
    cleaned = '0' + cleaned.slice(2);
  } else if (cleaned.startsWith('8')) {
    cleaned = '0' + cleaned;
  }
  return cleaned;
}

/**
 * Deteksi operator seluler berdasarkan prefix nomor
 */
export function detectOperator(raw: string): string | null {
  const norm = normalizeToLocalPhone(raw);
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
 * Validasi lokal format dan operator seluler Indonesia (0 ms / Instant)
 */
export function validatePhoneLocal(raw: string): LocalPhoneValidationResult {
  const clean = normalizeToLocalPhone(raw);

  if (!clean) {
    return {
      isValid: false,
      provider: null,
      message: 'Nomor WhatsApp wajib diisi',
      normalizedPhone: clean,
    };
  }

  // 1. Cek awalan nomor seluler
  if (!clean.startsWith('08')) {
    return {
      isValid: false,
      provider: null,
      message: 'Nomor harus nomor seluler Indonesia (diawali 08 atau +62)',
      normalizedPhone: clean,
    };
  }

  // 2. Deteksi operator seluler
  const provider = detectOperator(clean);

  // Jika masih di bawah 4 digit, belum bisa mendeteksi operator
  if (clean.length < 4) {
    return {
      isValid: false,
      provider: null,
      message: 'Masukkan nomor WhatsApp lengkap',
      normalizedPhone: clean,
    };
  }

  if (!provider) {
    return {
      isValid: false,
      provider: null,
      message: 'Prefix operator tidak dikenal (Gunakan Telkomsel, Indosat, XL, Tri, Axis, Smartfren)',
      normalizedPhone: clean,
    };
  }

  // 3. Cek panjang digit
  if (clean.length < 10) {
    return {
      isValid: false,
      provider,
      message: `Nomor terlalu pendek (${clean.length}/10-13 digit)`,
      normalizedPhone: clean,
    };
  }

  if (clean.length > 13) {
    return {
      isValid: false,
      provider,
      message: `Nomor terlalu panjang (${clean.length} digit, maks 13 digit)`,
      normalizedPhone: clean,
    };
  }

  // 4. Deteksi nomor dummy / angka kembar
  for (const pattern of DUMMY_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isValid: false,
        provider,
        message: 'Nomor fiktif / pola angka tidak valid',
        normalizedPhone: clean,
      };
    }
  }

  return {
    isValid: true,
    provider,
    message: undefined,
    normalizedPhone: clean,
  };
}

/**
 * Validasi nomor ke server backend (memanggil Fonnte jika dikonfigurasi)
 */
export async function validatePhoneWithBackend(phone: string): Promise<RemotePhoneValidationResult> {
  const local = validatePhoneLocal(phone);
  if (!local.isValid) {
    return {
      valid: false,
      registered: false,
      provider: local.provider || undefined,
      message: local.message,
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/orders/validate-phone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ phone }),
    });

    const json = await res.json();
    if (json.success) {
      return {
        valid: Boolean(json.valid),
        registered: Boolean(json.registered),
        provider: json.provider || local.provider,
        formattedPhone: json.formattedPhone || local.normalizedPhone,
        message: json.message,
      };
    }

    return {
      valid: false,
      registered: false,
      provider: local.provider || undefined,
      message: json.message || 'Nomor WhatsApp tidak valid',
    };
  } catch (_err) {
    // Fallback jika backend offline: gunakan hasil validasi lokal
    return {
      valid: local.isValid,
      registered: local.isValid,
      provider: local.provider || undefined,
      formattedPhone: local.normalizedPhone,
      message: local.message,
    };
  }
}
