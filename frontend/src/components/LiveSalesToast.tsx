import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck } from 'lucide-react';

const mockSales = [
  { phone: '6281XXXX55', time: '2 JAM LALU', product: 'Alightmotion Exp Agustus 2027' },
  { phone: '6285XXXX12', time: 'BARU SAJA', product: 'Prime Video 1 Bulan Privat' },
  { phone: '6289XXXX89', time: '15 MENIT LALU', product: 'CapCut Pro 1 Tahun' },
  { phone: '6287XXXX43', time: '1 JAM LALU', product: 'Canva Pro 3 Bulan Invite' },
  { phone: '6282XXXX90', time: '45 MENIT LALU', product: 'Netflix 4K UHD 1 Bulan' },
];

export function LiveSalesToast() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % mockSales.length);
        setVisible(true);
      }, 800);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const current = mockSales[index];

  return (
    <div className="fixed bottom-5 left-5 z-30 pointer-events-none hidden sm:block">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] p-2.5 flex items-center gap-3 max-w-sm pointer-events-auto"
          >
            <div className="w-8 h-8 rounded-full bg-brand-pink-soft border border-black flex items-center justify-center text-brand-pink shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>

            <div className="text-[11px] leading-tight">
              <div className="font-bold text-gray-500 text-[10px]">
                <span>{current.phone}</span> • <span className="text-emerald-600 font-extrabold">{current.time}</span>
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
