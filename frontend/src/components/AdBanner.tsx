import { useEffect } from "react";

/**
 * AdBanner Component
 * Menampilkan iklan native banner dari Adsterra sebelum footer pada seluruh halaman publik.
 * Memenuhi seluruh aturan:
 * 1. Kode adsterra ditempel apa adanya tanpa mengubah satu karakter pun
 * 2. Dibungkus slot section berlabel kecil "IKLAN"
 * 3. Ditempatkan sebelum footer (hanya di PublicLayout, tidak ada di admin)
 * 4. Memiliki min-height untuk mencegah layout shift (CLS)
 * 5. Styling Neo-Brutalist serasi tema (Light/Dark) dengan warna teks kontras tinggi
 * 6. Responsif di layar mobile hingga desktop
 */
export function AdBanner() {
  useEffect(() => {
    // Memastikan script Adsterra dieksekusi saat component di-mount dalam React SPA
    const container = document.getElementById("container-e1b5e27ca233c063dd1f95442f15e41e");
    if (container && container.childNodes.length === 0) {
      const script = document.createElement("script");
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.src = "https://bauval.org/21/e1b5e27ca233c063dd1f95442f15e41e";
      container.appendChild(script);
    }
  }, []);

  return (
    <section 
      aria-label="Iklan Sponsor" 
      className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-6 sm:mt-10 mb-2 transition-colors"
    >
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 rounded-xl sm:rounded-2xl p-3 sm:p-5 lg:p-6 shadow-[2.5px_2.5px_0px_#000] sm:shadow-[4px_4px_0px_#000] dark:shadow-[2.5px_2.5px_0px_#06080B] sm:dark:shadow-[4px_4px_0px_#06080B] transition-all">
        {/* Ad Label Header */}
        <div className="flex items-center justify-between pb-2 mb-2 sm:pb-3 sm:mb-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider bg-brand-yellow text-black border border-black rounded shadow-[1px_1px_0px_#000]">
              Iklan
            </span>
          </div>
        </div>

        {/* Adsterra Banner Slot Container with min-height */}
        <div className="w-full overflow-hidden min-h-[120px] sm:min-h-[220px] flex items-center justify-center adsterra-slot rounded-lg sm:rounded-xl">
          {/* Adsterra code placed APA ADANYA */}
          {/* @ts-expect-error verbatim adsterra code snippet */}
          <script async="async" data-cfasync="false" src="https://bauval.org/21/e1b5e27ca233c063dd1f95442f15e41e"></script>
          <div id="container-e1b5e27ca233c063dd1f95442f15e41e"></div>
        </div>
      </div>
    </section>
  );
}
