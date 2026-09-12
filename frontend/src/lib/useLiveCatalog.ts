import { useSyncExternalStore, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { fetchLiveProducts } from './api';
import { SERVICES, type ServiceProduct, type ProductPackage } from './mockData';

/**
 * Menghitung label harga dinamis untuk kartu layanan di katalog.
 * Hanya memperhitungkan paket yang berstatus AKTIF (isActive !== false).
 * Menampilkan harga termurah yang sudah ditambahkan margin keuntungan admin.
 */
export function computeServiceTagline(service: ServiceProduct): string {
  // Hanya ambil paket yang aktif
  const activePackages = service.packages.filter(p => p.isActive !== false && typeof p.price === 'number' && p.price > 0);
  if (activePackages.length === 0) {
    return 'Nonaktif';
  }

  const minPrice = Math.min(...activePackages.map(p => p.price));
  const isAllOutOfStock = activePackages.every(p => p.stockCount <= 0);

  if (isAllOutOfStock) {
    return `Rp ${minPrice.toLocaleString('id-ID')} (Habis)`;
  }

  return `Mulai Rp ${minPrice.toLocaleString('id-ID')}`;
}

/**
 * Mendeteksi ID service berdasarkan nama produk
 */
function detectServiceIdForProduct(name: string): string {
  const n = name.toLowerCase().trim();
  if (n.includes('capcut')) return 'capcut';
  if (n.includes('canva')) return 'canva';
  if (n.includes('alight')) return 'alight-motion';
  if (n.includes('netflix')) return 'netflix';
  if (n.includes('spotify')) return 'spotify';
  if (n.includes('prime')) return 'prime-video';
  if (n.includes('youtube')) return 'youtube';
  if (n.includes('viu')) return 'viu';
  if (n.includes('vidio') || n.includes('vd mobile')) return 'vidio';
  if (n.includes('disney')) return 'disney';
  if (n.includes('drama') || n.includes('wetv') || n.includes('dracin')) return 'akses-drama';
  if (n.includes('wink')) return 'wink';
  if (n.includes('hma') || n.includes('vpn')) return 'hma-vpn';
  if (n.includes('gemini') || n.includes('chatgpt') || n.includes('gpt') || n.includes('claude')) return 'aplikasi-ai';
  if (n.includes('iqiyi') || n.includes('iqw')) return 'iqiyi';

  const firstWord = n.split(/[\s_-]+/)[0].replace(/[^a-z0-9]/g, '');
  return firstWord || 'lainnya';
}

function createServiceForProduct(serviceId: string, rawItem: any): ServiceProduct {
  const rawName = String(rawItem.name || '');
  let serviceName = rawName.split(/[\s_-]+/)[0];
  if (serviceId === 'iqiyi') serviceName = 'iQIYI Premium';

  const categoryName = rawItem.category?.name || '';
  let category: 'Desain' | 'Musik & Video' | 'Lainnya' = 'Musik & Video';
  let categorySlug: 'desain' | 'musik-video' | 'lainnya' = 'musik-video';

  const catLower = (categoryName || '').toLowerCase();
  if (catLower.includes('desain') || catLower.includes('kreatif')) {
    category = 'Desain';
    categorySlug = 'desain';
  } else if (catLower.includes('ai') || catLower.includes('vpn') || catLower.includes('utilitas') || catLower.includes('lainnya')) {
    category = 'Lainnya';
    categorySlug = 'lainnya';
  }

  return {
    id: serviceId,
    name: serviceName,
    category,
    categorySlug,
    tagline: `Mulai Rp ${(rawItem.price || 0).toLocaleString('id-ID')}`,
    badge: 'HOT',
    badgeColor: 'emerald',
    iconId: serviceId,
    imageUrl: rawItem.imageUrl || rawItem.image_url || undefined,
    genreTag: category === 'Desain' ? 'DESAIN' : category === 'Lainnya' ? 'PRODUKTIVITAS' : 'STREAMING',
    accountTypeTag: 'VIP & Premium',
    description: rawItem.description || `Layanan langganan premium ${serviceName} resmi, aktif instan dan bergaransi penuh.`,
    packages: [],
    isActive: true,
  };
}

function createPackageFromRaw(rawItem: any, service: ServiceProduct): ProductPackage {
  const provId = rawItem.providerServiceId ?? rawItem.provider_service_id ?? rawItem.providerId;
  const rawId = rawItem.id ? String(rawItem.id) : (provId ? String(provId) : `pkg-${Date.now()}`);
  const name = String(rawItem.name || 'Paket');
  const price = typeof rawItem.price === 'number' ? rawItem.price : Number(rawItem.price) || 0;
  const originalPrice = Number(rawItem.originalPrice ?? rawItem.original_price) || Math.round(price * 2.5);
  const stockCount = typeof rawItem.stockCount === 'number' 
    ? rawItem.stockCount 
    : typeof rawItem.stock_count === 'number' 
    ? rawItem.stock_count 
    : 0;
  const providerPrice = Number(rawItem.providerPrice ?? rawItem.provider_price) || price;
  const marginValue = Number(rawItem.marginValue ?? rawItem.margin_value) || 0;
  const maxAllowedQty = typeof rawItem.maxAllowedQty === 'number' 
    ? Math.min(stockCount, rawItem.maxAllowedQty) 
    : stockCount;
  const isMaintenance = typeof rawItem.isMaintenance === 'boolean' ? rawItem.isMaintenance : undefined;
  const rawActive = rawItem.isActive ?? rawItem.is_active;
  const isActive = typeof rawActive === 'boolean' ? rawActive : true;

  const lowerName = name.toLowerCase();
  let type: 'Privat' | 'Sharing' | 'Invite' | 'Head' | 'Family' = 'Privat';
  if (lowerName.includes('sharing') || lowerName.includes('random')) type = 'Sharing';
  else if (lowerName.includes('invite')) type = 'Invite';
  else if (lowerName.includes('head')) type = 'Head';
  else if (lowerName.includes('family')) type = 'Family';

  let duration = '1 Bulan';
  const durationMatch = name.match(/(\d+(?:[-]\d+)?\s*(?:hari|bulan|minggu|tahun|d|m|y)\+?)/i);
  if (durationMatch) {
    duration = durationMatch[1];
  } else if (lowerName.includes('lifetime')) {
    duration = 'Lifetime';
  }

  const discountPercent = originalPrice > price 
    ? Math.min(99, Math.max(1, Math.round(((originalPrice - price) / originalPrice) * 100))) 
    : undefined;

  const pkgId = `${service.id}-${provId || rawId}`;

  return {
    id: pkgId,
    providerId: provId ? Number(provId) : undefined,
    serviceId: service.id,
    serviceName: service.name,
    name,
    type,
    duration,
    stockCount,
    stockBadge: stockCount > 0 ? `ADA ${stockCount}` : 'HABIS',
    discountPercent,
    originalPrice,
    providerPrice,
    marginValue,
    price,
    description: rawItem.description || '',
    imageUrl: rawItem.imageUrl || rawItem.image_url || service.imageUrl,
    isActive,
    isMaintenance,
    maxAllowedQty,
  };
}

class CatalogStore {
  private services: ServiceProduct[] = [];
  private listeners: Set<() => void> = new Set();
  private isInitialized = false;
  public channel: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    // Clone data awal dari mockData
    this.services = JSON.parse(JSON.stringify(SERVICES));
    // Set default isActive: true
    for (const s of this.services) {
      s.isActive = true;
      for (const p of s.packages) {
        p.isActive = true;
      }
    }
    this.updateAllTaglines();

    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  private updateAllTaglines() {
    for (const service of this.services) {
      const activePackages = service.packages.filter(p => p.isActive !== false);
      service.isActive = activePackages.length > 0;
      service.tagline = computeServiceTagline(service);
    }
  }

  public getSnapshot = (): ServiceProduct[] => {
    return this.services;
  };

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    this.services = [...this.services];
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying catalog listener:', err);
      }
    }
  }

  public applyProductData(rawItem: any) {
    if (!rawItem) return;

    const providerServiceId = String(rawItem.providerServiceId ?? rawItem.provider_service_id ?? '');
    const price = typeof rawItem.price === 'number' ? rawItem.price : Number(rawItem.price);
    const originalPrice = rawItem.originalPrice ?? rawItem.original_price;
    const stockCount = typeof rawItem.stockCount === 'number' 
      ? rawItem.stockCount 
      : typeof rawItem.stock_count === 'number' 
      ? rawItem.stock_count 
      : undefined;
    const providerPrice = rawItem.providerPrice ?? rawItem.provider_price;
    const marginValue = rawItem.marginValue ?? rawItem.margin_value;
    const description = rawItem.description;
    const imageUrl = rawItem.imageUrl ?? rawItem.image_url;
    const name = rawItem.name ? String(rawItem.name).toLowerCase().trim() : '';

    const rawActive = rawItem.isActive ?? rawItem.is_active;
    const isActive = typeof rawActive === 'boolean' ? rawActive : undefined;
    const maxAllowedQty = typeof rawItem.maxAllowedQty === 'number' ? rawItem.maxAllowedQty : undefined;
    const isMaintenance = typeof rawItem.isMaintenance === 'boolean' ? rawItem.isMaintenance : undefined;

    let hasChanged = false;
    let foundPackage: ProductPackage | null = null;
    let foundService: ServiceProduct | null = null;

    // 1. Cari apakah paket ini sudah ada di salah satu service
    for (const service of this.services) {
      for (const pkg of service.packages) {
        const matchesProvider = providerServiceId && String(pkg.providerId) === providerServiceId;
        const matchesName = name && pkg.name.toLowerCase().trim() === name;

        if (matchesProvider || matchesName) {
          foundPackage = pkg;
          foundService = service;
          break;
        }
      }
      if (foundPackage) break;
    }

    if (foundPackage && foundService) {
      // Update paket yang sudah ada
      if (isActive !== undefined && foundPackage.isActive !== isActive) {
        foundPackage.isActive = isActive;
        hasChanged = true;
      }
      if (!isNaN(price) && price > 0 && foundPackage.price !== price) {
        foundPackage.price = price;
        hasChanged = true;
      }
      if (maxAllowedQty !== undefined) {
        const clampedMax = Math.min(foundPackage.stockCount, maxAllowedQty);
        if (foundPackage.maxAllowedQty !== clampedMax) {
          foundPackage.maxAllowedQty = clampedMax;
          hasChanged = true;
        }
      }
      if (isMaintenance !== undefined && foundPackage.isMaintenance !== isMaintenance) {
        foundPackage.isMaintenance = isMaintenance;
        hasChanged = true;
      }
      if (providerPrice !== undefined && providerPrice !== null && !isNaN(Number(providerPrice)) && Number(providerPrice) > 0) {
        foundPackage.providerPrice = Number(providerPrice);
      }
      if (marginValue !== undefined && marginValue !== null && !isNaN(Number(marginValue))) {
        foundPackage.marginValue = Number(marginValue);
      }
      if (originalPrice !== undefined && originalPrice !== null && Number(originalPrice) > 0) {
        foundPackage.originalPrice = Number(originalPrice);
      }
      if (stockCount !== undefined && !isNaN(stockCount) && foundPackage.stockCount !== stockCount) {
        foundPackage.stockCount = stockCount;
        foundPackage.stockBadge = stockCount > 0 ? `ADA ${stockCount}` : 'HABIS';
        if (foundPackage.maxAllowedQty !== undefined && foundPackage.maxAllowedQty > stockCount) {
          foundPackage.maxAllowedQty = stockCount;
        }
        hasChanged = true;
      }
      if (description) {
        foundPackage.description = description;
      }
      if (imageUrl) {
        foundPackage.imageUrl = imageUrl;
      }
    } else if (rawItem.name) {
      // 2. PRODUK BARU! Belum ada di mockData. Temukan atau buat service yang sesuai
      const serviceId = detectServiceIdForProduct(String(rawItem.name));
      let targetService = this.services.find(s => s.id === serviceId);

      if (!targetService) {
        targetService = createServiceForProduct(serviceId, rawItem);
        this.services.push(targetService);
      }

      const newPkg = createPackageFromRaw(rawItem, targetService);
      targetService.packages.push(newPkg);
      foundService = targetService;
      hasChanged = true;
    }

    if (foundService) {
      const activePackages = foundService.packages.filter(p => p.isActive !== false);
      const shouldServiceBeActive = activePackages.length > 0;
      if (foundService.isActive !== shouldServiceBeActive) {
        foundService.isActive = shouldServiceBeActive;
        hasChanged = true;
      }

      const newTagline = computeServiceTagline(foundService);
      if (foundService.tagline !== newTagline) {
        foundService.tagline = newTagline;
        hasChanged = true;
      }
    }

    if (hasChanged) {
      this.notify();
    }
  }

  public async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Ambil data produk live awal dari Backend API / Supabase
    try {
      const liveList = await fetchLiveProducts();
      if (Array.isArray(liveList) && liveList.length > 0) {
        for (const item of liveList) {
          this.applyProductData(item);
        }
      }
    } catch (err) {
      console.warn('Live catalog initial sync warning:', err);
    }

    // 2. Hubungkan ke Supabase Realtime WebSocket channel untuk tabel public.products
    try {
      this.channel = supabase
        .channel('realtime:public:products:live-catalog')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          (payload) => {
            console.log('⚡ Realtime catalog update received:', payload.eventType, payload.new);
            if (payload.new) {
              this.applyProductData(payload.new);
            }
          }
        )
        .subscribe((status) => {
          console.log('⚡ Supabase Realtime catalog status:', status);
        });
    } catch (err) {
      console.warn('Realtime subscription error:', err);
    }

    // 3. BroadcastChannel untuk sinkronisasi seketika antar-tab di browser yang sama
    try {
      if ('BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('nara_catalog_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'PRODUCT_UPDATED' && event.data?.product) {
            this.applyProductData(event.data.product);
          }
        };
      }
    } catch (_e) {}

    // 4. Custom DOM Event untuk sinkronisasi seketika dalam satu tab
    window.addEventListener('nara:product-updated', (event: any) => {
      if (event.detail) {
        this.applyProductData(event.detail);
      }
    });
  }

  public broadcastUpdate(product: any) {
    this.applyProductData(product);
    try {
      if (this.broadcastChannel) {
        this.broadcastChannel.postMessage({ type: 'PRODUCT_UPDATED', product });
      }
    } catch (_e) {}
  }
}

