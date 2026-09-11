import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, MessageCircle, ExternalLink } from 'lucide-react';

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6 pb-20 text-black dark:text-gray-100"
    >
      {/* Top Header Bar with Back Button */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-white dark:bg-[#1E2333] text-black dark:text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn cursor-pointer rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>KEMBALI KE KATALOG</span>
        </button>

        <span className="text-[10px] sm:text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider text-right">
          INFORMASI RESMI
        </span>
      </div>

      {/* Main Card Container */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl overflow-hidden">
        
        {/* Top Gradient Accent Strip */}
        <div className="h-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-brand-pink" />

        <div className="p-6 sm:p-10 space-y-8">
          
          {/* Introductory Notice */}
          <div className="space-y-3 border-b-2 border-black dark:border-gray-700 pb-6">
            <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
              Syarat & Ketentuan
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
              Selamat datang di <strong className="text-black dark:text-white font-black">Nara Premium</strong>! Dengan mengakses atau menggunakan layanan kami, Anda setuju untuk terikat oleh Syarat & Ketentuan ini. Mohon baca dengan saksama sebelum melakukan transaksi.
            </p>
          </div>

          {/* Point 1: Penerimaan Syarat */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-7 h-7 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-[1.5px_1.5px_0px_#000] mt-0.5">
              1
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="font-black text-sm sm:text-base text-black dark:text-white">
                Penerimaan Syarat
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                Dengan melakukan pembelian produk digital di Nara Premium, Anda secara otomatis menerima dan setuju untuk mematuhi semua syarat dan ketentuan yang tercantum di sini. Jika Anda tidak setuju dengan bagian mana pun dari syarat ini, Anda tidak boleh mengakses atau menggunakan layanan kami.
              </p>
            </div>
          </div>

          {/* Point 2: Perubahan Syarat */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-7 h-7 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-[1.5px_1.5px_0px_#000] mt-0.5">
              2
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="font-black text-sm sm:text-base text-black dark:text-white">
                Perubahan Syarat
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                Kami berhak untuk mengubah atau memodifikasi Syarat & Ketentuan ini kapan saja tanpa pemberitahuan sebelumnya. Perubahan akan segera berlaku setelah diposting di situs web ini.
              </p>
            </div>
          </div>

          {/* Point 3: Pembelian Produk Digital */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-7 h-7 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-[1.5px_1.5px_0px_#000] mt-0.5">
              3
            </div>
            <div className="space-y-2 flex-1">
              <h2 className="font-black text-sm sm:text-base text-black dark:text-white">
                Pembelian Produk Digital
              </h2>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
                  <span>Semua harga produk digital yang ditampilkan di situs kami adalah final.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
                  <span>Pembayaran harus dilakukan melalui metode yang tersedia (QRIS/E-Wallet).</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
                  <span>Setelah pembayaran berhasil, detail akun/produk digital akan dikirim otomatis ke WhatsApp & halaman Invoice.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
                  <span>Kami tidak bertanggung jawab atas kesalahan input nomor WhatsApp oleh pembeli.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Point 4: Pengembalian Dana & Garansi */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-7 h-7 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-[1.5px_1.5px_0px_#000] mt-0.5">
              4
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="font-black text-sm sm:text-base text-black dark:text-white">
                Pengembalian Dana & Garansi
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                Kebijakan pengembalian dana dan garansi kami dijelaskan secara terpisah di halaman{' '}
                <Link to="/kebijakan-garansi" className="text-[#6366F1] dark:text-[#818CF8] font-black underline hover:text-indigo-700 dark:hover:text-indigo-300">
                  Kebijakan Garansi
                </Link>
                . Harap tinjau halaman tersebut untuk informasi lebih lanjut mengenai masa aktif garansi setiap produk.
              </p>
            </div>
          </div>

          {/* Point 5: Larangan Penggunaan */}
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="w-7 h-7 rounded-full bg-[#6366F1] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-[1.5px_1.5px_0px_#000] mt-0.5">
              5
            </div>
            <div className="space-y-1.5 flex-1">
              <h2 className="font-black text-sm sm:text-base text-black dark:text-white">
                Larangan Penggunaan
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                Dilarang keras mengubah data akun (Email/Password/Profile) untuk produk bertipe "Sharing" atau "Private" yang bergaransi, kecuali diinstruksikan lain. Pelanggaran ini akan menghanguskan garansi secara otomatis.
              </p>
            </div>
          </div>

          {/* Callout Box: Butuh Bantuan? */}
          <div className="p-4 sm:p-5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl space-y-3 shadow-[2px_2px_0px_#000]">
            <h3 className="font-black text-sm sm:text-base text-black dark:text-white">
              Butuh Bantuan?
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
              Jika Anda memiliki pertanyaan mengenai Syarat & Ketentuan ini, silakan hubungi kami melalui WhatsApp.
            </p>
            <div className="pt-1">
              <a
                href="https://wa.me/6285750231336?text=Halo%20Admin%20Nara%20Premium,%20saya%20ingin%20bertanya%20mengenai%20Syarat%20%26%20Ketentuan"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-black hover:bg-gray-800 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl transition-all"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Hubungi Admin WhatsApp</span>
                <ExternalLink className="w-3 h-3 text-gray-400 ml-0.5 shrink-0" />
              </a>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
