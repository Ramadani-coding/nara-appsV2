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

    for (const service of this.services) {
      for (const pkg of service.packages) {
        const matchesProvider = providerServiceId && String(pkg.providerId) === providerServiceId;
        const matchesName = name && pkg.name.toLowerCase().trim() === name;

        if (matchesProvider || matchesName) {
          if (isActive !== undefined && pkg.isActive !== isActive) {
            pkg.isActive = isActive;
            hasChanged = true;
          }
          if (!isNaN(price) && price > 0 && pkg.price !== price) {
            pkg.price = price;
            hasChanged = true;
          }
          if (maxAllowedQty !== undefined && pkg.maxAllowedQty !== maxAllowedQty) {
            pkg.maxAllowedQty = maxAllowedQty;
            hasChanged = true;
          }
          if (isMaintenance !== undefined && pkg.isMaintenance !== isMaintenance) {
            pkg.isMaintenance = isMaintenance;
            hasChanged = true;
          }
          if (providerPrice !== undefined && providerPrice !== null && !isNaN(Number(providerPrice)) && Number(providerPrice) > 0) {
            pkg.providerPrice = Number(providerPrice);
          }
          if (marginValue !== undefined && marginValue !== null && !isNaN(Number(marginValue))) {
            pkg.marginValue = Number(marginValue);
          }
          if (originalPrice !== undefined && originalPrice !== null && Number(originalPrice) > 0) {
            pkg.originalPrice = Number(originalPrice);
          }
          if (stockCount !== undefined && !isNaN(stockCount) && pkg.stockCount !== stockCount) {
            pkg.stockCount = stockCount;
            pkg.stockBadge = stockCount > 0 ? `ADA ${stockCount}` : 'HABIS';
            hasChanged = true;
          }
          if (description) {
            pkg.description = description;
          }
          if (imageUrl) {
            pkg.imageUrl = imageUrl;
          }
        }
      }
      
      const activePackages = service.packages.filter(p => p.isActive !== false);
      const shouldServiceBeActive = activePackages.length > 0;
      if (service.isActive !== shouldServiceBeActive) {
        service.isActive = shouldServiceBeActive;
        hasChanged = true;
      }

      const newTagline = computeServiceTagline(service);
      if (service.tagline !== newTagline) {
        service.tagline = newTagline;
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
