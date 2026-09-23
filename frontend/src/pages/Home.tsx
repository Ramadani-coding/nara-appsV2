import { useState, useDeferredValue } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Search, 
  ShieldCheck, 
  Zap, 
  Star, 
  MessageCircle, 
  ArrowRight
} from 'lucide-react';
import { CATEGORIES, type ServiceProduct } from '../lib/mockData';
import { useLiveServices } from '../lib/useLiveCatalog';
import { AppLogo } from '../components/AppLogo';
import { LiveSalesToast } from '../components/LiveSalesToast';
import { InvoiceLookup } from '../components/InvoiceLookup';
import { CaraOrderSection } from '../components/CaraOrderSection';
import { FAQSection } from '../components/FAQSection';
import { HeroOrderSimulator } from '../components/HeroOrderSimulator';

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearch = useDeferredValue(searchQuery);

  const services = useLiveServices(activeCategory, deferredSearch);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-16 pb-16 text-black dark:text-gray-100">
      {/* ========================================================
          HERO SECTION (Upgraded with Interactive Order Simulator)
         ======================================================== */}
      <section className="pt-2 sm:pt-4 pb-6 sm:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            
            {/* Trust & Guarantee Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider rounded-lg">
              <ShieldCheck className="w-4 h-4 text-black" />
              <span>PROSES OTOMATIS 24/7</span>
            </div>

            {/* Headline: Responsive scale so mobile doesn't blow up viewport height */}
            <div className="space-y-0.5 sm:space-y-1">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black dark:text-white leading-tight">
                Langganan Premium
              </h1>
              <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-brand-blue dark:text-blue-400 leading-tight">
                Aplikasi Digital Favorit
              </h2>
            </div>

            {/* Sub-headline */}
            <p className="text-xs sm:text-base lg:text-lg text-gray-700 dark:text-gray-300 font-medium max-w-xl leading-relaxed">
              Akses premium resmi untuk kebutuhan streaming, produktivitas, dan editing dengan harga terjangkau. 
              Pembayaran instan via QRIS dan garansi penggantian selama masa aktif.
            </p>

            {/* CTA Action Buttons: Side-by-side on mobile, flex on desktop */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-4 pt-1 sm:pt-2">
              <button
                onClick={() => scrollToSection('products-catalog')}
                className="min-h-[44px] px-3 sm:px-6 py-2.5 sm:py-3 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] neo-btn flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
              >
                <span>BELANJA</span>
                <span className="hidden sm:inline">SEKARANG</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              </button>

              <button
                onClick={() => scrollToSection('cara-order')}
                className="min-h-[44px] px-3 sm:px-6 py-2.5 sm:py-3 bg-white dark:bg-[#1E2333] hover:bg-gray-50 text-black dark:text-white font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-black dark:border-gray-700 rounded-xl shadow-[3px_3px_0px_#000] neo-btn cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 text-center flex items-center justify-center"
              >
                CARA ORDER
              </button>
            </div>

            {/* Desktop Stats (hidden on mobile to prevent fold clipping) */}
            <div className="hidden sm:grid grid-cols-3 gap-3 sm:gap-4 pt-3 sm:pt-4 max-w-lg">
              <div className="p-3 sm:p-4 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl">
                <div className="text-2xl sm:text-3xl font-black text-black dark:text-white">
                  {services.length > 0 ? `${services.length}+` : '20+'}
                </div>
                <div className="text-[10px] sm:text-xs font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                  PILIHAN PRODUK
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl">
                <div className="text-2xl sm:text-3xl font-black text-brand-blue dark:text-blue-400">100%</div>
                <div className="text-[10px] sm:text-xs font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                  GARANSI RESMI
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">24/7</div>
                <div className="text-[10px] sm:text-xs font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                  SISTEM OTOMATIS
                </div>
              </div>
            </div>

            {/* Mobile Trust Strip (Compact horizontal strip for mobile screens < 640px) */}
            <div className="flex sm:hidden items-center justify-between gap-1.5 p-2.5 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 shadow-[2.5px_2.5px_0px_#000] rounded-xl text-center">
              <div className="flex-1">
                <div className="text-base font-black text-black dark:text-white leading-tight">
                  {services.length > 0 ? `${services.length}+` : '20+'}
                </div>
                <div className="text-[9px] font-extrabold uppercase text-gray-500 dark:text-gray-400">
                  Produk
                </div>
              </div>
              <div className="w-[1px] h-6 bg-gray-300 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="text-base font-black text-brand-blue dark:text-blue-400 leading-tight">100%</div>
                <div className="text-[9px] font-extrabold uppercase text-gray-500 dark:text-gray-400">
                  Garansi
                </div>
              </div>
              <div className="w-[1px] h-6 bg-gray-300 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400 leading-tight">24/7</div>
                <div className="text-[9px] font-extrabold uppercase text-gray-500 dark:text-gray-400">
                  Otomatis
                </div>
              </div>
            </div>

          </div>

          {/* Right Hero: Animated Desktop Order Simulator (Screen >= 1024px) */}
          <div className="hidden lg:block lg:col-span-5 relative py-2">
            <HeroOrderSimulator services={services} />
          </div>

          {/* Mobile Order Simulator: Interactive Quick Order on Mobile (Screen < 1024px) */}
          <div className="block lg:hidden w-full pt-2">
            <HeroOrderSimulator services={services} isMobileCompact={true} />
          </div>

        </div>
      </section>

      {/* ========================================================
          VALUE PROPOSITION BAR (Bottom of Image 2)
         ======================================================== */}
      <section className="border-y-2 border-black bg-white -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y-2 sm:divide-y-0 sm:divide-x-2 divide-black">
          
          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6 text-black" />
            </div>
            <div>
              <h4 className="font-black text-sm text-black">Pembayaran Aman</h4>
              <p className="text-xs text-gray-600 font-medium">Proses order terstruktur</p>
            </div>
          </div>

          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-black" />
            </div>
            <div>
              <h4 className="font-black text-sm text-black">Proses Cepat</h4>
              <p className="text-xs text-gray-600 font-medium">Order langsung diproses</p>
            </div>
          </div>

          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 text-black" />
            </div>
            <div>
              <h4 className="font-black text-sm text-black">Garansi</h4>
              <p className="text-xs text-gray-600 font-medium">Sesuai ketentuan produk</p>
            </div>
          </div>

          <div className="p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
              <MessageCircle className="w-6 h-6 text-black" />
            </div>
            <div>
              <h4 className="font-black text-sm text-black">Customer Support</h4>
              <p className="text-xs text-gray-600 font-medium">Hubungi admin melalui WhatsApp</p>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================
          CATALOG SECTION (Matching Reference Image 1)
         ======================================================== */}
      <section id="products-catalog" className="space-y-6 pt-4 scroll-mt-20">
        
        {/* Invoice Check / Lookup Input (Placed above Product Search) */}
        <InvoiceLookup />

        {/* Search Bar (Big Neo-Brutalist Box from Image 1) */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] p-2 flex items-center">
          <Search className="w-5 h-5 text-gray-500 ml-3 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Cari produk (cth: netflix)..."
            aria-label="Cari produk aplikasi (contoh: Netflix, Canva, Spotify)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 px-2 text-sm font-bold placeholder:text-gray-400 focus:outline-none text-black"
          />
        </div>

        {/* Category Pills (Tabs with Neo-Brutalist borders from Image 1) */}
        <div 
          id="categories-filter" 
          role="tablist" 
          aria-label="Filter kategori produk"
          className="scroll-mt-24 flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar"
        >
          <button
            role="tab"
            aria-selected={!activeCategory}
            onClick={() => setActiveCategory(undefined)}
            className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer whitespace-nowrap ${
              !activeCategory
                ? 'bg-brand-blue text-white shadow-[3px_3px_0px_#000]'
                : 'bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0px_#000]'
            }`}
          >
            Semua
          </button>
          
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(cat.slug)}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-black transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-brand-blue text-white shadow-[3px_3px_0px_#000]'
                    : 'bg-white text-black hover:bg-gray-100 shadow-[2px_2px_0px_#000]'
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* 6-Column Service App Cards Grid (Replicating exact layout from Image 1) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5 pt-2">
          {services.map((service: ServiceProduct, index: number) => {
            return (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  to={`/product/${service.id}`}
                  className="group block h-full bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000000] transition-all p-4 rounded-2xl flex flex-col justify-between items-center text-center relative overflow-hidden"
                >
                  {/* Top Badge (HOT / AUTO / SMART) */}
                  {service.badge && (
                    <span className={`absolute top-2.5 right-2.5 px-2 py-0.5 text-[9px] font-black uppercase rounded-md border border-black shadow-[1px_1px_0px_#000] ${
                      service.badgeColor === 'pink'
                        ? 'bg-brand-pink-soft text-brand-pink'
                        : service.badgeColor === 'emerald'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-blue-100 text-brand-blue'
                    }`}>
                      {service.badge}
                    </span>
                  )}

                  {/* App Icon Container */}
                  <div className="my-3 flex items-center justify-center group-hover:scale-105 transition-transform duration-200">
                    <AppLogo id={service.iconId} imageUrl={service.imageUrl} className="w-16 h-16 sm:w-20 sm:h-20" />
                  </div>

                  {/* App Details */}
                  <div className="w-full space-y-1 mt-auto">
                    {/* Tiny Category Tag */}
                    <div className="text-[10px] font-black uppercase tracking-wider text-brand-blue truncate">
                      {service.category}
                    </div>

                    {/* App Title */}
                    <h3 className="font-black text-sm text-black truncate group-hover:text-brand-blue transition-colors">
                      {service.name}
                    </h3>

                    {/* Tagline / Sub-tag Pill */}
                    <div className="pt-1.5">
                      <span className="inline-block w-full py-1 px-2 text-[10px] font-bold text-gray-700 bg-gray-50 border border-black/20 rounded-lg truncate group-hover:border-black group-hover:bg-brand-blue-soft transition-colors">
                        {service.tagline}
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>

        {/* Empty State */}
        {services.length === 0 && (
          <div className="p-12 text-center bg-white border-2 border-black shadow-[4px_4px_0px_#000] max-w-md mx-auto my-10 space-y-3">
            <div className="text-3xl">🔍</div>
            <h3 className="font-black text-lg">Layanan Tidak Ditemukan</h3>
            <p className="text-xs text-gray-600">
              Tidak ada produk yang cocok dengan kata kunci pencarian Anda.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setActiveCategory(undefined);
              }}
              className="px-4 py-2 bg-brand-yellow font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
            >
              Reset Pencarian
            </button>
          </div>
        )}
      </section>

      {/* ========================================================
          CARA ORDER SECTION (Directly on page, no modal)
         ======================================================== */}
      <CaraOrderSection />

      {/* ========================================================
          FAQ SECTION (Directly on page, no modal)
         ======================================================== */}
      <FAQSection />

      {/* Live Sales Notification Toast */}
      <LiveSalesToast />
    </div>
  );
}


