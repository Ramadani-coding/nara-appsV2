import { useState } from 'react';
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

export default function Home() {
  const [activeCategory, setActiveCategory] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  const services = useLiveServices(activeCategory, searchQuery);
  const alightMotion = services.find(s => s.id === 'alight-motion');
  const heroLowestPrice = alightMotion?.packages[0]?.price 
    ? alightMotion.packages[0].price.toLocaleString('id-ID') 
    : '5.400';

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-16 pb-16 text-black">
      {/* ========================================================
          HERO SECTION
         ======================================================== */}
      <section className="pt-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Trust & Guarantee Tag */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-black" />
              <span>PROSES OTOMATIS 24/7</span>
            </div>

            {/* Headline */}
            <div className="space-y-1">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-tight">
                Langganan Premium
              </h1>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-brand-blue leading-tight">
                Aplikasi Digital Favorit
              </h2>
            </div>

            {/* Sub-headline */}
            <p className="text-base sm:text-lg text-gray-800 font-medium max-w-xl leading-relaxed">
              Akses premium resmi untuk kebutuhan streaming, produktivitas, dan editing dengan harga terjangkau. 
              Pembayaran instan via QRIS dan garansi penggantian selama masa aktif.
            </p>

            {/* CTA Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => scrollToSection('products-catalog')}
                className="px-6 py-3.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] neo-btn flex items-center gap-2 cursor-pointer"
              >
                <span>BELANJA SEKARANG</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => scrollToSection('cara-order')}
                className="px-6 py-3.5 bg-white hover:bg-gray-50 text-black font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] neo-btn cursor-pointer"
              >
                LIHAT CARA ORDER
              </button>
            </div>

            {/* Verifiable Stats & Value Props */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-6 max-w-lg">
              <div className="p-3 sm:p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                <div className="text-2xl sm:text-3xl font-black text-black">
                  {services.length > 0 ? `${services.length}+` : '20+'}
                </div>
                <div className="text-[10px] sm:text-xs font-extrabold uppercase text-gray-600 tracking-wider">
                  PILIHAN PRODUK
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                <div className="text-2xl sm:text-3xl font-black text-brand-blue">100%</div>
                <div className="text-[10px] sm:text-xs font-extrabold uppercase text-gray-600 tracking-wider">
                  GARANSI RESMI
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                <div className="text-2xl sm:text-3xl font-black text-emerald-600">24/7</div>
                <div className="text-[10px] sm:text-xs font-extrabold uppercase text-gray-600 tracking-wider">
                  SISTEM OTOMATIS
                </div>
              </div>
            </div>

          </div>

          {/* Right Hero Graphic: Layered Neo-Brutalist Art (Hidden on mobile) */}
          <div className="hidden lg:flex lg:col-span-5 justify-end relative py-6">
            <div className="relative w-full max-w-sm sm:max-w-md">
              
              {/* Tilted background yellow decorative rectangle */}
              <div className="absolute -top-4 -right-3 w-32 h-36 bg-brand-yellow border-2 border-black rotate-12 -z-10 shadow-[2px_2px_0px_#000]" />
              
              {/* Tilted bottom-left pink decorative rectangle */}
              <div className="absolute -bottom-4 -left-3 w-28 h-28 bg-brand-pink border-2 border-black -rotate-12 -z-10 shadow-[2px_2px_0px_#000]" />

              {/* Main Neo-Brutalist Card with Crisp Brand Blue */}
              <div className="bg-brand-blue p-6 sm:p-8 border-2 border-black shadow-[6px_6px_0px_0px_#000000] text-white relative overflow-hidden">
                
                {/* Top Badge Row */}
                <div className="flex justify-between items-start mb-12">
                  <span className="px-2.5 py-1 bg-white text-black font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000]">
                    PREMIUM ACCESS
                  </span>
                  <img 
                    src="/nara-logov2.png" 
                    alt="Nara Premium Logo" 
                    className="w-10 h-10 rounded-xl bg-white p-0.5 border-2 border-black shadow-[2px_2px_0px_#000] object-contain shrink-0" 
                  />
                </div>

                {/* Big Headline */}
                <div className="space-y-1 mb-14">
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none drop-shadow-[2px_2px_0px_#000]">
                    YOUR
                  </h3>
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none drop-shadow-[2px_2px_0px_#000]">
                    DIGITAL
                  </h3>
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-white leading-none drop-shadow-[2px_2px_0px_#000]">
                    STORE.
                  </h3>
                </div>

                {/* Bottom Tag */}
                <div className="flex justify-between items-end">
                  <div className="inline-block px-3 py-1.5 bg-brand-yellow text-black font-black text-sm uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000]">
                    START Rp{heroLowestPrice}
                  </div>
                  
                  {/* Floating decorative square */}
                  <div className="w-8 h-8 bg-brand-yellow border-2 border-black rotate-12 shadow-[2px_2px_0px_#000]" />
                </div>

                {/* Corner decorative semi-circle */}
                <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-brand-pink/40 border-2 border-black pointer-events-none" />
              </div>
            </div>
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-2 px-2 text-sm font-bold placeholder:text-gray-400 focus:outline-none text-black"
          />
        </div>

        {/* Category Pills (Tabs with Neo-Brutalist borders from Image 1) */}
        <div id="categories-filter" className="scroll-mt-24 flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar">
          <button
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


