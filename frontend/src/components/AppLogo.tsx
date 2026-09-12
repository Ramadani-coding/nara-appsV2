interface AppLogoProps {
  id: string;
  className?: string;
  imageUrl?: string;
}

export function AppLogo({ id, className = "w-16 h-16", imageUrl }: AppLogoProps) {
  if (imageUrl) {
    return (
      <div className={`${className} bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 shadow-md border border-black/10 shrink-0 overflow-hidden`}>
        <img 
          src={imageUrl} 
          alt={id} 
          className="w-full h-full object-contain" 
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  switch (id) {
    case 'wink':
      return (
        <div className={`${className} bg-gradient-to-tr from-rose-500 to-pink-500 rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0 text-white font-black text-xs sm:text-base`}>
          Wink
        </div>
      );

    case 'spotify':
      return (
        <div className={`${className} bg-[#1DB954] rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0 text-black font-black text-xs sm:text-base`}>
          Spotify
        </div>
      );
    case 'alight-motion':
      return (
        <div className={`${className} bg-[#10141E] rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2.5 shadow-md relative overflow-hidden border border-black/10 shrink-0`}>
          {/* Alight motion swirl graphic */}
          <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
            <path
              d="M50 15 C 30 15, 18 32, 22 55 C 25 72, 40 85, 60 82 C 78 80, 85 62, 78 45 C 72 32, 58 35, 52 44 C 47 52, 52 62, 60 62 C 65 62, 68 58, 67 53"
              stroke="url(#am-grad)"
              strokeWidth="9"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="am-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#06B6D4" />
                <stop offset="100%" stopColor="#6366F1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      );

    case 'capcut':
      return (
        <div className={`${className} bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-1.5 sm:p-2.5 shadow-md border border-black/10 shrink-0 text-black dark:text-white`}>
          {/* CapCut bowtie shape */}
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M15 25 L45 50 L15 75 L35 75 L60 54 L60 50 L35 25 Z" fill="currentColor" />
            <path d="M85 25 L55 50 L85 75 L65 75 L40 54 L40 50 L65 25 Z" fill="currentColor" />
          </svg>
        </div>
      );

    case 'canva':
      return (
        <div className={`${className} bg-gradient-to-tr from-[#00C4CC] via-[#7D2AE8] to-[#9C27B0] rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0`}>
          <span className="font-serif italic text-white font-extrabold text-sm sm:text-2xl tracking-tighter">
            Canva
          </span>
        </div>
      );

    case 'netflix':
      return (
        <div className={`${className} bg-black rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2.5 shadow-md border border-black/10 shrink-0`}>
          <span className="text-[#E50914] font-black text-xl sm:text-4xl tracking-tighter" style={{ fontFamily: 'Impact, sans-serif' }}>
            N
          </span>
        </div>
      );

    case 'aplikasi-ai':
      return (
        <div className={`${className} bg-[#1E293B] rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 relative shrink-0`}>
          <div className="grid grid-cols-2 gap-1 p-0.5">
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-white flex items-center justify-center font-black text-black text-[8px] sm:text-xs">
              G
            </div>
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded bg-emerald-600 flex items-center justify-center font-black text-white text-[7px] sm:text-[10px]">
              AI
            </div>
          </div>
        </div>
      );

    case 'disney-plus':
      return (
        <div className={`${className} bg-gradient-to-b from-[#0F172A] to-[#1E3A8A] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0`}>
          <span className="font-serif text-white font-black text-[10px] sm:text-sm tracking-tight leading-none">Disney</span>
          <span className="text-cyan-400 font-black text-xs sm:text-lg -mt-0.5">+</span>
        </div>
      );

    case 'drama-premium':
      return (
        <div className={`${className} bg-white rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0`}>
          <div className="flex gap-0.5 items-center">
            <span className="px-0.5 py-0.2 bg-emerald-500 text-white font-black text-[7px] sm:text-[9px] rounded">iQiyi</span>
            <span className="px-0.5 py-0.2 bg-black text-white font-black text-[7px] sm:text-[9px] rounded">STV</span>
          </div>
          <div className="flex gap-0.5 items-center mt-0.5">
            <span className="text-[8px] sm:text-[10px] font-black text-amber-500">▶ WeTV</span>
          </div>
        </div>
      );

    case 'iqiyi':
      return (
        <div className={`${className} bg-[#00C234] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0 text-white font-black text-xs sm:text-base`}>
          iQIYI
        </div>
      );

    case 'viu':
      return (
        <div className={`${className} bg-[#FBBF24] rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2.5 shadow-md border border-black/10 shrink-0`}>
          <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-full border-2 sm:border-3 border-white flex items-center justify-center">
            <span className="text-white font-black text-xs sm:text-lg ml-0.5">&gt;</span>
          </div>
        </div>
      );

    case 'prime-video':
      return (
        <div className={`${className} bg-[#00A8E1] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0`}>
          <span className="text-white font-black text-[9px] sm:text-xs leading-none tracking-tight">prime</span>
          <span className="text-white font-bold text-[9px] sm:text-xs leading-none tracking-tight">video</span>
          <div className="w-5 sm:w-8 border-b sm:border-b-2 border-white rounded-full mt-0.5" />
        </div>
      );

    case 'youtube':
      return (
        <div className={`${className} bg-white rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0`}>
          <div className="w-7 h-5 sm:w-12 sm:h-8 bg-[#FF0000] rounded-md sm:rounded-xl flex items-center justify-center shadow-xs">
            <div className="w-0 h-0 border-t-3 sm:border-t-5 border-t-transparent border-b-3 sm:border-b-5 border-b-transparent border-l-5 sm:border-l-8 border-l-white ml-0.5" />
          </div>
        </div>
      );

    case 'vidio':
      return (
        <div className={`${className} bg-gradient-to-br from-[#E11D48] to-[#BE123C] rounded-xl sm:rounded-2xl flex items-center justify-center p-1 sm:p-2 shadow-md border border-black/10 shrink-0`}>
          <span className="font-black text-white text-lg sm:text-3xl italic tracking-tighter">
            V
          </span>
        </div>
      );

    case 'hma-vpn':
      return (
        <div className={`${className} bg-[#0C4A6E] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center p-0.5 sm:p-1 shadow-md border border-black/10 relative shrink-0`}>
          <span className="text-sm sm:text-2xl">🫏</span>
          <span className="px-1 py-0 bg-brand-yellow text-black font-black text-[7px] sm:text-[9px] rounded-full border border-black -mt-0.5">
            2026
          </span>
        </div>
      );

    default:
      return (
        <img 
          src="/nara-logov2.png" 
          alt="Nara Premium Logo" 
          className={`${className} object-contain rounded-xl sm:rounded-2xl shadow-md border border-black/10 bg-white shrink-0`} 
        />
      );
  }
}