// Instance global store tunggal
export const catalogStore = new CatalogStore();

/**
 * Hook untuk mendapatkan daftar semua service di katalog dengan update Realtime otomatis.
 * JIKA STATUS PRODUK / LAYANAN NONAKTIF, OTOMATIS DIHILANGKAN DARI LIST KATALOG!
 */
export function useLiveServices(categorySlug?: string, searchQuery?: string): ServiceProduct[] {
  const allServices = useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot);

  return useMemo(() => {
    // 1. FILTER: HANYA tampilkan service yang aktif dan memiliki paket aktif
    let activeServices = allServices
      .filter(s => s.isActive !== false && s.packages.some(p => p.isActive !== false))
      .map(s => ({
        ...s,
        packages: s.packages.filter(p => p.isActive !== false)
      }));

    if (categorySlug) {
      activeServices = activeServices.filter(s => s.categorySlug === categorySlug);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      activeServices = activeServices.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.tagline.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.packages.some(p => p.name.toLowerCase().includes(q))
      );
    }
    return activeServices;
  }, [allServices, categorySlug, searchQuery]);
}

/**
 * Hook untuk mendapatkan 1 service beserta paket-paketnya dengan harga live update Realtime.
 * JIKA SERVICE NONAKTIF ATAU SEMUA PAKETNYA NONAKTIF, MENGEMBALIKAN undefined.
 */
