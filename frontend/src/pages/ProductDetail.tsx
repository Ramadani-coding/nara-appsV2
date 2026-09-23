import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { type ProductPackage } from '../lib/mockData';
import { useLiveService } from '../lib/useLiveCatalog';
import { ArrowLeft, Share2, Check, Sparkles, Clock } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { LiveSalesToast } from '../components/LiveSalesToast';
import { usePremkuBalance } from '../lib/usePremkuBalance';
import { MaintenanceTooltip } from '../components/MaintenanceTooltip';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const service = useLiveService(id || '');
  const { isMaintenance } = usePremkuBalance();

  const [copiedShare, setCopiedShare] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [id]);

  const handleBackToCatalog = () => {
    navigate('/#categories-filter');
  };

  if (!service) {
    return (
      <div className="text-center py-20 text-black max-w-md mx-auto">
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-8 space-y-4">
          <h2 className="text-2xl font-black">Layanan Tidak Ditemukan</h2>
          <p className="text-sm text-gray-600">Layanan yang Anda cari tidak tersedia atau tautan salah.</p>
          <button
            onClick={handleBackToCatalog}
            className="px-6 py-2.5 bg-brand-blue text-white font-black text-sm border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
          >
            Kembali ke Katalog
          </button>
        </div>
      </div>
    );
  }

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 text-black">
      {/* Back Button */}
      <button 
        onClick={handleBackToCatalog}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>KEMBALI KE KATALOG</span>
      </button>

      {/* ========================================================
          TOP HEADER CARD (Matching Reference Image 2)
         ======================================================== */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border-2 border-black shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative overflow-hidden"
      >
        {/* Left: Large App Logo in Squircle */}
        <div className="p-3 bg-[#FAF8F5] border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] shrink-0">
          <AppLogo id={service.iconId} imageUrl={service.imageUrl} className="w-20 h-20 sm:w-24 sm:h-24" />
        </div>

        {/* Right: App Information */}
        <div className="space-y-3 text-center md:text-left flex-grow">
          {/* Title & Category Badge */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
              {service.name}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-black uppercase tracking-wider bg-cyan-100 text-cyan-800 border border-black rounded-md">
              {service.genreTag}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed max-w-2xl">
            {service.description}
          </p>

          {/* Buttons Row (Share & Account Tag) */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={handleShare}
              className="px-3.5 py-1.5 bg-white hover:bg-gray-50 text-black font-extrabold text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn flex items-center gap-1.5 cursor-pointer"
            >
              {copiedShare ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-black">Tautan Disalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Bagikan</span>
                </>
              )}
            </button>

            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-800 font-extrabold text-xs uppercase tracking-wider border border-black rounded-lg">
              {service.accountTypeTag}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ========================================================
          PACKAGE SELECTOR SECTION (Matching Reference Image 2)
         ======================================================== */}
      <section className="space-y-6 pt-4">
        {/* Section Sub-header */}
        <div className="flex items-center gap-2 font-black text-xs uppercase tracking-widest text-gray-700">
          <Sparkles className="w-4 h-4 text-brand-blue" />
          <span>PILIH PAKET {service.name.toUpperCase()}</span>
        </div>

        {/* Grid of Package Cards (2 columns on mobile, scaling up to 4 on desktop) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
          {service.packages.filter((pkg: ProductPackage) => pkg.isActive !== false).map((pkg: ProductPackage, index: number) => {
            const isOutOfStock = pkg.stockCount <= 0;
            const pkgModalPrice = pkg.providerPrice || pkg.price;
            const isPkgMaintenance = pkg.isMaintenance !== undefined 
              ? pkg.isMaintenance 
              : (!isOutOfStock && isMaintenance(pkgModalPrice));

            return (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`border-2 transition-all rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col justify-between items-center text-center space-y-3 sm:space-y-4 relative ${
                  isOutOfStock
                    ? 'bg-gray-100 dark:bg-gray-800/70 border-gray-300 dark:border-gray-700 opacity-40 grayscale select-none cursor-not-allowed shadow-none'
                    : isPkgMaintenance
                    ? 'bg-amber-50/40 dark:bg-[#1C1F2B] border-2 border-black shadow-[3px_3px_0px_0px_#000000] sm:shadow-[4px_4px_0px_0px_#000000]'
                    : 'bg-white border-2 border-black shadow-[3px_3px_0px_0px_#000000] sm:shadow-[4px_4px_0px_0px_#000000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_0px_#000000]'
                }`}
              >
                {/* Top Badges Row: Stock Availability & Discount */}
                <div className="w-full flex justify-between items-center gap-1">
                  <span className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase rounded-md shadow-[1px_1px_0px_#000] truncate ${
                    isOutOfStock
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : isPkgMaintenance
                      ? 'bg-amber-100 text-amber-900 border border-amber-500 flex items-center gap-1'
                      : 'bg-cyan-100 text-cyan-800 border border-black'
                  }`}>
                    {isOutOfStock ? (
                      'HABIS'
                    ) : isPkgMaintenance ? (
                      <>
                        <Clock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                        <span>COMING SOON</span>
                      </>
                    ) : (
                      pkg.stockBadge
                    )}
                  </span>

                  {pkg.discountPercent && !isPkgMaintenance && (
                    <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase bg-brand-pink-soft text-brand-pink border border-black rounded-md shadow-[1px_1px_0px_#000] shrink-0">
                      {pkg.discountPercent}% OFF
                    </span>
                  )}

                  {isPkgMaintenance && (
                    <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase bg-amber-100 text-amber-900 border border-black rounded-md shadow-[1px_1px_0px_#000] shrink-0">
                      SEGERA
                    </span>
                  )}
                </div>

                {/* Center App Logo */}
                <div className="my-1 sm:my-2 flex items-center justify-center">
                  <AppLogo id={service.iconId} imageUrl={pkg.imageUrl || service.imageUrl} className="w-14 h-14 sm:w-20 sm:h-20" />
                </div>

                {/* Package Label & Title */}
                <div className="space-y-0.5 sm:space-y-1 w-full">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-brand-blue block">
                    {service.name.split(' ')[0].toUpperCase()}
                  </span>
                  <h3 className="font-black text-xs sm:text-base text-black line-clamp-2 leading-tight">
                    {pkg.name}
                  </h3>
                </div>

                {/* Pricing Box */}
                <div className="w-full pt-1 border-t border-dashed border-gray-200">
                  <div className="text-[10px] sm:text-xs text-gray-400 line-through font-bold">
                    Rp {pkg.originalPrice.toLocaleString('id-ID')}
                  </div>
                  <div className={`text-base sm:text-2xl font-black ${
                    isOutOfStock 
                      ? 'text-gray-500' 
                      : isPkgMaintenance 
                      ? 'text-amber-900 dark:text-amber-300' 
                      : 'text-brand-blue'
                  }`}>
                    Rp {pkg.price.toLocaleString('id-ID')}
                  </div>
                </div>

                {/* Action CTA Button */}
                {isOutOfStock ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="w-full py-2 sm:py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-500 font-black text-[10px] sm:text-xs uppercase tracking-wider border-2 border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl cursor-not-allowed pointer-events-none select-none flex items-center justify-center"
                  >
                    STOK HABIS
                  </button>
                ) : isPkgMaintenance ? (
                  <MaintenanceTooltip
                    isActive={true}
                    title="PRODUK COMING SOON"
                    message="Layanan paket ini akan segera hadir. Pembelian belum dapat diproses saat ini, silakan pantau kembali secara berkala."
                    className="w-full"
                    position="top"
                  >
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="w-full py-2 sm:py-2.5 bg-amber-200 hover:bg-amber-300 dark:bg-amber-900/60 dark:hover:bg-amber-900 text-amber-950 dark:text-amber-100 font-black text-[10px] sm:text-xs uppercase tracking-wider border-2 border-black rounded-lg sm:rounded-xl cursor-not-allowed select-none flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#000] transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-amber-900 dark:text-amber-200 shrink-0" />
                      <span>COMING SOON</span>
                    </button>
                  </MaintenanceTooltip>
                ) : (
                  <Link
                    to={`/checkout/${service.id}?package=${pkg.id}`}
                    className="w-full py-2 sm:py-2.5 bg-gray-50 hover:bg-brand-blue hover:text-white text-black font-black text-[10px] sm:text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg sm:rounded-xl neo-btn flex items-center justify-center transition-colors"
                  >
                    PILIH PAKET
                  </Link>
                )}
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Live Sales Notification Toast */}
      <LiveSalesToast />
    </div>
  );
}


