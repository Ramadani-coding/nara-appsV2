import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Receipt, X } from 'lucide-react';

export function InvoiceLookup() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = query.trim().replace(/^#/, '');
    if (clean) {
      try {
        sessionStorage.removeItem(`nara_session_token_${clean}`);
        sessionStorage.removeItem(`nara_token_${clean}`);
        localStorage.removeItem(`nara_token_${clean}`);
      } catch {}
      navigate(`/invoice/${encodeURIComponent(clean)}?lookup=true`);
    }
  };

  return (
    <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_#000000] p-4 sm:p-5">
      {/* Header Label */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-yellow border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center">
            <Receipt className="w-4 h-4 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                Cek Pesanan / Lacak Invoice
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-400 rounded text-[9px] font-black uppercase shadow-[1px_1px_0px_#000]">
                2-FA Protected
              </span>
            </div>
            <p className="text-[11px] text-gray-600 font-medium">
              Masukkan Invoice untuk melihat status akun Kamu
            </p>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <form 
        onSubmit={handleSearch} 
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-grow">
          <input
            type="text"
            required
            placeholder="ORD-033*******"
            aria-label="Nomor Pesanan atau Invoice (contoh: ORD-033...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#FAF8F5] border-2 border-black py-2.5 px-3.5 text-sm font-bold text-black focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000] placeholder:text-gray-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Hapus nomor pesanan"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Search className="w-4 h-4" />
          <span>CEK INVOICE</span>
        </button>
      </form>
    </div>
  );
}