export function useLiveService(serviceId: string): ServiceProduct | undefined {
  const allServices = useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot);
  return useMemo(() => {
    const found = allServices.find(s => s.id === serviceId);
    if (!found || found.isActive === false) return undefined;

    const activePackages = found.packages.filter(p => p.isActive !== false);
    if (activePackages.length === 0) return undefined;

    return {
      ...found,
      packages: activePackages
    };
  }, [allServices, serviceId]);
}

/**
 * Hook untuk mendapatkan 1 paket produk dengan harga live update Realtime.
 */
export function useLivePackage(packageId: string): { service: ServiceProduct; package: ProductPackage } | null {
  const allServices = useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot);
  return useMemo(() => {
    for (const service of allServices) {
      if (service.isActive === false) continue;
      const pkg = service.packages.find(p => (p.id === packageId || String(p.providerId) === String(packageId)) && p.isActive !== false);
      if (pkg) {
        return { service, package: pkg };
      }
    }
    return null;
  }, [allServices, packageId]);
}

/**
 * Fungsi untuk admin mentrigger update katalog lokal langsung setelah simpan margin / ubah produk.
 */
export function broadcastCatalogProductUpdate(product: any) {
  catalogStore.broadcastUpdate(product);
  try {
    window.dispatchEvent(new CustomEvent('nara:product-updated', { detail: product }));
  } catch (_e) {}
}
