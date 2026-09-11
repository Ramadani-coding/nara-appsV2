import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle, 
  MessageCircle, 
  ExternalLink 
} from 'lucide-react';

interface WarrantyItem {
  product: string;
  duration: string;
  badgeType?: 'full' | 'backfree' | 'normal';
}

const warrantyList: WarrantyItem[] = [
  { product: 'CapCut Pro (1 Bulan)', duration: 'FULL GARANSI (30 Hari)', badgeType: 'full' },
  { product: 'CapCut Pro (Mingguan/Lainnya)', duration: 'Garansi 7 Hari', badgeType: 'normal' },
  { product: 'Alight Motion (AM)', duration: 'Garansi 3 Bulan', badgeType: 'normal' },
  { product: 'Viu Premium', duration: 'Garansi 3 Bulan', badgeType: 'normal' },
  { product: 'Canva Pro / Edu', duration: 'Garansi 3 Bulan', badgeType: 'normal' },
  { product: 'Spotify Premium', duration: 'GARANSI BACKFREE*', badgeType: 'backfree' },
  { product: 'Prime Video', duration: 'GARANSI BACKFREE*', badgeType: 'backfree' },
  { product: 'Aplikasi Lainnya (Zoom, VPN, dll)', duration: 'Garansi 7 Hari.', badgeType: 'normal' },
];

export default function WarrantyPolicy() {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-6 pb-20 text-black dark:text-gray-100"
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
          KEBIJAKAN RESMI
        </span>
      </div>

      {/* Main Headline */}
      <div className="text-center space-y-2 py-2">
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black dark:text-white">
          Kebijakan Garansi
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium max-w-lg mx-auto">
          Kami menjamin kualitas setiap produk digital yang Anda beli.
        </p>
      </div>

      {/* CARD 1: Masa Berlaku Garansi */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl overflow-hidden">
        {/* Top Accent Strip */}
        <div className="h-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-brand-blue" />

        <div className="p-4 sm:p-8 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b-2 border-black dark:border-gray-700 pb-4">
            <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950/60 border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[1.5px_1.5px_0px_#000] shrink-0">
              <ShieldCheck className="w-4 h-4 text-purple-700 dark:text-purple-300" />
            </div>
            <h2 className="font-black text-base sm:text-lg text-black dark:text-white">
              Masa Berlaku Garansi
            </h2>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border-2 border-black dark:border-gray-700 rounded-xl shadow-[2px_2px_0px_#000]">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] dark:bg-[#1E2333] border-b-2 border-black dark:border-gray-700 font-black text-black dark:text-white">
                  <th className="py-3 px-3.5 sm:px-5">Nama Produk</th>
                  <th className="py-3 px-3.5 sm:px-5">Durasi Garansi</th>
                </tr>
              </thead>
              <tbody className="divide-y border-black dark:border-gray-700">
                {warrantyList.map((item, idx) => (
                  <tr 
                    key={idx}
                    className="hover:bg-gray-50/80 dark:hover:bg-[#151923] transition-colors"
                  >
                    <td className="py-3 px-3.5 sm:px-5 font-bold text-black dark:text-gray-200">
                      {item.product}
                    </td>
                    <td className="py-3 px-3.5 sm:px-5 font-medium">
                      {item.badgeType === 'full' ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-black dark:border-emerald-700 rounded-md">
                          {item.duration}
                        </span>
                      ) : item.badgeType === 'backfree' ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] sm:text-xs font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/70 text-brand-blue dark:text-blue-300 border border-black dark:border-blue-700 rounded-md">
                          {item.duration}
                        </span>
                      ) : (
                        <span className="text-gray-700 dark:text-gray-300 font-semibold">
                          {item.duration}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Backfree Note Box */}
          <div className="p-3.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 leading-relaxed italic shadow-[1.5px_1.5px_0px_#000]">
            <strong className="font-black text-black dark:text-white not-italic">*) Garansi Backfree:</strong> Jika terjadi kendala (back to free/iklan muncul) selama masa aktif dan kalau produk yang dipesan ada garansinya, kami akan langsung memperbaiki atau mengganti akun baru tanpa biaya tambahan secepatnya.
          </div>
        </div>
      </div>

      {/* CARD 2: Syarat Klaim Garansi */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-5 sm:p-8 space-y-4">
        <div className="flex items-center gap-2.5 border-b-2 border-black dark:border-gray-700 pb-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[1.5px_1.5px_0px_#000] shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <h2 className="font-black text-base sm:text-lg text-black dark:text-white">
            Syarat Klaim Garansi
          </h2>
        </div>

        <ul className="space-y-2.5 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium">
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
            <span>
              Garansi <strong className="text-red-600 dark:text-red-400 font-black">HANGUS</strong> jika pembeli mengubah data sensitif akun (Email, Password, Username, atau Profil) pada produk <em>Sharing/Private</em> yang dilarang untuk diubah.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
            <span>Garansi hanya berlaku untuk pembeli asli dan tidak dapat dipindahtangankan.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
            <span>Wajib menyertakan <strong>Nomor Invoice</strong> atau Bukti Transfer saat mengajukan komplain.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
            <span>Klaim harus diajukan dalam masa garansi yang tertera di atas.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-gray-400 shrink-0 mt-2" />
            <span>Memberikan ulasan negatif atau melakukan spam chat kasar akan membatalkan garansi.</span>
          </li>
        </ul>
      </div>

      {/* CARD 3: Cara Mengajukan Komplain */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl p-5 sm:p-8 space-y-5">
        <div className="space-y-1 border-b-2 border-black dark:border-gray-700 pb-3">
          <h2 className="font-black text-base sm:text-lg text-black dark:text-white">
            Cara Mengajukan Komplain
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
            Jika produk yang Anda beli mengalami kendala, ikuti langkah berikut:
          </p>
        </div>

        <ol className="space-y-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 font-medium">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-black text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shrink-0">
              1
            </span>
            <span className="pt-0.5">Screenshot kendala yang terjadi pada aplikasi/akun.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-black text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shrink-0">
              2
            </span>
            <span className="pt-0.5">Siapkan Nomor Invoice (Contoh: <strong>20261230ABCD</strong>).</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-black text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shrink-0">
              3
            </span>
            <span className="pt-0.5">Hubungi Admin via WhatsApp dengan sopan.</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-lg bg-black text-white dark:bg-white dark:text-black font-black text-xs flex items-center justify-center shrink-0">
              4
            </span>
            <span className="pt-0.5">Tunggu proses pengecekan (Estimasi 10 menit – 24 jam).</span>
          </li>
        </ol>

        <div className="pt-2">
          <a
            href="https://wa.me/6285750231336?text=Halo%20Admin%20Nara%20Premium,%20saya%20ingin%20klaim%20garansi%20pesanan"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#6366F1] hover:bg-indigo-600 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl transition-all"
          >
            <MessageCircle className="w-4 h-4 text-white shrink-0" />
            <span>Hubungi Admin</span>
            <ExternalLink className="w-3.5 h-3.5 text-white/80 ml-0.5 shrink-0" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
