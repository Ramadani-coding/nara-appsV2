import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  RefreshCw, 
  Edit3, 
  X, 
  Calculator, 
  Eye, 
  EyeOff 
} from "lucide-react";
import { API_BASE_URL, adminFetch } from "../../lib/api";
import { broadcastCatalogProductUpdate } from "../../lib/useLiveCatalog";

interface Category {
  id: number;
  name: string;
  slug: string;
}

interface Product {
  id: number;
  categoryId: number | null;
  providerServiceId: string;
  name: string;
  description: string | null;
  productType: string | null;
  providerPrice: number | null;
  marginValue: number;
  price: number;
  originalPrice: number | null;
  stockStatus: string;
  stockCount: number;
  imageUrl: string | null;
  isActive: boolean;
  category?: Category;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [syncing, setSyncing] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Modal margin state
  const [marginModalProduct, setMarginModalProduct] = useState<Product | null>(null);
  const [flatMarginInput, setFlatMarginInput] = useState<number>(0);
  const [savingMargin, setSavingMargin] = useState(false);

  // Modal edit product state
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editOriginalPrice, setEditOriginalPrice] = useState<number>(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/admin/products");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setProducts(json.data);
        }
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setToastMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/products/sync`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setToastMsg("✅ Katalog produk berhasil disinkronkan dari Premiumku! Margin Anda tetap aman.");
        await fetchProducts();
      } else {
        setToastMsg(`❌ Gagal: ${json.message}`);
      }
    } catch (err: any) {
      setToastMsg(`❌ Error: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const handleToggleActive = async (product: Product) => {
    const nextActive = !product.isActive;
    setTogglingId(product.id);

    // Update optimistik seketika
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: nextActive } : p));
    broadcastCatalogProductUpdate({ ...product, isActive: nextActive, is_active: nextActive });

    try {
      const res = await adminFetch(`/admin/products/${product.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive }),
      });
      const json = await res.json();
      if (json.success) {
        setToastMsg(
          nextActive
            ? `👁️✅ "${product.name}" DIAKTIFKAN — Sekarang muncul di katalog produk.`
            : `👁️❌ "${product.name}" DINONAKTIFKAN — Berhasil dihilangkan dari list katalog.`
        );
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        // Revert jika gagal
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: product.isActive } : p));
        broadcastCatalogProductUpdate({ ...product, isActive: product.isActive, is_active: product.isActive });
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, isActive: product.isActive } : p));
      broadcastCatalogProductUpdate({ ...product, isActive: product.isActive, is_active: product.isActive });
      alert(`Error: ${err.message}`);
    } finally {
      setTogglingId(null);
    }
  };

  const openMarginModal = (p: Product) => {
    setMarginModalProduct(p);
    setFlatMarginInput(p.marginValue || 0);
  };

  const handleSaveMargin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marginModalProduct) return;

    setSavingMargin(true);
    try {
      const res = await adminFetch(`/admin/products/${marginModalProduct.id}/margin`, {
        method: "PATCH",
        body: JSON.stringify({ marginValue: Number(flatMarginInput) }),
      });
      const json = await res.json();
      if (json.success) {
        setProducts(prev => prev.map(p => p.id === marginModalProduct.id ? json.data : p));
        broadcastCatalogProductUpdate(json.data);
        setMarginModalProduct(null);
        setToastMsg(`✅ Margin ${marginModalProduct.name} berhasil diperbarui.`);
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingMargin(false);
    }
  };

  const openEditModal = (p: Product) => {
    setEditProduct(p);
    setEditName(p.name);
    setEditDesc(p.description || "");
    setEditOriginalPrice(p.originalPrice || 0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    setSavingEdit(true);
    try {
      const res = await adminFetch(`/admin/products/${editProduct.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          originalPrice: Number(editOriginalPrice),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setProducts(prev => prev.map(p => p.id === editProduct.id ? json.data : p));
        broadcastCatalogProductUpdate(json.data);
        setEditProduct(null);
        setToastMsg(`✅ Informasi produk diperbarui.`);
        setTimeout(() => setToastMsg(null), 3500);
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Extract unique categories for filter
  const categories = Array.from(
    new Set(products.map(p => p.category?.name).filter(Boolean))
  ) as string[];

  const filteredProducts = products.filter(p => {
    const matchesCat = categoryFilter === "all" || p.category?.name === categoryFilter;
    const matchesQuery = !searchQuery.trim() || 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.providerServiceId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="space-y-6 pb-16">
      
      {/* ========================================================
          PAGE TITLE
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider mb-2">
            <span>KATALOG & PRICING</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
            Kelola Produk & Margin Flat
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
            Atur markup tetap dalam Rupiah (flat) di atas harga modal provider Premiumku.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Menyinkronkan..." : "Sinkronisasi dari Premku"}</span>
          </button>
        </div>
      </div>

      {/* Alert toast */}
      {toastMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 bg-brand-yellow/30 dark:bg-amber-950/40 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl font-bold text-xs"
        >
          {toastMsg}
        </motion.div>
      )}

      {/* Info Card: Margin Calculation Explainer */}
      <div className="p-4 bg-brand-pink-soft dark:bg-[#381E2E] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] rounded-2xl flex items-start gap-3">
        <Calculator className="w-5 h-5 text-brand-pink shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <div className="font-black uppercase tracking-wider text-black dark:text-white">
            RUMUS PERHITUNGAN HARGA JUAL (FLAT MARKUP RUPIAH):
          </div>
          <div className="font-bold text-gray-700 dark:text-gray-200">
            <span className="font-mono bg-white dark:bg-black/40 px-2 py-0.5 border border-black dark:border-gray-700 rounded">
              Harga Jual = Harga Modal Provider (Rp) + Margin Flat (Rp)
            </span>
          </div>
          <p className="text-gray-600 dark:text-gray-300">
            Margin selalu bertipe flat Rupiah (bukan persentase). Contoh: Modal Rp 500 + Margin Rp 1.500 = Harga Jual Rp 2.000.
          </p>
        </div>
      </div>

      {/* ========================================================
          FILTERS & SEARCH
         ======================================================== */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama produk atau provider ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] text-sm font-medium rounded-xl focus:outline-none focus:border-brand-blue text-black dark:text-white"
          />
        </div>

        {/* Category filter dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-black uppercase text-black dark:text-white"
        >
          <option value="all">Semua Kategori ({products.length})</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* ========================================================
          PRODUCTS - RESPONSIVE VIEWS
         ======================================================== */}
      
      {/* 1. Desktop Table View (Visible on md and larger) */}
      <div className="hidden md:block bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black dark:border-gray-700 bg-gray-50 dark:bg-[#12141C] text-gray-600 dark:text-gray-300 font-black uppercase text-[11px]">
                <th className="py-3.5 px-4">Produk</th>
                <th className="py-3.5 px-4">Kategori</th>
                <th className="py-3.5 px-4">Harga Modal (Premku)</th>
                <th className="py-3.5 px-4">Margin Flat (Rp)</th>
                <th className="py-3.5 px-4">Harga Jual Akhir</th>
                <th className="py-3.5 px-4">Stok</th>
                <th className="py-3.5 px-4">Tampil di Toko</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-200 dark:divide-gray-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-blue" />
                    <span>Memuat daftar produk...</span>
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  const basePrice = p.providerPrice ?? p.price;
                  const finalPrice = basePrice + (p.marginValue || 0);

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-[#1E2333]/40 transition-colors">
                      
                      {/* Product Name & Image */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={p.imageUrl || "/placeholder.png"} 
                            alt={p.name}
                            onError={(e: any) => { e.target.src = "/nara-logov2.png"; }}
                            className="w-10 h-10 rounded-lg border-2 border-black dark:border-gray-700 object-cover bg-gray-100 shrink-0 shadow-[1px_1px_0px_#000]"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-black dark:text-white truncate max-w-[200px]">
                              {p.name}
                            </div>
                            <div className="text-[10px] font-mono text-gray-500">
                              ID: {p.providerServiceId}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-bold text-[10px] border border-black dark:border-gray-700">
                          {p.category?.name || "Umum"}
                        </span>
                      </td>

                      {/* Provider Price (Modal) */}
                      <td className="py-3.5 px-4 font-mono font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {formatRupiah(basePrice)}
                      </td>

                      {/* Margin Flat (Rupiah) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => openMarginModal(p)}
                          className="px-2.5 py-1 bg-brand-yellow hover:bg-yellow-400 text-black font-extrabold text-xs border border-black shadow-[1.5px_1.5px_0px_#000] rounded-lg cursor-pointer flex items-center gap-1.5"
                          title="Klik untuk mengubah margin flat"
                        >
                          <span>+ {formatRupiah(p.marginValue || 0)}</span>
                          <Edit3 className="w-3 h-3" />
                        </button>
                      </td>

                      {/* Final Selling Price */}
                      <td className="py-3.5 px-4 font-black font-mono text-brand-blue text-sm whitespace-nowrap">
                        {formatRupiah(finalPrice)}
                      </td>

                      {/* Stock */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                          p.stockCount > 0
                            ? "bg-emerald-100 text-emerald-800 border-emerald-500"
                            : "bg-red-100 text-red-800 border-red-500"
                        }`}>
                          {p.stockCount > 0 ? `${p.stockCount} Tersedia` : "Habis"}
                        </span>
                      </td>

                      {/* Toggle Active */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(p)}
                          disabled={togglingId === p.id}
                          className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                            p.isActive
                              ? "bg-emerald-400 text-black hover:bg-emerald-500"
                              : "bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-600 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500"
                          }`}
                          title={p.isActive ? "Klik untuk menonaktifkan (sembunyikan dari katalog)" : "Klik untuk mengaktifkan (tampilkan di katalog)"}
                        >
                          {togglingId === p.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : p.isActive ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          )}
                          <span>{p.isActive ? "Aktif" : "Nonaktif"}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditModal(p)}
                          className="px-2.5 py-1 bg-white dark:bg-[#151821] text-black dark:text-white font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] hover:bg-brand-yellow rounded-lg cursor-pointer"
                        >
                          Sunting
                        </button>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-500 font-bold">
                    Tidak ada produk yang cocok dengan pencarian atau filter kategori.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Mobile Cards View (Visible only on mobile screens < md) */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-8 rounded-2xl text-center text-gray-500 font-bold space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-blue" />
            <div className="text-xs">Memuat daftar produk...</div>
          </div>
        ) : filteredProducts.length > 0 ? (
          filteredProducts.map((p) => {
            const basePrice = p.providerPrice ?? p.price;
            const finalPrice = basePrice + (p.marginValue || 0);

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] rounded-2xl p-4 space-y-3.5 text-black dark:text-white"
              >
                {/* Top Row: Image, Details & Toggle Visibility Button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={p.imageUrl || "/placeholder.png"} 
                      alt={p.name}
                      onError={(e: any) => { e.target.src = "/nara-logov2.png"; }}
                      className="w-12 h-12 rounded-xl border-2 border-black dark:border-gray-700 object-cover bg-gray-100 shrink-0 shadow-[1.5px_1.5px_0px_#000]"
                    />
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-black dark:text-white line-clamp-2 leading-tight">
                        {p.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded font-bold text-[10px] border border-black dark:border-gray-700">
                          {p.category?.name || "Umum"}
                        </span>
                        <span className="text-[10px] font-mono text-gray-500 truncate">
                          ID: {p.providerServiceId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Toggle Aktif / Nonaktif */}
                  <button
                    onClick={() => handleToggleActive(p)}
                    disabled={togglingId === p.id}
                    className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                      p.isActive
                        ? "bg-emerald-400 text-black hover:bg-emerald-500"
                        : "bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-600 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500"
                    }`}
                    title={p.isActive ? "Klik untuk sembunyikan dari katalog" : "Klik untuk tampilkan di katalog"}
                  >
                    {togglingId === p.id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : p.isActive ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                    )}
                    <span>{p.isActive ? "Aktif" : "Nonaktif"}</span>
                  </button>
                </div>

                {/* Pricing Box with Fast Margin Adjustment Button */}
                <div className="p-3 bg-gray-50 dark:bg-[#12141C] border border-gray-200 dark:border-gray-800 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span className="font-bold">Modal Premku:</span>
                    <span className="font-mono font-bold">{formatRupiah(basePrice)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-700 dark:text-gray-300">Margin Flat (Rp):</span>
                    <button
                      onClick={() => openMarginModal(p)}
                      className="px-2.5 py-1 bg-brand-yellow hover:bg-yellow-400 text-black font-black text-xs border border-black shadow-[1.5px_1.5px_0px_#000] rounded-lg cursor-pointer flex items-center gap-1.5"
                      title="Ubah margin flat"
                    >
                      <span>+ {formatRupiah(p.marginValue || 0)}</span>
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center font-black">
                    <span className="text-black dark:text-white uppercase text-[11px]">Harga Jual Akhir:</span>
                    <span className="font-mono text-brand-blue text-base font-black">
                      {formatRupiah(finalPrice)}
                    </span>
                  </div>
                </div>

                {/* Bottom Row: Stock Badge & Edit Button */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                    p.stockCount > 0
                      ? "bg-emerald-100 text-emerald-800 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-red-100 text-red-800 border-red-500 dark:bg-red-950 dark:text-red-300"
                  }`}>
                    {p.stockCount > 0 ? `${p.stockCount} Tersedia` : "Habis"}
                  </span>

                  <button
                    onClick={() => openEditModal(p)}
                    className="px-3.5 py-1.5 bg-white dark:bg-[#1E2333] text-black dark:text-white font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer hover:bg-brand-yellow hover:text-black flex items-center gap-1.5"
                  >
                    <span>Sunting Detail</span>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-8 rounded-2xl text-center text-gray-500 font-bold text-xs">
            Tidak ada produk yang cocok dengan pencarian atau filter kategori.
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL ATUR MARGIN FLAT RUPIAH
         ======================================================== */}
      <AnimatePresence>
        {marginModalProduct && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_#000000] rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 sm:space-y-5 text-black dark:text-white max-h-[92vh] overflow-y-auto"
            >
              
              <div className="flex justify-between items-start border-b-2 border-black dark:border-gray-700 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-lg font-black uppercase">Atur Margin Flat</h3>
                  <p className="text-xs text-gray-500 font-bold truncate max-w-[280px]">
                    {marginModalProduct.name}
                  </p>
                </div>
                <button
                  onClick={() => setMarginModalProduct(null)}
                  className="p-1 rounded-lg border border-black dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMargin} className="space-y-4">
                
                {/* Live calculation box */}
                <div className="p-4 bg-brand-blue-soft dark:bg-[#1E293B] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-gray-600 dark:text-gray-400">
                    <span>Harga Modal Provider (Premku):</span>
                    <span className="font-mono">{formatRupiah(marginModalProduct.providerPrice ?? marginModalProduct.price)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-brand-pink">
                    <span>+ Margin Flat Admin:</span>
                    <span className="font-mono">+ {formatRupiah(Number(flatMarginInput) || 0)}</span>
                  </div>
                  <div className="pt-2 border-t-2 border-black dark:border-gray-700 flex justify-between font-black text-sm text-black dark:text-white">
                    <span>= Harga Jual ke Pembeli:</span>
                    <span className="font-mono text-brand-blue text-base">
                      {formatRupiah((marginModalProduct.providerPrice ?? marginModalProduct.price) + (Number(flatMarginInput) || 0))}
                    </span>
                  </div>
                </div>

                {/* Input margin */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Besaran Margin Flat (Rupiah)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-500 font-mono">
                      Rp
                    </span>
                    <input 
                      type="number"
                      min={0}
                      step="any"
                      value={flatMarginInput}
                      onChange={(e) => setFlatMarginInput(e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value, 10) || 0))}
                      required
                      className="w-full pl-11 pr-4 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-base font-black font-mono rounded-xl focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>

                {/* Quick preset buttons */}
                <div className="space-y-1">
                  <div className="text-[10px] font-black uppercase text-gray-500">PILIHAN CEPAT (PRESET):</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1000, 2000, 3000, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setFlatMarginInput(amt)}
                        className="py-1 px-2 bg-gray-100 dark:bg-gray-800 border border-black dark:border-gray-700 rounded font-mono font-bold text-[11px] hover:bg-brand-yellow hover:text-black cursor-pointer"
                      >
                        +{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMarginModalProduct(null)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingMargin}
                    className="flex-1 py-2.5 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {savingMargin ? "Menyimpan..." : "Simpan Margin"}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================
          MODAL SUNTING INFORMASI PRODUK
         ======================================================== */}
      <AnimatePresence>
        {editProduct && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_#000000] rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 text-black dark:text-white max-h-[92vh] overflow-y-auto"
            >
              
              <div className="flex justify-between items-start border-b-2 border-black dark:border-gray-700 pb-3">
                <div>
                  <h3 className="text-lg font-black uppercase">Sunting Detail Produk</h3>
                  <p className="text-xs text-gray-500">ID Layanan Premku: {editProduct.providerServiceId}</p>
                </div>
                <button
                  onClick={() => setEditProduct(null)}
                  className="p-1 rounded-lg border border-black dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">Nama Produk</label>
                  <input 
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">Deskripsi / Garansi</label>
                  <textarea 
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">Harga Coret / Asli (Rp)</label>
                  <input 
                    type="number"
                    value={editOriginalPrice}
                    onChange={(e) => setEditOriginalPrice(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-mono font-bold"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditProduct(null)}
                    className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 text-black dark:text-white font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="flex-1 py-2.5 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                  </button>
                </div>
              </form>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
