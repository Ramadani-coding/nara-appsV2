import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, ShieldAlert } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="py-12 sm:py-20 flex flex-col items-center justify-center text-center">
      {/* Decorative Neo-Brutalist Badge */}
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-brand-yellow border-2 border-black shadow-[3px_3px_0px_#000] font-black text-xs uppercase tracking-wider mb-6">
        <ShieldAlert className="w-4 h-4 text-black" />
        <span>HALAMAN TIDAK DITEMUKAN</span>
      </div>

      {/* Main 404 Headline */}
      <div className="relative mb-6">
        {/* Background tilted shadow layer */}
        <div className="absolute inset-0 bg-brand-pink border-2 border-black translate-x-2 translate-y-2 -z-10" />
        
        <div className="bg-white border-2 sm:border-4 border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000]">
          <h1 className="text-6xl sm:text-8xl lg:text-9xl font-black tracking-tighter text-black leading-none select-none">
            4<span className="text-brand-blue">0</span>4
          </h1>
        </div>
      </div>

      {/* Subtext explanation */}
      <div className="max-w-md mx-auto space-y-3 px-4 mb-8">
        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
          Ups! Jalur yang Kamu Tuju Hilang
        </h2>
        <p className="text-sm sm:text-base text-gray-700 font-medium leading-relaxed">
          Halaman atau tautan yang kamu cari tidak tersedia, sudah dipindahkan, atau alamat URL yang dimasukkan kurang tepat.
        </p>
      </div>

      {/* Action Navigation Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-lg w-full px-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-gray-100 text-black font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] neo-btn flex items-center justify-center gap-2 cursor-pointer transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>KEMBALI SEBELUMNYA</span>
        </button>

        <Link
          to="/"
          className="w-full sm:w-auto px-6 py-3.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-sm uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] neo-btn flex items-center justify-center gap-2 cursor-pointer transition-transform"
        >
          <Home className="w-4 h-4" />
          <span>BERANDA TOKO</span>
        </Link>
      </div>
    </div>
  );
}
