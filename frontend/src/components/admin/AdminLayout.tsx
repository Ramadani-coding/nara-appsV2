import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Tag, 
  BarChart3, 
  LogOut, 
  ExternalLink, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  ShieldCheck, 
  Wallet,
  RefreshCw
} from "lucide-react";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { fetchPremkuBalance } from "../../lib/api";

export const AdminLayout: React.FC = () => {
  const { adminProfile, logout } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [isRefreshingSaldo, setIsRefreshingSaldo] = useState(false);

  // Close mobile drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Dark mode handler
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nara_theme");
      return saved === "dark";
    }
    return false;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("nara_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("nara_theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(prev => !prev);

  // Load Premku balance for topbar widget
  const loadSaldo = async () => {
    setIsRefreshingSaldo(true);
    try {
      const data = await fetchPremkuBalance();
      setSaldo(data.saldo);
    } catch {
      // keep previous
    } finally {
      setIsRefreshingSaldo(false);
    }
  };

  useEffect(() => {
    loadSaldo();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  const navItems = [
    { label: "Dashboard", path: "/admin", icon: LayoutDashboard, exact: true },
    { label: "Kelola Pesanan", path: "/admin/orders", icon: ShoppingBag },
    { label: "Produk & Margin", path: "/admin/products", icon: Tag },
    { label: "Statistik & Laporan", path: "/admin/analytics", icon: BarChart3 },
    { label: "Profil & Keamanan", path: "/admin/profile", icon: ShieldCheck },
  ];

  const isCurrentActive = (itemPath: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === itemPath;
    }
    return location.pathname.startsWith(itemPath);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] dark:bg-[#0E1016] text-black dark:text-gray-100 flex flex-col md:flex-row">
      
      {/* ========================================================
          SIDEBAR DESKTOP
         ======================================================== */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white dark:bg-[#151821] border-r-2 border-black dark:border-gray-700 min-h-screen p-5 shrink-0 justify-between">
        <div className="space-y-6">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 pb-4 border-b-2 border-black dark:border-gray-700">
            <Link to="/admin" className="flex items-center gap-2.5 focus-visible:ring-2 focus-visible:ring-brand-blue rounded-xl outline-none">
              <img 
                src="/nara-logov2.png" 
                alt="Nara Logo" 
                className="w-10 h-10 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] object-contain bg-white shrink-0" 
              />
              <div>
                <div className="font-black text-lg tracking-tight leading-none text-black dark:text-white flex items-center gap-1.5">
                  <span>Nara</span>
                  <span className="text-brand-blue">Admin</span>
                </div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-brand-pink mt-1">
                  BACK-OFFICE PORTAL
                </div>
              </div>
            </Link>
          </div>

          {/* Admin Role Badge (Clickable to Profile) */}
          <Link 
            to="/admin/profile"
            title="Kelola Profil & Kata Sandi"
            aria-label="Kelola Profil dan Kata Sandi Administrator"
            className="p-3 bg-brand-yellow/30 dark:bg-amber-950/40 hover:bg-brand-yellow/50 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer block focus-visible:ring-2 focus-visible:ring-brand-blue outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-yellow border-2 border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
              <ShieldCheck className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase text-gray-500 dark:text-gray-400">LOGIN SEBAGAI</div>
              <div className="text-xs font-black truncate text-black dark:text-white">
                {adminProfile?.email || "admin@narapremium.com"}
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-2" aria-label="Menu Utama Admin">
            <div className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 px-1 tracking-wider">
              MENU UTAMA
            </div>
            {navItems.map((item) => {
              const active = isCurrentActive(item.path, item.exact);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider border-2 transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-blue ${
                    active
                      ? "bg-brand-blue text-white border-black shadow-[3px_3px_0px_#000] dark:border-gray-700"
                      : "bg-transparent text-gray-700 dark:text-gray-300 border-transparent hover:bg-gray-100 dark:hover:bg-[#1E2333] hover:border-black dark:hover:border-gray-700"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="pt-6 border-t-2 border-black dark:border-gray-700 space-y-2.5">
          <Link
            to="/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-[#1E2333] text-black dark:text-white font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl focus-visible:ring-2 focus-visible:ring-brand-blue outline-none"
          >
            <span>Lihat Toko Publik</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500 hover:bg-red-600 text-white font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer focus-visible:ring-2 focus-visible:ring-red-400 outline-none"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar (Logout)</span>
          </button>
        </div>
      </aside>

      {/* ========================================================
          MOBILE TOPBAR
         ======================================================== */}
      <header className="md:hidden sticky top-0 z-30 bg-white dark:bg-[#151821] border-b-2 border-black dark:border-gray-700 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img 
            src="/nara-logov2.png" 
            alt="Nara Logo" 
            className="w-8 h-8 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] object-contain bg-white" 
          />
          <div className="font-black text-sm tracking-tight text-black dark:text-white">
            Nara <span className="text-brand-blue">Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
            title={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
            className="w-11 h-11 min-w-[44px] min-h-[44px] bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[2px_2px_0px_#000] rounded-xl active:translate-x-0.5 active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-blue outline-none cursor-pointer"
          >
            {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-black" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Tutup menu admin" : "Buka menu admin"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-admin-drawer"
            className="w-11 h-11 min-w-[44px] min-h-[44px] bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[2px_2px_0px_#000] rounded-xl active:translate-x-0.5 active:translate-y-0.5 focus-visible:ring-2 focus-visible:ring-brand-blue outline-none cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div 
          id="mobile-admin-drawer" 
          role="dialog"
          aria-modal="true"
          aria-label="Menu Navigasi Admin"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
        >
          <div className="bg-white dark:bg-[#151821] border-t-2 border-black dark:border-gray-700 p-5 space-y-4 max-h-[85vh] overflow-y-auto rounded-t-2xl shadow-[0px_-4px_0px_#000]">
            <div className="flex justify-between items-center pb-2 border-b-2 border-black dark:border-gray-700">
              <span className="font-black text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Menu Administrasi
              </span>
              <button 
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu admin"
                className="w-11 h-11 min-w-[44px] min-h-[44px] border-2 border-black dark:border-gray-700 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-brand-blue outline-none"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-2" aria-label="Menu Mobile Admin">
              {navItems.map((item) => {
                const active = isCurrentActive(item.path, item.exact);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl font-black text-xs uppercase tracking-wider border-2 min-h-[44px] ${
                      active
                        ? "bg-brand-blue text-white border-black shadow-[2px_2px_0px_#000] dark:border-gray-700"
                        : "border-black dark:border-gray-700 bg-gray-50 dark:bg-[#1E2333] text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-2 border-t-2 border-black dark:border-gray-700 space-y-2.5">
              <Link
                to="/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 font-black text-xs uppercase shadow-[2px_2px_0px_#000] rounded-xl min-h-[44px]"
              >
                <span>Lihat Toko Publik</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-red-500 text-white border-2 border-black dark:border-gray-700 font-black text-xs uppercase shadow-[2px_2px_0px_#000] rounded-xl min-h-[44px] cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MAIN CONTENT WRAPPER
         ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex h-16 bg-white dark:bg-[#151821] border-b-2 border-black dark:border-gray-700 px-6 sm:px-8 items-center justify-between shrink-0">
          
          {/* Breadcrumb / Page Title */}
          <div className="flex items-center gap-2 font-black text-xs tracking-wider uppercase text-gray-500 dark:text-gray-400">
            <span>NARA STORE</span>
            <span>/</span>
            <span className="text-black dark:text-white">PORTAL ADMINISTRATOR</span>
          </div>

          {/* Right Header Utilities */}
          <div className="flex items-center gap-3">
            
            {/* Live Saldo Premku Widget as Accessible Button */}
            <button 
              type="button"
              onClick={loadSaldo}
              aria-label="Perbarui saldo akun provider Premiumku"
              title="Klik untuk memperbarui saldo Premiumku"
              className="px-3.5 py-2 bg-brand-blue-soft dark:bg-[#1E293B] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl flex items-center gap-2 cursor-pointer hover:scale-102 transition-transform focus-visible:ring-2 focus-visible:ring-brand-blue outline-none"
            >
              <Wallet className="w-3.5 h-3.5 text-brand-blue" />
              <div className="text-[11px] font-mono font-black text-brand-blue">
                Saldo: Rp {saldo !== null ? saldo.toLocaleString("id-ID") : "..."}
              </div>
              <RefreshCw className={`w-3 h-3 text-gray-500 ${isRefreshingSaldo ? "animate-spin" : ""}`} />
            </button>

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              title={isDark ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap"}
              className="w-10 h-10 min-w-[40px] min-h-[40px] bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[2px_2px_0px_#000] hover:bg-brand-yellow dark:hover:bg-gray-700 transition-colors cursor-pointer rounded-xl focus-visible:ring-2 focus-visible:ring-brand-blue outline-none"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-black" />}
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

    </div>
  );
};
