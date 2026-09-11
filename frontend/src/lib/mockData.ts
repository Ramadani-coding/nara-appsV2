import { fetchLiveProducts } from './api';

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface ProductPackage {
  id: string;
  providerId?: number | string;
  name: string;
  serviceId: string;
  serviceName: string;
  type: 'Privat' | 'Sharing' | 'Invite' | 'Head' | 'Family';
  duration: string;
  stockCount: number;
  stockBadge: string; // e.g. "ADA 7", "HABIS"
  discountPercent?: number; // e.g. 97, 99
  originalPrice: number;
  providerPrice?: number;
  marginValue?: number;
  price: number;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
  isMaintenance?: boolean;
  maxAllowedQty?: number;
}

export interface ServiceProduct {
  id: string;
  name: string;
  category: 'Desain' | 'Musik & Video' | 'Lainnya';
  categorySlug: 'desain' | 'musik-video' | 'lainnya';
  tagline: string;
  badge?: 'HOT' | 'AUTO' | 'SMART';
  badgeColor?: 'pink' | 'emerald' | 'blue';
  iconId: string;
  imageUrl?: string;
  description: string;
  genreTag: string;
  accountTypeTag: string;
  packages: ProductPackage[];
  isActive?: boolean;
}

export const CATEGORIES: Category[] = [
  { id: "desain", name: "Desain", slug: "desain" },
  { id: "musik-video", name: "Musik & Video", slug: "musik-video" },
  { id: "lainnya", name: "Lainnya", slug: "lainnya" },
];

/**
 * Data awal riil yang diambil langsung dari katalog supplier Premiumku (https://premku.com)
 */
