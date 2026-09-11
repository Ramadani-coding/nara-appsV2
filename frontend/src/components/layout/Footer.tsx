import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  MessageCircle, 
  MapPin, 
  ChevronRight, 
  X, 
  ShieldCheck, 
  AlertCircle 
} from 'lucide-react';

function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function Footer() {
  const [showTerms, setShowTerms] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleCaraOrderClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === '/') {
      const el = document.getElementById('cara-order');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate('/#cara-order');
    }
  };

  return (
    <footer className="border-t-2 border-black bg-white dark:bg-[#131620] text-black dark:text-gray-100 mt-20 transition-colors">
      {/* Top 3-Column Section matching reference image */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 items-start">
          
          {/* Col 1: Brand Logo, Description, and Social Icons */}
          <div className="md:col-span-6 space-y-4">
            {/* Brand Logo & Name */}
            <div className="flex items-center gap-2.5">
              <img 
                src="/nara-logov2.png" 
                alt="Nara Premium Logo" 
                className="w-9 h-9 rounded-xl border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] shrink-0 object-contain bg-white" 
              />
              <span className="text-2xl font-black tracking-tight text-black dark:text-white">
                <span>Nara </span>
                <span className="text-brand-blue">Premium</span>
              </span>
            </div>

            {/* Description matching reference image */}
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium max-w-md">
              Platform digital andalan untuk upgrade produktivitas dan hiburanmu tanpa bikin dompet boncos. Nikmati pengalaman belanja akun premium yang 100% aman, diproses otomatis secara instan, dengan penawaran harga spesial.
            </p>

            {/* Social Icons in Neo-Brutalist circular buttons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://www.instagram.com/herama.my.id"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] flex items-center justify-center text-gray-700 dark:text-gray-200 hover:text-brand-pink hover:bg-brand-pink-soft hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer"
              >
                <InstagramIcon className="w-4 h-4" />
              </a>

              <a
                href="https://wa.me/6285750231336"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-9 h-9 rounded-full bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] flex items-center justify-center text-gray-700 dark:text-gray-200 hover:text-emerald-600 hover:bg-emerald-50 hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2: LAYANAN */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-black dark:text-white">
              LAYANAN
            </h4>
            <ul className="space-y-2.5 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300">
              <li>
                <Link 
                  to="/daftar-harga" 
                  className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors group"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
                  <span>Pricelist</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/syarat-ketentuan"
                  className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors group text-left cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
                  <span>Syarat & Ketentuan</span>
                </Link>
              </li>
              <li>
                <Link
                  to="/kebijakan-garansi"
                  className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors group text-left cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
                  <span>Kebijakan Garansi</span>
                </Link>
              </li>
              <li>
                <a 
                  href="#cara-order"
                  onClick={handleCaraOrderClick}
                  className="inline-flex items-center gap-1.5 hover:text-brand-blue transition-colors group cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-blue group-hover:translate-x-0.5 transition-all" />
                  <span>Cara Order</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: HUBUNGI KAMI */}
          <div className="md:col-span-3 space-y-4">
            <h4 className="font-black text-xs uppercase tracking-widest text-black dark:text-white">
              HUBUNGI KAMI
            </h4>
            <ul className="space-y-3 text-xs sm:text-sm font-bold text-gray-600 dark:text-gray-300">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA] shrink-0 mt-0.5" />
                <span>Kalimantan Selatan, Indonesia</span>
              </li>
              <li>
                <a 
                  href="https://wa.me/6285750231336" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 hover:text-emerald-600 transition-colors group"
                >
                  <MessageCircle className="w-4 h-4 text-[#7C3AED] dark:text-[#A78BFA] shrink-0 group-hover:text-emerald-500" />
                  <span className="font-mono font-bold">085750231336</span>
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* Bottom Copyright Bar matching reference image */}
      <div className="border-t-2 border-black dark:border-gray-800 py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <div>
            &copy; 2026 <span className="font-extrabold text-black dark:text-gray-200">Nara Premium</span>. All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            <span>Made with</span>
            <span className="text-red-500 text-sm">❤️</span>
            <span>by</span>
            <span className="font-bold text-[#7C3AED] dark:text-[#A78BFA]">Ramadani.</span>
          </div>
        </div>
      </div>

      {/* Syarat & Ketentuan Neo-Brutalist Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_#000] rounded-2xl max-w-lg w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-blue" />
                <h3 className="font-black text-lg text-black dark:text-white">Syarat & Ketentuan Layanan</h3>
              </div>
              <button
                onClick={() => setShowTerms(false)}
                className="w-8 h-8 bg-[#FAF8F5] dark:bg-[#252B3B] border-2 border-black dark:border-gray-700 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-black dark:text-white" />
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <div className="p-3 bg-brand-yellow/20 border-2 border-black dark:border-gray-700 rounded-lg flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-black dark:text-white shrink-0 mt-0.5" />
                <p className="font-medium text-xs">
                  Harap membaca ketentuan berikut sebelum melakukan pemesanan agar transaksi berjalan lancar.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-black dark:text-white">1. Garansi Produk</h4>
                <p>Seluruh akun digital bergaransi penuh selama durasi masa aktif yang dipilih. Penggantian akun dilakukan instan jika terjadi kendala login.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-black dark:text-white">2. Ketentuan Akun Sharing</h4>
                <p>Untuk paket bertipe Sharing, pembeli dilarang keras mengubah email, kata sandi, profil pengguna lain, atau metode pembayaran akun.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-black text-black dark:text-white">3. Klaim Kendala & Bantuan</h4>
                <p>Klaim bantuan dapat dilakukan 24/7 melalui nomor WhatsApp resmi kami (+62 895-0666-7156) dengan melampirkan nomor Invoice.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setShowTerms(false)}
                className="px-5 py-2 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
