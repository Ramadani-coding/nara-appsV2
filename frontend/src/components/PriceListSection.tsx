import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Tag, X } from 'lucide-react';
import { useLiveServices } from '../lib/useLiveCatalog';
import { AppLogo } from './AppLogo';

interface FlatPriceItem {
  id: string;
  serviceId: string;
  name: string;
  serviceName: string;
  iconId: string;
  originalPrice: number;
  resellerPrice: number;
  discountPercent?: number;
  stockCount: number;
}

export function PriceListSection() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const liveServices = useLiveServices();

  // Flatten all packages across all services into a price list
  const allItems: FlatPriceItem[] = useMemo(() => {
    const list: FlatPriceItem[] = [];
    liveServices.forEach(service => {
      service.packages.forEach(pkg => {
        list.push({
          id: pkg.id,
          serviceId: service.id,
          name: pkg.name,
          serviceName: service.name,
          iconId: service.iconId,
          originalPrice: pkg.originalPrice,
          resellerPrice: pkg.price,
          discountPercent: pkg.discountPercent,
          stockCount: pkg.stockCount,
        });
      });
    });
    return list;
  }, [liveServices]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.serviceName.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  return (
    <section id="daftar-harga" className="scroll-mt-24 space-y-6 sm:space-y-8 pt-8">
      {/* Header Container */}
      <div className="text-center space-y-2 sm:space-y-3 max-w-2xl mx-auto">
        {/* Pill Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-full shadow-[2px_2px_0px_#000]">
          <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
            PRICE LIST
          </span>
        </div>

        {/* Big Heading */}
        <h2 className="text-2xl sm:text-4xl font-black text-black dark:text-white tracking-tight">
          Daftar Harga & Layanan
        </h2>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed px-2">
          Bandingkan harga normal dan rasakan keuntungan maksimal menjadi Reseller di Nara Premium.
        </p>
      </div>

      {/* Search Bar matching the reference design */}
      <div className="max-w-2xl mx-auto">
        <div className="relative bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 rounded-2xl shadow-[4px_4px_0px_#000] p-1.5 flex items-center">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 ml-3 mr-2 shrink-0" />
          <input 
            type="text"
            placeholder="Cari layanan (Contoh: Netflix, Canva, CapCut)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 px-2 text-xs sm:text-sm font-bold text-black dark:text-white placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="p-1 mr-2 text-gray-400 hover:text-black dark:hover:text-white shrink-0 cursor-pointer"
              title="Hapus pencarian"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Container: Mobile Card List on < md screens, Full Table on >= md screens */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 rounded-2xl shadow-[5px_5px_0px_#000] sm:shadow-[6px_6px_0px_#000] overflow-hidden">
        
        {/* ========================================================
            1. MOBILE VIEW (< md): Sleek Neo-Brutalist Cards
           ======================================================== */}
        <div className="block md:hidden p-3 sm:p-3.5 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-gray-500 font-bold text-xs">
              Tidak ada layanan yang sesuai dengan pencarian "{searchQuery}".
            </div>
          ) : (
            filteredItems.map((item) => {
              const discountVal = item.discountPercent 
                ? `-${item.discountPercent}%` 
                : item.originalPrice > item.resellerPrice
                  ? `-${Math.round(((item.originalPrice - item.resellerPrice) / item.originalPrice) * 100)}%`
                  : null;

              return (
                <div 
                  key={item.id}
                  className="bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-[2px_2px_0px_#000]"
                >
                  {/* Top Row: Icon + Full Product Name + Stock Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                        <AppLogo id={item.iconId} className="w-10 h-10" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-brand-blue block truncate">
                          {item.serviceName}
                        </span>
                        <h3 className="font-black text-xs sm:text-sm text-black dark:text-white leading-snug break-words">
                          {item.name}
                        </h3>
                      </div>
                    </div>

                    {/* Stock Status Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-black dark:border-gray-700 text-[10px] font-black rounded-full shrink-0 shadow-[1px_1px_0px_#000]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>READY ({item.stockCount})</span>
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-gray-300 dark:border-gray-700" />

                  {/* Bottom Row: Prices + Order Action */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="min-w-0 flex-1">
                      {/* Normal Price */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                        <span className="text-[10px] font-bold uppercase">Normal:</span>
                        <span className="line-through font-bold">
                          Rp {item.originalPrice.toLocaleString('id-ID')}
                        </span>
                        {discountVal && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 bg-brand-pink-soft dark:bg-pink-950/60 text-brand-pink dark:text-pink-300 border border-brand-pink rounded shrink-0">
                            {discountVal}
                          </span>
                        )}
                      </div>

                      {/* Reseller Price */}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.2 bg-brand-yellow text-black border border-black font-black rounded shrink-0">
                          PRO
                        </span>
                        <span className="text-sm sm:text-base font-black text-purple-700 dark:text-purple-300 whitespace-nowrap">
                          Rp {item.resellerPrice.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Action Buy Button */}
                    <button
                      onClick={() => navigate(`/checkout/${item.serviceId}?package=${item.id}`)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-blue hover:bg-blue-600 active:translate-y-0.5 text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl shrink-0 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      <span>BELI</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================
            2. DESKTOP VIEW (>= md): Full Clean Table
           ======================================================== */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[620px]">
            <thead>
              <tr className="border-b-2 border-black dark:border-gray-700 bg-[#FAF8F5] dark:bg-[#1E2333] text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                <th className="py-4 px-5">PRODUK LAYANAN</th>
                <th className="py-4 px-4 text-right">HARGA NORMAL</th>
                <th className="py-4 px-4 text-center">
                  <div className="inline-flex flex-col items-center">
                    <span className="text-[9px] px-1.5 py-0.2 bg-brand-yellow text-black border border-black font-black rounded mb-0.5">
                      PRO
                    </span>
                    <span className="text-purple-700 dark:text-purple-300 font-black">HARGA RESELLER</span>
                  </div>
                </th>
                <th className="py-4 px-4 text-center">STATUS</th>
                <th className="py-4 px-4 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-100 dark:divide-gray-800 text-xs sm:text-sm">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-bold">
                    Tidak ada layanan yang sesuai dengan pencarian "{searchQuery}".
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const discountVal = item.discountPercent 
                    ? `-${item.discountPercent}%` 
                    : item.originalPrice > item.resellerPrice
                      ? `-${Math.round(((item.originalPrice - item.resellerPrice) / item.originalPrice) * 100)}%`
                      : 'Sama';

                  return (
                    <tr 
                      key={item.id}
                      className="hover:bg-[#FAF8F5] dark:hover:bg-[#151923] transition-colors"
                    >
                      {/* Produk Layanan */}
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                            <AppLogo id={item.iconId} className="w-9 h-9" />
                          </div>
                          <span className="font-extrabold text-black dark:text-white line-clamp-1">
                            {item.name}
                          </span>
                        </div>
                      </td>

                      {/* Harga Normal */}
                      <td className="py-3.5 px-4 text-right font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        Rp {item.originalPrice.toLocaleString('id-ID')}
                      </td>

                      {/* Harga Reseller */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 font-black text-purple-700 dark:text-purple-300">
                          <span>Rp {item.resellerPrice.toLocaleString('id-ID')}</span>
                          {discountVal !== 'Sama' ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-brand-pink-soft dark:bg-pink-950/60 text-brand-pink dark:text-pink-300 border border-brand-pink rounded font-black">
                              {discountVal}
                            </span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded font-bold">
                              Sama
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status Ready */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[11px] font-black rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          READY ({item.stockCount})
                        </span>
                      </td>

                      {/* Aksi Button */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => navigate(`/checkout/${item.serviceId}?package=${item.id}`)}
                          title={`Beli ${item.name}`}
                          className="w-8 h-8 bg-purple-50 dark:bg-purple-950/60 hover:bg-brand-blue text-purple-700 dark:text-purple-300 hover:text-white border border-purple-200 dark:border-purple-800 hover:border-black rounded-lg inline-flex items-center justify-center transition-all neo-btn cursor-pointer"
                        >
                          <ShoppingCart className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
