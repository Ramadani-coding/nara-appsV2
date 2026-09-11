import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  RefreshCw,
  Sparkles
} from "lucide-react";
import { adminFetch } from "../../lib/api";

interface StatsData {
  totalRevenue: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  activeProducts: number;
  totalProducts: number;
  emptyStockProducts: number;
  premkuSaldo: number;
  recentOrders: any[];
  topProducts: Array<{
    productId: number;
    productName: string;
    totalQuantity: number;
    totalSales: number;
  }>;
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await adminFetch("/admin/stats");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data);
        }
      }
    } catch (err) {
      console.error("Error fetching analytics stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const totalCompleted = stats?.statusCounts?.completed || 0;
  const totalOrders = stats?.totalOrders || 0;
  const successRate = totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 100;

  return (
    <div className="space-y-8 pb-16">
      
      {/* ========================================================
          PAGE HEADER
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider mb-2">
            <span>LAPORAN TOKO</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
            Statistik & Analitik Penjualan
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
            Laporan lengkap konversi pembayaran QRIS, produk digital terlaris, dan pendapatan.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="px-4 py-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-100 text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* ========================================================
          TOP 3 HIGHLIGHT CARDS
         ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        
        {/* Omzet Toko */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-6 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase text-gray-500 tracking-wider">OMZET PENJUALAN</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-400 border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <DollarSign className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
            {stats ? formatRupiah(stats.totalRevenue) : "Rp 0"}
          </div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            Total penerimaan QRIS terverifikasi
          </p>
        </div>

        {/* Tingkat Keberhasilan Transaksi */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-6 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase text-gray-500 tracking-wider">COMPLETION RATE</span>
            <div className="w-8 h-8 rounded-lg bg-brand-blue text-white border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
            {successRate}%
          </div>
          <p className="text-xs font-bold text-brand-blue">
            {totalCompleted} dari {totalOrders} pesanan selesai tanpa kendala
          </p>
        </div>

        {/* Rata-Rata Nilai Pesanan (AOV) */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-6 rounded-2xl space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black uppercase text-gray-500 tracking-wider">RATA-RATA PESANAN</span>
            <div className="w-8 h-8 rounded-lg bg-brand-yellow border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <ShoppingBag className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
            {stats && stats.totalOrders > 0
              ? formatRupiah(Math.round(stats.totalRevenue / stats.totalOrders))
              : "Rp 0"}
          </div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
            Average Order Value (AOV)
          </p>
        </div>

      </div>

      {/* ========================================================
          TOP SELLING PRODUCTS SECTION
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Top Selling Products */}
        <div className="lg:col-span-7 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
            <div className="space-y-0.5">
              <h2 className="text-lg font-black text-black dark:text-white uppercase tracking-wide flex items-center gap-2">
                <span>Produk Terlaris</span>
                <Sparkles className="w-4 h-4 text-brand-pink fill-brand-pink" />
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Peringkat produk berdasarkan frekuensi pembelian pelanggan
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {stats && stats.topProducts && stats.topProducts.length > 0 ? (
              stats.topProducts.map((p, idx) => (
                <div 
                  key={p.productId || idx}
                  className="p-3.5 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-brand-yellow border border-black flex items-center justify-center font-black text-xs shrink-0 text-black">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-black dark:text-white truncate">
                        {p.productName}
                      </div>
                      <div className="text-[11px] font-bold text-gray-500">
                        Terjual: {p.totalQuantity} unit
                      </div>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap font-mono font-black text-sm text-brand-blue">
                    {formatRupiah(p.totalSales)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-gray-500 font-bold text-xs">
                Belum ada data pesanan selesai untuk membuat peringkat produk terlaris.
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: System Health & Provider Metrics */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 rounded-2xl space-y-4">
            <h2 className="text-sm font-black text-black dark:text-white uppercase tracking-wider border-b-2 border-black dark:border-gray-700 pb-2">
              Kondisi Saldo & Otomasi
            </h2>

            <div className="p-4 bg-brand-blue-soft dark:bg-[#1E293B] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl space-y-2 text-xs">
              <div className="text-[10px] font-black uppercase text-brand-blue">
                STATUS KESIAPAN AUTO-ORDER PREMKU
              </div>
              <div className="flex justify-between items-center font-bold">
                <span>Saldo Tersedia:</span>
                <span className="font-mono text-sm text-brand-blue font-black">
                  {stats ? formatRupiah(stats.premkuSaldo) : "Rp 0"}
                </span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300">
                {stats && stats.premkuSaldo < 10000 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold">
                    ⚠️ Saldo menipis. Harap lakukan topup di premku.com agar pesanan otomatis tidak gagal.
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    ✅ Saldo memadai untuk pemrosesan order instan.
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 font-bold">
                <span className="text-gray-600 dark:text-gray-400">Total Produk Katalog:</span>
                <span className="font-mono">{stats?.totalProducts || 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 font-bold">
                <span className="text-gray-600 dark:text-gray-400">Produk Aktif:</span>
                <span className="font-mono text-emerald-600">{stats?.activeProducts || 0}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-200 dark:border-gray-700 font-bold">
                <span className="text-gray-600 dark:text-gray-400">Produk Kehabisan Stok:</span>
                <span className="font-mono text-red-600">{stats?.emptyStockProducts || 0}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