export let SERVICES: ServiceProduct[] = [
  {
    id: "alight-motion",
    name: "Alight Motion",
    category: "Desain",
    categorySlug: "desain",
    tagline: "Mulai Rp 5.400",
    badge: "HOT",
    badgeColor: "pink",
    iconId: "alight-motion",
    imageUrl: "https://cdn.premku.com/img/am.png",
    genreTag: "DESAIN",
    accountTypeTag: "Private Account",
    description: "Animasi motion design profesional, efek visual tanpa batas, preset XML 5MB+, ekspor tanpa watermark. Langsung aktif dan garansi supplier.",
    packages: [
      {
        id: "am-2027",
        providerId: 116,
        serviceId: "alight-motion",
        serviceName: "Alight Motion",
        name: "Alightmotion Exp Agustus 2027",
        type: "Privat",
        duration: "s/d 2027",
        stockCount: 69,
        stockBadge: "ADA 69",
        discountPercent: 99,
        originalPrice: 175000,
        providerPrice: 380,
        price: 5400,
        maxAllowedQty: 9,
        description: "AKUN AM EXPIRED AGUSTUS 2027 HARGA PALING MURAAAH CUMA DISINI. AKSES TMAIL, SUPPORT ALL DEVICES TERMASUK IOS / IPHONE.",
        imageUrl: "https://cdn.premku.com/img/am.png"
      }
    ]
  },
  {
    id: "canva",
    name: "Canva Pro",
    category: "Desain",
    categorySlug: "desain",
    tagline: "Mulai Rp1.500",
    badge: "AUTO",
    badgeColor: "emerald",
    iconId: "canva",
    imageUrl: "https://cdn.premku.com/img/canva.png",
    genreTag: "DESAIN",
    accountTypeTag: "Head & Invite",
    description: "Desain visual tanpa batas dengan Canva Pro: jutaan template premium, penghapus background 1 klik, font eksklusif, dan cloud storage besar.",
    packages: [
      {
        id: "canva-3m-invite",
        providerId: 130,
        serviceId: "canva",
        serviceName: "Canva Pro",
        name: "Canva Pro 3 Bulan Invite",
        type: "Invite",
        duration: "3 Bulan",
        stockCount: 29,
        stockBadge: "ADA 29",
        discountPercent: 99,
        originalPrice: 950000,
        price: 1500,
        description: "Invite ke email sendiri, aktif s/d 3 bulanan. Sistem auto-deteksi 1 orderan untuk 1 email.",
        imageUrl: "https://cdn.premku.com/img/canva.png"
      },
      {
        id: "canva-3m-head",
        providerId: 3,
        serviceId: "canva",
        serviceName: "Canva Pro",
        name: "Canva Pro Head 3 Bulan",
        type: "Head",
        duration: "3 Bulan",
        stockCount: 7,
        stockBadge: "ADA 7",
        discountPercent: 97,
        originalPrice: 300000,
        price: 8000,
        description: "HEAD CANVA 3 BULAN, setelah login disarankan invite email pribadi dan jadikan admin. Maksimal invite hingga 98 peserta.",
        imageUrl: "https://cdn.premku.com/img/canva.png"
      }
    ]
  },
  {
    id: "capcut",
    name: "CapCut Pro",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Mulai Rp4.350",
    badge: "HOT",
    badgeColor: "pink",
    iconId: "capcut",
    imageUrl: "https://cdn.premku.com/img/capcut.png",
    genreTag: "VIDEO EDITING",
    accountTypeTag: "Private Account",
    description: "Akses semua fitur CapCut Pro resmi: auto-caption otomatis, ekspor resolusi 4K tanpa watermark, efek filter AI viral, dan cloud storage khusus editing.",
    packages: [
      {
        id: "capcut-1w-private",
        providerId: 4,
        serviceId: "capcut",
        serviceName: "CapCut Pro",
        name: "Capcut Pro 1 Minggu Private",
        type: "Privat",
        duration: "1 Minggu",
        stockCount: 8,
        stockBadge: "ADA 8",
        discountPercent: 95,
        originalPrice: 100000,
        price: 4350,
        description: "PRO PLAN 1 MINGGU (4-7 hari). Akun login privat maksimal 1 perangkat agar awet dan stabil.",
        imageUrl: "https://cdn.premku.com/img/capcut.png"
      },
      {
        id: "capcut-1m-private",
        providerId: 6,
        serviceId: "capcut",
        serviceName: "CapCut Pro",
        name: "Capcut Pro 1 Bulan Private",
        type: "Privat",
        duration: "1 Bulan",
        stockCount: 4,
        stockBadge: "ADA 4",
        discountPercent: 93,
        originalPrice: 460000,
        price: 31000,
        description: "AKUN REG INDONESIA ANTI RENEW LANGSUNG AKTIF 1 BULAN LEGAL PAID. Login maks 2 perangkat, support all devices.",
        imageUrl: "https://cdn.premku.com/img/capcut.png"
      }
    ]
  },
  {
    id: "viu",
    name: "Viu Premium",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Mulai Rp400",
    badge: "SMART",
    badgeColor: "blue",
    iconId: "viu",
    imageUrl: "https://cdn.premku.com/img/viu.png",
    genreTag: "DRAMA ASIA",
    accountTypeTag: "Private & Lifetime",
    description: "Nonton drama Korea, anime, dan serial Asia favorit tanpa jeda iklan dengan subtitle Indonesia berkualitas HD hingga Full HD.",
    packages: [
      {
        id: "viu-1y",
        providerId: 124,
        serviceId: "viu",
        serviceName: "Viu Premium",
        name: "Viu Premium 1 Tahun",
        type: "Privat",
        duration: "1 Tahun",
        stockCount: 119,
        stockBadge: "ADA 119",
        discountPercent: 99,
        originalPrice: 350000,
        providerPrice: 400,
        price: 400,
        description: "VIU 1 TAHUN garansi 1 bulan backfree, harga termurah langsung aktif.",
        imageUrl: "https://cdn.premku.com/img/viu.png"
      },
      {
        id: "viu-lifetime",
        providerId: 8,
        serviceId: "viu",
        serviceName: "Viu Premium",
        name: "Viu Premium Lifetime",
        type: "Privat",
        duration: "Lifetime",
        stockCount: 228,
        stockBadge: "ADA 228",
        discountPercent: 99,
        originalPrice: 150000,
        providerPrice: 550,
        price: 550,
        description: "AKTIF BISA SAMPAI LIFETIME. Stok cuci gudang super murah langsung aktif.",
        imageUrl: "https://cdn.premku.com/img/viu.png"
      }
    ]
  },
  {
    id: "prime-video",
    name: "Prime Video",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Mulai Rp3.000",
    badge: "AUTO",
    badgeColor: "emerald",
    iconId: "prime-video",
    imageUrl: "https://cdn.premku.com/img/prime.png",
    genreTag: "MOVIES & SERIES",
    accountTypeTag: "Private & Sharing",
    description: "Nikmati film blockbuster Amazon Originals, series eksklusif, Boys, Rings of Power, anime, dan serial Hollywood resolusi 4K HDR.",
    packages: [
      {
        id: "prime-1m-sharing",
        providerId: 162,
        serviceId: "prime-video",
        serviceName: "Prime Video",
        name: "Prime Video 1 Bulan Sharing",
        type: "Sharing",
        duration: "1 Bulan",
        stockCount: 1,
        stockBadge: "ADA 1",
        discountPercent: 99,
        originalPrice: 358153,
        price: 3000,
        description: "Sharing dengan user lain, garansi 20 hari, langsung login profil.",
        imageUrl: "https://cdn.premku.com/img/prime.png"
      },
      {
        id: "prime-1m-private",
        providerId: 10,
        serviceId: "prime-video",
        serviceName: "Prime Video",
        name: "Prime Video 1 Bulan Privat",
        type: "Privat",
        duration: "1 Bulan",
        stockCount: 2,
        stockBadge: "ADA 2",
        discountPercent: 96,
        originalPrice: 250000,
        price: 8000,
        description: "Akun private 1 bulan, full garansi 20 hari legal paid.",
        imageUrl: "https://cdn.premku.com/img/prime.png"
      }
    ]
  },
  {
    id: "aplikasi-ai",
    name: "Gemini Pro AI",
    category: "Lainnya",
    categorySlug: "lainnya",
    tagline: "Mulai Rp 28.000",
    badge: "HOT",
    badgeColor: "pink",
    iconId: "aplikasi-ai",
    imageUrl: "https://cdn.premku.com/img/ai.png",
    genreTag: "ARTIFICIAL INTELLIGENCE",
    accountTypeTag: "Email Invite",
    description: "Akses kecerdasan buatan Google Gemini Advanced / Pro dengan kapasitas token luas, analisis dokumen, coding pintar, dan integrasi Google Workspace.",
    packages: [
      {
        id: "gemini-1y-invite",
        providerId: 16,
        serviceId: "aplikasi-ai",
        serviceName: "Gemini Pro AI",
        name: "Gemini Pro Invite 1 Tahun+",
        type: "Invite",
        duration: "1 Tahun+",
        stockCount: 1,
        stockBadge: "ADA 1",
        discountPercent: 79,
        originalPrice: 135000,
        price: 28000,
        description: "INVITE KE EMAIL SENDIRI, AKTIF MAX 18 BULAN, GARANSI 1 BULAN jika ada kendala. Kirim email setelah order untuk di-invite.",
        imageUrl: "https://cdn.premku.com/img/ai.png"
      }
    ]
  },
  {
    id: "disney-plus",
    name: "Disney+ Hotstar",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Mulai Rp 15.000",
    badge: "SMART",
    badgeColor: "blue",
    iconId: "disney-plus",
    imageUrl: "https://cdn.premku.com/img/disney.png",
    genreTag: "STREAMING",
    accountTypeTag: "Sharing Account",
    description: "Akses ratusan film Marvel, Disney, Pixar, Star Wars, National Geographic, dan konten lokal eksklusif dengan resolusi jernih.",
    packages: [
      {
        id: "disney-1m-sharing",
        providerId: 158,
        serviceId: "disney-plus",
        serviceName: "Disney+ Hotstar",
        name: "Disney+ Sharing 1 Bulan 10U",
        type: "Sharing",
        duration: "1 Bulan",
        stockCount: 10,
        stockBadge: "ADA 10",
        discountPercent: 96,
        originalPrice: 468238,
        price: 15000,
        description: "Sharing 10 user 1 bulan, limit screen bergantian, login menggunakan kode via admin.",
        imageUrl: "https://cdn.premku.com/img/disney.png"
      }
    ]
  },
  {
    id: "drama-premium",
    name: "Akses Drama & WeTV",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Mulai Rp7.500",
    badge: "AUTO",
    badgeColor: "emerald",
    iconId: "drama-premium",
    imageUrl: "https://cdn.premku.com/img/akses.png",
    genreTag: "SHORT DRAMA",
    accountTypeTag: "Voucher & Sharing",
    description: "Akses serial drama pendek viral (Dracin) di 25+ platform: Dramabox, FreeReels, Reelshort, Shortmax, serta WeTV VIP.",
    packages: [
      {
        id: "wetv-1m-sharing",
        providerId: 128,
        serviceId: "drama-premium",
        serviceName: "Akses Drama & WeTV",
        name: "WETV Sharing 1 Bulan 8U",
        type: "Sharing",
        duration: "1 Bulan",
        stockCount: 2,
        stockBadge: "ADA 2",
        discountPercent: 93,
        originalPrice: 123456,
        price: 7500,
        description: "Akun sharing 8 user 1 bulan, garansi backfree only.",
        imageUrl: "https://cdn.premku.com/img/iqw.png"
      },
      {
        id: "drama-1m",
        providerId: 163,
        serviceId: "drama-premium",
        serviceName: "Akses Drama & WeTV",
        name: "Akses Drama 1 Bulan (Dracin dll)",
        type: "Privat",
        duration: "1 Bulan",
        stockCount: 6,
        stockBadge: "ADA 6",
        discountPercent: 96,
        originalPrice: 856593,
        price: 32000,
        description: "Kode Voucher nonton Drama 1 web tersedia -+ 25 aplikasi: Dramabox, FreeReels, Reelshort, Shortmax, dll. Aktif 1 Bulan.",
        imageUrl: "https://cdn.premku.com/img/akses.png"
      },
      {
        id: "drama-3m",
        providerId: 164,
        serviceId: "drama-premium",
        serviceName: "Akses Drama & WeTV",
        name: "Akses Drama 3 Bulan (Dracin dll)",
        type: "Privat",
        duration: "3 Bulan",
        stockCount: 12,
        stockBadge: "ADA 12",
        discountPercent: 98,
        originalPrice: 6537570,
        price: 85000,
        description: "Kode Voucher nonton Drama paket hemat 3 Bulan untuk 25+ aplikasi.",
        imageUrl: "https://cdn.premku.com/img/akses.png"
      }
    ]
  },
  {
    id: "wink",
    name: "Wink Retouch & AI",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Mulai Rp4.000",
    badge: "AUTO",
    badgeColor: "emerald",
    iconId: "wink",
    imageUrl: "https://cdn.premku.com/img/wink.png",
    genreTag: "AI RETOUCH",
    accountTypeTag: "Private Account",
    description: "Aplikasi retouch video dan foto berbasis AI: perbaiki kualitas video blur ke Ultra HD 4K, edit wajah otomatis, dan filter estetik.",
    packages: [
      {
        id: "wink-android",
        providerId: 133,
        serviceId: "wink",
        serviceName: "Wink Retouch & AI",
        name: "Wink 3-7 Hari Android Only",
        type: "Privat",
        duration: "3-7 Hari",
        stockCount: 1,
        stockBadge: "ADA 1",
        discountPercent: 99,
        originalPrice: 423298,
        price: 4000,
        description: "Masa aktif random 3-7 hari, khusus perangkat Android.",
        imageUrl: "https://cdn.premku.com/img/wink.png"
      },
      {
        id: "wink-all-device",
        providerId: 161,
        serviceId: "wink",
        serviceName: "Wink Retouch & AI",
        name: "Wink 3-7 Hari Random All Device",
        type: "Privat",
        duration: "3-7 Hari",
        stockCount: 6,
        stockBadge: "ADA 6",
        discountPercent: 93,
        originalPrice: 64856,
        price: 4400,
        description: "Aktif 3-7 hari random, bisa semua perangkat (iOS & Android). Login via opsi email.",
        imageUrl: "https://cdn.premku.com/img/wink.png"
      }
    ]
  },
  {
    id: "hma-vpn",
    name: "HMA VPN",
    category: "Lainnya",
    categorySlug: "lainnya",
    tagline: "Mulai Rp 5.000",
    badge: "SMART",
    badgeColor: "blue",
    iconId: "hma-vpn",
    imageUrl: "https://cdn.premku.com/img/hma.png",
    genreTag: "SECURITY & VPN",
    accountTypeTag: "PC & Mobile",
    description: "Jelajahi internet aman dengan enkripsi militer dan ratusan server global kecepatan tinggi tanpa batasan bandwidth.",
    packages: [
      {
        id: "hma-1m-vpn",
        providerId: 148,
        serviceId: "hma-vpn",
        serviceName: "HMA VPN",
        name: "HMA VPN 1 BULAN",
        type: "Privat",
        duration: "1 Bulan",
        stockCount: 5,
        stockBadge: "ADA 5",
        discountPercent: 97,
        originalPrice: 199500,
        price: 5000,
        description: "VPN HMA support PC dan HP. 1 Bulan garansi 15 hari.",
        imageUrl: "https://cdn.premku.com/img/hma.png"
      }
    ]
  },
  {
    id: "netflix",
    name: "Netflix",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Rp 20.500 (Habis)",
    badge: "SMART",
    badgeColor: "blue",
    iconId: "netflix",
    imageUrl: "https://cdn.premku.com/img/nv.png",
    genreTag: "STREAMING",
    accountTypeTag: "Sharing Account",
    description: "Tonton film orisinal, serial drama Korea, anime, dan film bioskop terpopuler dengan kualitas Ultra HD 4K.",
    packages: [
      {
        id: "netflix-20d-sharing",
        providerId: 139,
        serviceId: "netflix",
        serviceName: "Netflix",
        name: "Netflix Sharing 20D+ 1P2U",
        type: "Sharing",
        duration: "20 Hari+",
        stockCount: 0,
        stockBadge: "HABIS",
        discountPercent: 89,
        originalPrice: 189000,
        price: 20500,
        description: "1 Profile sharing 2 user, legal payment, login via kode ke admin.",
        imageUrl: "https://cdn.premku.com/img/nv.png"
      }
    ]
  },
  {
    id: "spotify",
    name: "Spotify Premium",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Rp 11.000 (Habis)",
    badge: "AUTO",
    badgeColor: "emerald",
    iconId: "spotify",
    imageUrl: "https://cdn.premku.com/img/spotify.png",
    genreTag: "MUSIK & PODCAST",
    accountTypeTag: "Private Account",
    description: "Dengarkan jutaan lagu dan podcast favorit tanpa jeda iklan, skip lagu tanpa batas, dan download offline kualitas 320kbps.",
    packages: [
      {
        id: "spotify-1m",
        providerId: 146,
        serviceId: "spotify",
        serviceName: "Spotify Premium",
        name: "Spotify 1 Bulan No Garansi",
        type: "Privat",
        duration: "1 Bulan",
        stockCount: 0,
        stockBadge: "HABIS",
        discountPercent: 86,
        originalPrice: 79500,
        price: 11000,
        description: "Akses reset password / login pakai kode jika terjadi kendala.",
        imageUrl: "https://cdn.premku.com/img/spotify.png"
      }
    ]
  },
  {
    id: "youtube",
    name: "YouTube Premium",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Rp 17.000 (Habis)",
    badge: "SMART",
    badgeColor: "blue",
    iconId: "youtube",
    imageUrl: "https://cdn.premku.com/img/yt.png",
    genreTag: "VIDEO & MUSIK",
    accountTypeTag: "Private GSuite",
    description: "Bebas iklan di seluruh perangkat, putar video di latar belakang (background play), akses YouTube Music Premium, dan download offline.",
    packages: [
      {
        id: "youtube-1m-gsuite",
        providerId: 120,
        serviceId: "youtube",
        serviceName: "YouTube Premium",
        name: "Youtube Gsuite 1 Bulan",
        type: "Privat",
        duration: "1 Bulan",
        stockCount: 0,
        stockBadge: "HABIS",
        discountPercent: 77,
        originalPrice: 75000,
        price: 17000,
        description: "GSUITE 1 BULAN lebih awet tahan banting, wajib ganti password dan amankan akun setelah login.",
        imageUrl: "https://cdn.premku.com/img/yt.png"
      }
    ]
  },
  {
    id: "vidio",
    name: "Vidio Premier",
    category: "Musik & Video",
    categorySlug: "musik-video",
    tagline: "Rp 27.000 (Habis)",
    badge: "AUTO",
    badgeColor: "emerald",
    iconId: "vidio",
    imageUrl: "https://cdn.premku.com/img/vidio.png",
    genreTag: "STREAMING BOLA & SERIES",
    accountTypeTag: "Mobile Plan",
    description: "Nonton siaran langsung BRI Liga 1, Premier League, UEFA Champions League, Vidio Original Series, dan tayangan TV nasional.",
    packages: [
      {
        id: "vidio-1m-mobile",
        providerId: 122,
        serviceId: "vidio",
        serviceName: "Vidio Premier",
        name: "VD Mobile 1 Bulan",
        type: "Sharing",
        duration: "1 Bulan",
        stockCount: 0,
        stockBadge: "HABIS",
        discountPercent: 64,
        originalPrice: 75000,
        price: 27000,
        description: "VIDIO MOBILE khusus HP / Tablet. Jangan ganti nomor HP di akun agar garansi tetap berlaku.",
        imageUrl: "https://cdn.premku.com/img/vidio.png"
      }
    ]
  }
];

