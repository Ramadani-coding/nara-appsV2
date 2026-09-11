import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, ShoppingCart, Tag, ArrowLeft, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { SERVICES } from '../lib/mockData';
import { AppLogo } from '../components/AppLogo';

interface FlatPriceItem {
  id: string;
  serviceId: string;
  name: string;
  serviceName: string;
  iconId: string;
  imageUrl?: string;
  originalPrice: number;
  resellerPrice: number;
  discountPercent?: number;
  stockCount: number;
}

const ITEMS_PER_PAGE = 10;

export default function PriceList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  // Flatten all packages across all services into a price list
  const allItems: FlatPriceItem[] = useMemo(() => {
    const list: FlatPriceItem[] = [];
    SERVICES.forEach(service => {
      service.packages.forEach(pkg => {
        list.push({
          id: pkg.id,
          serviceId: service.id,
          name: pkg.name,
          serviceName: service.name,
          iconId: service.iconId,
          imageUrl: pkg.imageUrl || service.imageUrl,
          originalPrice: pkg.originalPrice,
          resellerPrice: pkg.price,
          discountPercent: pkg.discountPercent,
          stockCount: pkg.stockCount,
        });
      });
    });
    return list;
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allItems;
    return allItems.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.serviceName.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));

  // Items for the current page
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto space-y-6 sm:space-y-8 pb-16 text-black"
    >
      {/* Top Back Navigation Bar: Zero-collision responsive layout */}
      <div className="flex items-center justify-between gap-3">
        <button 
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-[#1E2333] text-black dark:text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn cursor-pointer rounded-xl shrink-0"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>KEMBALI</span>
          <span className="hidden sm:inline">KE BERANDA</span>
        </button>

        <span className="text-[10px] sm:text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider text-right shrink-0">
          <span className="hidden sm:inline">KATALOG </span>RESELLER<span className="hidden md:inline"> LENGKAP</span>
        </span>
      </div>

      {/* Header Container */}
      <div className="text-center space-y-2 sm:space-y-3 max-w-2xl mx-auto pt-1 sm:pt-2">
        {/* Pill Tag */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-full shadow-[2px_2px_0px_#000]">
          <Tag className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          <span className="text-xs font-black uppercase tracking-wider text-purple-700 dark:text-purple-300">
            PRICE LIST
          </span>
        </div>

        {/* Big Heading */}
        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-black dark:text-white tracking-tight">
          Daftar Harga & Layanan
        </h1>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium leading-relaxed px-2">
          Bandingkan harga normal dan rasakan keuntungan maksimal menjadi Reseller di Nara Premium.
        </p>
      </div>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto">
        <div className="relative bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 rounded-2xl shadow-[4px_4px_0px_#000] p-1.5 flex items-center">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 ml-3 mr-2 shrink-0" />
          <input 
            type="text"
            placeholder="Cari layanan (Contoh: Netflix, Canva, CapCut)..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full py-2 px-2 text-xs sm:text-sm font-bold text-black dark:text-white placeholder:text-gray-400 focus:outline-none bg-transparent"
          />
          {searchQuery && (
            <button 
              onClick={() => handleSearchChange('')}
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
        <div className="block md:hidden p-3.5 space-y-3">
          {paginatedItems.length === 0 ? (
            <div className="py-10 text-center text-gray-500 font-bold text-xs">
              Tidak ada layanan yang sesuai dengan kata kunci "{searchQuery}".
            </div>
          ) : (
            paginatedItems.map((item) => {
              const discountVal = item.discountPercent 
                ? `-${item.discountPercent}%` 
                : item.originalPrice > item.resellerPrice
                  ? `-${Math.round(((item.originalPrice - item.resellerPrice) / item.originalPrice) * 100)}%`
                  : null;

              return (
                <div 
                  key={item.id}
                  className="bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl p-3.5 space-y-3 shadow-[2px_2px_0px_#000]"
                >
                  {/* Top Row: Icon + Full Product Name + Stock Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                        <AppLogo id={item.iconId} imageUrl={item.imageUrl} className="w-10 h-10" />
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
                    {item.stockCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-black dark:border-gray-700 text-[10px] font-black rounded-full shrink-0 shadow-[1px_1px_0px_#000]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>READY ({item.stockCount})</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-black dark:border-gray-700 text-[10px] font-black rounded-full shrink-0 shadow-[1px_1px_0px_#000]">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                        <span>HABIS</span>
                      </span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-gray-300 dark:border-gray-700" />

                  {/* Bottom Row: Prices + Order Action */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div>
                      {/* Normal Price */}
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                        <span className="text-[10px] font-bold uppercase">Normal:</span>
                        <span className="line-through font-bold">
                          Rp {item.originalPrice.toLocaleString('id-ID')}
                        </span>
                        {discountVal && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 bg-brand-pink-soft dark:bg-pink-950/60 text-brand-pink dark:text-pink-300 border border-brand-pink rounded">
                            {discountVal}
                          </span>
                        )}
                      </div>

                      {/* Reseller Price */}
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-[9px] px-1.5 py-0.2 bg-brand-yellow text-black border border-black font-black rounded">
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-blue hover:bg-blue-600 text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl shrink-0 cursor-pointer"
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
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-bold">
                    Tidak ada layanan yang sesuai dengan kata kunci "{searchQuery}".
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
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
                            <AppLogo id={item.iconId} imageUrl={item.imageUrl} className="w-9 h-9" />
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
                        {item.stockCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[11px] font-black rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            READY ({item.stockCount})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 text-[11px] font-black rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            HABIS
                          </span>
                        )}
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

        {/* Pagination Bar */}
        {filteredItems.length > 0 && (
          <div className="border-t-2 border-black dark:border-gray-700 p-3.5 sm:p-4 bg-[#FAF8F5] dark:bg-[#1E2333] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400 text-center sm:text-left">
              Menampilkan <span className="font-black text-black dark:text-white">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-black text-black dark:text-white">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> dari <span className="font-black text-black dark:text-white">{filteredItems.length}</span> layanan
            </div>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {/* Prev Button */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-2.5 py-1.5 text-xs font-black border-2 border-black dark:border-gray-700 flex items-center gap-1 shadow-[1.5px_1.5px_0px_#000] rounded-md transition-all ${
                  currentPage === 1
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-700 shadow-none cursor-not-allowed'
                    : 'bg-white dark:bg-[#181C2A] hover:bg-gray-100 text-black dark:text-white cursor-pointer neo-btn'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sebelumnya</span>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-8 h-8 text-xs font-black border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[1.5px_1.5px_0px_#000] rounded-md transition-all cursor-pointer ${
                    currentPage === pageNum
                      ? 'bg-brand-blue text-white shadow-[2px_2px_0px_#000]'
                      : 'bg-white dark:bg-[#181C2A] hover:bg-gray-100 text-black dark:text-white neo-btn'
                  }`}
                >
                  {pageNum}
                </button>
              ))}

              {/* Next Button */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-2.5 py-1.5 text-xs font-black border-2 border-black dark:border-gray-700 flex items-center gap-1 shadow-[1.5px_1.5px_0px_#000] rounded-md transition-all ${
                  currentPage === totalPages
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 border-gray-300 dark:border-gray-700 shadow-none cursor-not-allowed'
                    : 'bg-white dark:bg-[#181C2A] hover:bg-gray-100 text-black dark:text-white cursor-pointer neo-btn'
                }`}
              >
                <span className="hidden sm:inline">Berikutnya</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
