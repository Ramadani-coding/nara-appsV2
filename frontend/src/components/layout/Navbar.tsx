import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Menu, X } from 'lucide-react';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  // Initialize dark mode from localStorage (defaults to light mode)
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nara_theme');
      if (saved) return saved === 'dark';
      return false;
    }
    return false;
  });

  // Sync with document element and localStorage
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('nara_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('nara_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (location.pathname !== '/') {
      window.location.href = `/#${id}`;
      return;
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#FAF8F5] border-b-2 border-black transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Left: Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <img 
                src="/nara-logov2.png" 
                alt="Nara Premium Logo" 
                className="w-10 h-10 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] object-contain group-hover:scale-105 transition-transform bg-white shrink-0" 
              />
              <div className="flex items-center font-extrabold text-xl tracking-tight text-black">
                <span>Nara</span>
                <span className="text-brand-blue ml-1">Premium</span>
              </div>
            </Link>
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center space-x-6 text-sm font-bold text-black">
            <Link to="/" className="hover:text-brand-blue transition-colors">
              Home
            </Link>
            <Link
              to="/daftar-harga"
              className="hover:text-brand-blue transition-colors"
            >
              Daftar Harga
            </Link>
            <button
              onClick={() => scrollToSection('cara-order')}
              className="hover:text-brand-pink transition-colors cursor-pointer"
            >
              Cara Order
            </button>
            <button
              onClick={() => scrollToSection('faq')}
              className="hover:text-brand-pink transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </div>

          {/* Right: Square Utility Buttons with Black Borders */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              title={isDark ? "Beralih ke Mode Terang (Light Mode)" : "Beralih ke Mode Gelap (Dark Mode)"}
              aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
              className="w-11 h-11 bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] hover:bg-brand-yellow cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all rounded-lg"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-black" />
              )}
            </button>

            {/* Mobile Menu Trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-menu"
              className="md:hidden w-11 h-11 bg-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] cursor-pointer rounded-lg active:translate-x-0.5 active:translate-y-0.5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div id="mobile-nav-menu" className="md:hidden border-t-2 border-black bg-white p-4 space-y-3 font-bold text-sm">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block p-2 hover:bg-brand-blue-soft border border-transparent hover:border-black"
          >
            Home
          </Link>
          <Link
            to="/daftar-harga"
            onClick={() => setMobileMenuOpen(false)}
            className="block p-2 hover:bg-brand-blue-soft border border-transparent hover:border-black"
          >
            Daftar Harga
          </Link>
          <button
            onClick={() => scrollToSection('cara-order')}
            className="w-full text-left p-2 hover:bg-brand-pink-soft border border-transparent hover:border-black cursor-pointer"
          >
            Cara Order
          </button>
          <button
            onClick={() => scrollToSection('faq')}
            className="w-full text-left p-2 hover:bg-brand-pink-soft border border-transparent hover:border-black cursor-pointer"
          >
            FAQ
          </button>
        </div>
      )}
    </nav>
  );
}
