import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, Zap, QrCode } from 'lucide-react';

interface OrderGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'guide' | 'faq';
}

export function OrderGuideModal({ isOpen, onClose, initialTab = 'guide' }: OrderGuideModalProps) {
  const [tab, setTab] = useState<'guide' | 'faq'>(initialTab);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-[#FAF8F5] border-2 border-black shadow-[8px_8px_0px_0px_#000000] rounded-none max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-black"
        >
          {/* Header */}
          <div className="border-b-2 border-black p-4 bg-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 bg-brand-pink text-white font-black text-sm flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000]">
                ?
              </span>
              <h2 className="font-extrabold text-xl tracking-tight">PANDUAN & BANTUAN</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white hover:bg-brand-pink hover:text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Selector */}
          <div className="flex border-b-2 border-black bg-gray-100 p-2 gap-2">
            <button
              onClick={() => setTab('guide')}
              className={`flex-1 py-2 font-bold text-sm border-2 border-black transition-all cursor-pointer ${
                tab === 'guide'
                  ? 'bg-brand-blue text-white shadow-[2px_2px_0px_#000]'
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              🚀 Cara Order Cepat
            </button>
            <button
              onClick={() => setTab('faq')}
              className={`flex-1 py-2 font-bold text-sm border-2 border-black transition-all cursor-pointer ${
                tab === 'faq'
                  ? 'bg-brand-pink text-white shadow-[2px_2px_0px_#000]'
                  : 'bg-white hover:bg-gray-50'
              }`}
            >
              💬 Pertanyaan Populer (FAQ)
            </button>
          </div>

          {/* Content Area */}
          <div className="p-6 overflow-y-auto space-y-4">
            {tab === 'guide' ? (
              <div className="space-y-4">
                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex gap-4 items-start">
                  <div className="w-8 h-8 bg-brand-yellow font-black border-2 border-black flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base mb-1">Pilih Produk Digital</h4>
                    <p className="text-sm text-gray-700">
                      Telusuri katalog produk seperti Canva Pro, CapCut, Alight Motion, Spotify, atau lainnya. Klik tombol <strong>Beli Sekarang</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex gap-4 items-start">
                  <div className="w-8 h-8 bg-brand-pink text-white font-black border-2 border-black flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base mb-1">Masukkan Nomor WhatsApp & Email</h4>
                    <p className="text-sm text-gray-700">
                      Data kontak digunakan sebagai tujuan pengiriman detail akun, kode redeem, atau link undangan resmi.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex gap-4 items-start">
                  <div className="w-8 h-8 bg-brand-blue text-white font-black border-2 border-black flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base mb-1">Scan & Bayar QRIS</h4>
                    <p className="text-sm text-gray-700">
                      Gunakan GoPay, OVO, Dana, ShopeePay, BCA, atau mobile banking apapun. Sistem mendeteksi pembayaran secara real-time otomatis.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex gap-4 items-start">
                  <div className="w-8 h-8 bg-emerald-400 font-black border-2 border-black flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base mb-1">Pesanan Selesai Instan</h4>
                    <p className="text-sm text-gray-700">
                      Setelah transaksi sukses, sistem langsung memproses pesanan ke provider. Detail akun langsung dapat diakses di menu <strong>Pesanan Saya</strong>.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <h4 className="font-extrabold text-base mb-1 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-brand-blue" />
                    Apakah ada garansi jika akun bermasalah?
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    Ya, seluruh produk bergaransi penuh sesuai masa durasi langganan yang dibeli. Jika terjadi kendala, silakan hubungi tim support dengan melampirkan Nomor Order.
                  </p>
                </div>

                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <h4 className="font-extrabold text-base mb-1 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-brand-pink" />
                    Berapa lama proses pengiriman produk?
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    Sistem bekerja otomatis 24 jam nonstop tanpa campur tangan admin manual. Rata-rata pesanan selesai dalam 5-60 detik setelah pembayaran QRIS terkonfirmasi.
                  </p>
                </div>

                <div className="p-4 bg-white border-2 border-black shadow-[3px_3px_0px_#000]">
                  <h4 className="font-extrabold text-base mb-1 flex items-center gap-2">
                    <QrCode className="w-5 h-5 text-brand-blue" />
                    Metode pembayaran apa saja yang didukung?
                  </h4>
                  <p className="text-sm text-gray-700 mt-1">
                    Kami mendukung semua aplikasi pembayaran berstandar QRIS Indonesia, termasuk GoPay, OVO, Dana, LinkAja, ShopeePay, AstraPay, serta seluruh m-Banking (BCA, Mandiri, BRI, BNI, Jago, Seabank, dll).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer CTA */}
          <div className="border-t-2 border-black p-4 bg-white flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-brand-blue text-white font-extrabold text-sm border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-blue-700 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              Mengerti, Tutup
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