// Helper functions
export const getServices = (categorySlug?: string, search?: string) => {
  let filtered = [...SERVICES];
  if (categorySlug) {
    filtered = filtered.filter(s => s.categorySlug === categorySlug);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.tagline.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.packages.some(p => p.name.toLowerCase().includes(q))
    );
  }
  return filtered;
};

export const getServiceById = (id: string) => {
  return SERVICES.find(s => s.id === id);
};

export const getPackageById = (packageId: string) => {
  for (const service of SERVICES) {
    const pkg = service.packages.find(p => p.id === packageId || String(p.providerId) === String(packageId));
    if (pkg) {
      return { service, package: pkg };
    }
  }
  return null;
};

/**
 * Sinkronisasi realtime data produk dari API Backend / Supabase
 */
export async function syncLiveServices(): Promise<ServiceProduct[]> {
  try {
    const rawList = await fetchLiveProducts();
    if (rawList && rawList.length > 0) {
      // Perbarui stok dan harga paket pada masing-masing service yang cocok
      for (const item of rawList) {
        for (const service of SERVICES) {
          const pkg = service.packages.find(p => String(p.providerId) === String(item.providerServiceId));
          if (pkg) {
            pkg.price = item.price;
            if (item.originalPrice) pkg.originalPrice = item.originalPrice;
            pkg.stockCount = item.stockCount;
            pkg.stockBadge = item.stockCount > 0 ? `ADA ${item.stockCount}` : 'HABIS';
            if (item.description) pkg.description = item.description;
            if (item.imageUrl) pkg.imageUrl = item.imageUrl;
          }
          const validPackages = service.packages.filter(p => typeof p.price === 'number' && p.price > 0);
          if (validPackages.length > 0) {
            const minPrice = Math.min(...validPackages.map(p => p.price));
            const isAllOutOfStock = validPackages.every(p => p.stockCount <= 0);
            service.tagline = isAllOutOfStock 
              ? `Rp ${minPrice.toLocaleString('id-ID')} (Habis)`
              : `Mulai Rp ${minPrice.toLocaleString('id-ID')}`;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Live service sync notice:', err);
  }
  return SERVICES;
}

// Jalankan auto-sync background saat modul dimuat di browser
if (typeof window !== 'undefined') {
  syncLiveServices().catch(() => {});
}
