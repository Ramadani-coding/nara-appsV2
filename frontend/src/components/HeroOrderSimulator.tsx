import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  CheckCircle2, 
  QrCode, 
  Sparkles, 
  Copy, 
  Eye, 
  ShieldCheck, 
  ArrowRight, 
  MousePointerClick, 
  Check, 
  Lock 
} from 'lucide-react';
import { type ServiceProduct } from '../lib/mockData';
import { AppLogo } from './AppLogo';

export interface HeroOrderSimulatorProps {
  services: ServiceProduct[];
  className?: string;
  isMobileCompact?: boolean;
}

interface MockStep {
  id: number;
  title: string;
  shortTitle: string;
  durationSec: number;
}

const STEPS: MockStep[] = [
  { id: 1, title: '1. Pilih Paket', shortTitle: 'Pilih', durationSec: 3.5 },
  { id: 2, title: '2. Scan QRIS', shortTitle: 'Bayar', durationSec: 3.0 },
  { id: 3, title: '3. Akun Jadi', shortTitle: 'Akun', durationSec: 4.0 },
];

export const HeroOrderSimulator: React.FC<HeroOrderSimulatorProps> = ({
  services,
  className = '',
  isMobileCompact = false,
}) => {
  // Ambil beberapa layanan populer untuk dirotasi secara otomatis pada simulasi
  const sampleServices = useMemo(() => {
    if (!services || services.length === 0) return [];
    const prioritized = ['netflix', 'spotify', 'youtube-premium', 'canva', 'capcut']
      .map(id => services.find(s => s.id === id))
      .filter((s): s is ServiceProduct => Boolean(s && s.packages && s.packages.length > 0));

    return prioritized.length > 0 ? prioritized : services.slice(0, 4);
  }, [services]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [serviceCycleIndex, setServiceCycleIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [copiedSimulated, setCopiedSimulated] = useState(false);
  const [showPasswordSimulated, setShowPasswordSimulated] = useState(false);

  const activeService = sampleServices[serviceCycleIndex % Math.max(1, sampleServices.length)] || services[0];
  const activePackage = activeService?.packages?.[0] || {
    id: 'mock-1',
    name: '1 Bulan Privat UHD',
    duration: '1 Bulan',
    type: 'Privat',
    price: 25000,
    originalPrice: 65000,
    discountPercent: 62,
    stockBadge: 'ADA 14',
  };

  // Auto-advance loop across steps
  useEffect(() => {
    if (isPaused) return;

    const currentStep = STEPS[currentStepIndex];
    const timer = setTimeout(() => {
      setCurrentStepIndex((prev) => {
        const next = (prev + 1) % STEPS.length;
        // Jika siklus kembali ke langkah 1, ganti aplikasi berikutnya
        if (next === 0) {
          setServiceCycleIndex((s) => s + 1);
          setCopiedSimulated(false);
          setShowPasswordSimulated(false);
        }
        return next;
      });
    }, currentStep.durationSec * 1000);

    return () => clearTimeout(timer);
  }, [currentStepIndex, isPaused]);

  // Micro-simulation interactions inside step 3
  useEffect(() => {
    if (currentStepIndex === 2) {
      const copyTimer = setTimeout(() => setCopiedSimulated(true), 1200);
      const passTimer = setTimeout(() => setShowPasswordSimulated(true), 2000);
      return () => {
        clearTimeout(copyTimer);
        clearTimeout(passTimer);
      };
    } else {
      setCopiedSimulated(false);
      setShowPasswordSimulated(false);
    }
  }, [currentStepIndex]);

  return (
    <div 
      className={`relative w-full ${className}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Tilted background yellow & pink decorative backplates (Desktop depth) */}
      {!isMobileCompact && (
        <>
          <motion.div 
            animate={{ 
              rotate: [9, 12, 9],
              y: [0, -3, 0]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 6, 
              ease: "easeInOut" 
            }}
            className="absolute -top-3 -right-3 w-36 h-40 bg-brand-yellow border-3 border-black -z-10 shadow-[3px_3px_0px_#000] rounded-2xl pointer-events-none" 
          />
          <motion.div 
            animate={{ 
              rotate: [-9, -12, -9],
              y: [0, 4, 0]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 7, 
              ease: "easeInOut",
              delay: 0.5
            }}
            className="absolute -bottom-3 -left-3 w-32 h-32 bg-brand-pink border-3 border-black -z-10 shadow-[3px_3px_0px_#000] rounded-2xl pointer-events-none" 
          />
        </>
      )}

      {/* Main Animated Mockup Container */}
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: "spring", stiffness: 350, damping: 25 }}
        className="bg-white dark:bg-[#181C2A] border-2 sm:border-3 border-black dark:border-gray-700 shadow-[4px_4px_0px_0px_#000000] sm:shadow-[6px_6px_0px_0px_#000000] rounded-2xl overflow-hidden relative"
      >
        {/* Mockup Window Top Header */}
        <div className="bg-[#FAF8F5] dark:bg-[#151923] border-b-2 border-black dark:border-gray-700 px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400 border border-black shadow-[0.5px_0.5px_0px_#000]" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400 border border-black shadow-[0.5px_0.5px_0px_#000]" />
            <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400 border border-black shadow-[0.5px_0.5px_0px_#000]" />
            <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 ml-1.5 font-mono">
              DEMO SISTEM OTOMATIS
            </span>
          </div>

        </div>

        {/* Step Tabs & Animated Progress Bar: Clean & High Legibility on Mobile */}
        <div className="grid grid-cols-3 border-b-2 border-black dark:border-gray-700 bg-white dark:bg-[#181C2A]">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`py-2 px-1 sm:py-2.5 sm:px-2 text-center relative transition-all cursor-pointer border-r border-black/20 dark:border-gray-700 last:border-r-0 ${
                  isActive 
                    ? 'bg-brand-yellow/25 dark:bg-brand-yellow/15 text-black dark:text-white font-black' 
                    : 'text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs">
                  {isCompleted ? (
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3] shrink-0" />
                  ) : isActive ? (
                    <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-blue fill-brand-blue shrink-0" />
                  ) : null}
                  <span className="hidden sm:inline truncate">{step.title}</span>
                  <span className="inline sm:hidden font-black">{step.shortTitle}</span>
                </div>

                {/* Animated active progress fill line */}
                {isActive && (
                  <motion.div
                    key={`progress-${idx}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ 
                      duration: step.durationSec, 
                      ease: 'linear' 
                    }}
                    className="absolute bottom-0 left-0 h-1 bg-brand-blue"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Mockup Body with Animated Scene Transitions */}
        <div className="p-3 sm:p-5 min-h-[250px] sm:min-h-[290px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            
            {/* ========================================================
                SCENE 1: PILIH PRODUK & PAKET (SIMULASI PILIH OTOMATIS)
               ======================================================== */}
            {currentStepIndex === 0 && (
              <motion.div
                key={`scene-1-${activeService?.id}`}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-2.5 sm:space-y-3"
              >
                {/* Service Header Row */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 p-1 bg-white border-2 border-black rounded-xl shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0">
                      <AppLogo id={activeService?.iconId || 'netflix'} imageUrl={activeService?.imageUrl} className="w-6 h-6 object-contain" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-xs sm:text-sm text-black dark:text-white leading-tight truncate">
                        {activeService?.name || 'Netflix Premium'}
                      </h4>
                      <span className="text-[10px] font-extrabold text-brand-blue dark:text-blue-400 uppercase tracking-wider block">
                        {activeService?.category || 'Streaming'}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 bg-brand-pink text-white border border-black shadow-[1px_1px_0px_#000] text-[9px] sm:text-[10px] font-black rounded-md shrink-0 animate-pulse">
                    HEMAT {activePackage.discountPercent || 60}%
                  </span>
                </div>

                {/* Selected Package Card (Tersusun rapi tanpa elemen tumpah) */}
                <div className="bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl p-2.5 sm:p-3.5 shadow-[2px_2px_0px_#000] space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-black dark:border-white shadow-[0.5px_0.5px_0px_#000] shrink-0" />
                      <span className="font-black text-xs sm:text-sm text-black dark:text-white truncate">
                        {activePackage.name}
                      </span>
                    </div>
                    <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 bg-yellow-100 text-yellow-900 border border-black rounded shrink-0">
                      {activePackage.type}
                    </span>
                  </div>

                  <div className="flex items-end justify-between pt-1 border-t border-dashed border-gray-300 dark:border-gray-700">
                    <div className="space-y-0.5">
                      <del className="text-[10px] sm:text-[11px] font-bold text-gray-400 dark:text-gray-500 block">
                        Rp {activePackage.originalPrice?.toLocaleString('id-ID') || '65.000'}
                      </del>
                      <div className="text-lg sm:text-2xl font-black text-brand-blue dark:text-blue-400 leading-none">
                        Rp {activePackage.price.toLocaleString('id-ID')}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-black text-white dark:bg-white dark:text-black px-2 py-0.5 sm:py-1 rounded-md text-[10px] font-black shadow-[1px_1px_0px_#FFD21E]">
                      <MousePointerClick className="w-3 h-3 text-brand-yellow dark:text-brand-blue animate-bounce shrink-0" />
                      <span>Terpilih</span>
                    </div>
                  </div>
                </div>

                {/* Simulated Order Button */}
                <div className="w-full min-h-[40px] sm:min-h-[42px] py-2 px-3 bg-brand-yellow text-black font-black text-xs sm:text-sm uppercase tracking-wider border-2 border-black rounded-xl shadow-[2.5px_2.5px_0px_#000] flex items-center justify-center gap-1.5">
                  <span>Lanjut ke Pembayaran</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SCENE 2: SCAN QRIS INSTAN (SIMULASI SCAN & AUTO LUNAS)
               ======================================================== */}
            {currentStepIndex === 1 && (
              <motion.div
                key="scene-2"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-2.5 text-center"
              >
                <div className="flex items-center justify-between border-b border-black/10 dark:border-gray-800 pb-1.5 text-xs">
                  <span className="font-bold text-gray-600 dark:text-gray-400 text-[11px] sm:text-xs">
                    Total Pembayaran:
                  </span>
                  <span className="text-xs sm:text-sm font-black text-brand-blue dark:text-blue-400 font-mono">
                    Rp {(activePackage.price + 412).toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Animated QRIS Card with Scanning Beam */}
                <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto bg-white border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] p-1.5 flex items-center justify-center overflow-hidden">
                  <QrCode className="w-24 h-24 sm:w-28 sm:h-28 text-black" />
                  
                  {/* Laser scan line moving up and down */}
                  <motion.div
                    animate={{ y: [-40, 40, -40] }}
                    transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
                    className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_6px_#EF4444]"
                  />

                  {/* Payment Success Burst Animation */}
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.2, type: "spring", stiffness: 400 }}
                    className="absolute inset-0 bg-emerald-500/95 flex flex-col items-center justify-center text-white p-1.5 text-center"
                  >
                    <CheckCircle2 className="w-8 h-8 sm:w-9 sm:h-9 stroke-[3] drop-shadow-[1px_1px_0px_#000]" />
                    <span className="font-black text-[10px] sm:text-[11px] uppercase tracking-wider mt-1 drop-shadow-[1px_1px_0px_#000]">
                      LUNAS TERVERIFIKASI
                    </span>
                    <span className="text-[9px] font-mono opacity-90">Auto 0.8 Detik</span>
                  </motion.div>
                </div>

                <div className="p-1.5 sm:p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-700 rounded-lg">
                  <span className="text-[11px] sm:text-xs font-black text-emerald-800 dark:text-emerald-300 block">
                    ⚡ Sistem Mendeteksi Transfer Otomatis
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-300 font-medium">
                    BCA • Mandiri • BRI • QRIS • Dana • GoPay • OVO
                  </span>
                </div>
              </motion.div>
            )}

            {/* ========================================================
                SCENE 3: AKUN LANGSUNG JADI & KREDENSIAL TERKIRIM
               ======================================================== */}
            {currentStepIndex === 2 && (
              <motion.div
                key="scene-3"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-2"
              >
                {/* Status Bar */}
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-black dark:border-emerald-600 rounded-full text-[9px] sm:text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    PESANAN SUKSES
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold text-gray-500 dark:text-gray-400">
                    ID: #NARA-{Math.floor(100000 + Math.random() * 900000)}
                  </span>
                </div>

                {/* Account Details Box */}
                <div className="bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl p-2.5 sm:p-3 space-y-2 shadow-[2px_2px_0px_#000]">
                  <div className="flex items-center justify-between border-b border-dashed border-gray-300 dark:border-gray-700 pb-1">
                    <span className="text-[10px] sm:text-xs font-black uppercase text-black dark:text-white">
                      Kredensial Akun:
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Garansi 30 Hari
                    </span>
                  </div>

                  {/* Email Field with simulated copy */}
                  <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white dark:bg-[#151923] border border-black dark:border-gray-700 rounded-lg text-xs font-mono shadow-[0.5px_0.5px_0px_#000] gap-1.5">
                    <span className="font-bold text-black dark:text-white truncate text-[11px] sm:text-xs">
                      premium.nara{serviceCycleIndex + 1}@gmail.com
                    </span>
                    <span className={`text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 transition-all ${
                      copiedSimulated 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-500' 
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                    }`}>
                      {copiedSimulated ? <Check className="w-3 h-3 text-emerald-600 stroke-[3]" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedSimulated ? 'Tersalin' : 'Salin'}</span>
                    </span>
                  </div>

                  {/* Password Field with simulated reveal */}
                  <div className="flex items-center justify-between p-1.5 sm:p-2 bg-white dark:bg-[#151923] border border-black dark:border-gray-700 rounded-lg text-xs font-mono shadow-[0.5px_0.5px_0px_#000] gap-1.5">
                    <span className="font-bold text-black dark:text-white text-[11px] sm:text-xs">
                      {showPasswordSimulated ? 'naraSecure2026!' : '••••••••••••'}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1 shrink-0">
                      {showPasswordSimulated ? <Eye className="w-3 h-3 text-brand-blue" /> : <Lock className="w-3 h-3" />}
                      <span>{showPasswordSimulated ? 'Terbuka' : 'Tersimpan'}</span>
                    </span>
                  </div>
                </div>

                {/* Instant Guarantee Footer */}
                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-black text-black dark:text-white px-0.5">
                  <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="w-3 h-3" /> Garansi Resmi Penggantian
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">Siap Login</span>
                </div>
              </motion.div>
            )}

          </AnimatePresence>

          {/* Bottom Live Micro Caption */}
          <div className="pt-2 sm:pt-2.5 border-t border-black/10 dark:border-gray-800 flex items-center justify-between text-[9px] sm:text-[10px] font-extrabold uppercase text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-brand-yellow fill-brand-yellow shrink-0" />
              Selesai dalam &lt; 2 menit
            </span>
            <span className="font-mono text-brand-blue dark:text-blue-400">
              Langkah {currentStepIndex + 1} dari 3
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
