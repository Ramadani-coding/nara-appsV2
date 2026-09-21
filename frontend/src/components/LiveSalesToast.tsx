import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { fetchRecentSales, type RecentSale } from '../lib/api';

export function LiveSalesToast() {
  const [sales, setSales] = useState<RecentSale[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Ambil data transaksi riil dari server
  useEffect(() => {
    let isMounted = true;
    const loadSales = async () => {
      const realSales = await fetchRecentSales();
      if (isMounted && realSales.length > 0) {
        setSales(realSales);
      }
    };

    loadSales();
    // Sinkronisasi data riil berkala setiap 60 detik
    const refreshTimer = setInterval(loadSales, 60000);

    return () => {
      isMounted = false;
      clearInterval(refreshTimer);
    };
  }, []);

  // Berganti tampilan setiap 7 detik HANYA jika ada data transaksi riil
  useEffect(() => {
    if (sales.length <= 1) return;

    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % sales.length);
        setVisible(true);
      }, 600);
    }, 7000);

    return () => clearInterval(timer);
  }, [sales.length]);

  // Anti-Slop (R-25): Jangan tampilkan notifikasi palsu jika belum ada transaksi riil
  if (sales.length === 0) {
    return null;
  }

  const current = sales[index % sales.length];

  return (
    <div className="fixed bottom-5 left-5 z-30 pointer-events-none hidden sm:block">
      <AnimatePresence mode="wait">
        {visible && current && (
          <motion.div
            key={`${current.id}-${index}`}
            initial={{ opacity: 0, y: 15, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.25 }}
            className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] p-2.5 flex items-center gap-3 max-w-sm pointer-events-auto"
          >
            <div className="w-8 h-8 rounded-full bg-emerald-50 border border-black flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>

            <div className="text-[11px] leading-tight">
              <div className="font-bold text-gray-500 text-[10px] flex items-center gap-1.5">
                <span>{current.phone}</span>
                <span>•</span>
                <span className="text-emerald-700 font-extrabold uppercase">{current.time}</span>
              </div>
              <div className="font-black text-black truncate max-w-[210px] mt-0.5">
                Membeli <span className="text-brand-blue">{current.product}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

