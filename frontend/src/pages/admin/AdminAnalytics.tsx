import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  RefreshCw,
  Sparkles,
  Calendar,
  Coins,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { adminFetch } from "../../lib/api";

interface AvailableMonth {
  key: string;
  label: string;
  isCurrent: boolean;
}

interface PeriodMetrics {
  month: string;
  monthLabel: string;
  revenue: number;
  profit: number;
  orders: number;
  marginPercentage: number;
}

interface AllTimeMetrics {
  revenue: number;
  profit: number;
  orders: number;
  marginPercentage: number;
}

interface TopProduct {
  productId: number;
  productName: string;
  totalQuantity: number;
  totalSales: number;
  totalProfit: number;
}

interface StatsData {
  totalRevenue: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  activeProducts: number;
  totalProducts: number;
  emptyStockProducts: number;
  premkuSaldo: number;
  recentOrders: any[];
  topProducts: TopProduct[];
  allTime: AllTimeMetrics;
  selectedPeriod: PeriodMetrics;
  availableMonths: AvailableMonth[];
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const fetchStats = async (monthKey?: string) => {
    setLoading(true);
    try {
      const queryParam = monthKey ? `?month=${encodeURIComponent(monthKey)}` : "";
      const res = await adminFetch(`/admin/stats${queryParam}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setStats(json.data);
          // Sinkronisasi state selectedMonth jika belum diset
          if (!monthKey && json.data.selectedPeriod) {
            setSelectedMonth(json.data.selectedPeriod.month);
          }
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

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    fetchStats(newMonth);
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const periodProfit = stats?.selectedPeriod?.profit ?? 0;
  const periodRevenue = stats?.selectedPeriod?.revenue ?? 0;
  const periodOrders = stats?.selectedPeriod?.orders ?? 0;
  const periodMarginPercentage = stats?.selectedPeriod?.marginPercentage ?? 0;
  const avgProfitPerOrder = periodOrders > 0 ? Math.round(periodProfit / periodOrders) : 0;

  const allTimeProfit = stats?.allTime?.profit ?? 0;
  const allTimeRevenue = stats?.allTime?.revenue ?? 0;
  const allTimeOrders = stats?.allTime?.orders ?? 0;

  return (
    <div className="space-y-8 pb-16">
      
      {/* ========================================================
          PAGE HEADER & PERIOD SELECTOR
         ======================================================== */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider mb-2">
            <span>LAPORAN KEUANGAN & PROFIT MARGIN</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
            Statistik & Analitik Penjualan
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 mt-0.5">
            Laporan transparan profit bersih margin HPP, omzet kotor toko, dan akumulasi performa menyeluruh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector Dropdown */}
          <div className="relative flex items-center">
            <div className="absolute left-3 pointer-events-none text-black dark:text-gray-300">
              <Calendar className="w-4 h-4" />
            </div>
            <select
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={loading}
              className="pl-9 pr-8 py-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-50 dark:hover:bg-[#252c40] text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-blue appearance-none transition-all disabled:opacity-60"
            >
              {stats?.availableMonths?.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.isCurrent ? `Bulan Ini (${m.label})` : m.label}
                </option>
              ))}
              <option value="all">Semua Waktu (All-Time)</option>
            </select>
            <div className="absolute right-3 pointer-events-none text-black dark:text-gray-300 font-black text-xs">
              ▼
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchStats(selectedMonth)}
            disabled={loading}
            className="px-4 py-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-[#252c40] text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Auto Reset Notice Banner */}
      <div className="p-3 bg-brand-yellow/15 border-2 border-black dark:border-brand-yellow/30 rounded-xl shadow-[2px_2px_0px_#000] flex items-center gap-2 text-xs font-bold text-black dark:text-gray-200">
        <span className="p-1 bg-brand-yellow text-black border border-black rounded shadow-[1px_1px_0px_#000] shrink-0 font-black text-[10px]">
          INFO
        </span>
        <span>
          Data penjualan periode bulanan otomatis ter-reset mulai dari <strong>Rp 0</strong> setiap awal bulan (tanggal 1). Anda dapat melihat riwayat bulan lampau atau akumulasi menyeluruh melalui filter periode di atas.
        </span>
      </div>

      {/* ========================================================
          SECTION 1: METRIK PERIODE TERPILIH (BULAN INI)
         ======================================================== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-black"></span>
            <h2 className="text-sm font-black uppercase tracking-wider text-black dark:text-white">
              Performa Periode: <span className="text-brand-blue underline decoration-2 underline-offset-4">{stats?.selectedPeriod?.monthLabel || "Memuat..."}</span>
            </h2>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {periodOrders} transaksi lunas
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Profit Bersih (Margin) */}
          <div className="bg-emerald-50 dark:bg-[#122b1f] border-2 border-black dark:border-emerald-500/50 shadow-[5px_5px_0px_#000] p-5 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                PROFIT BERSIH (MARGIN)
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-400 text-black border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                <Coins className="w-4 h-4 text-black" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-200 font-mono">
              {stats ? formatRupiah(periodProfit) : "Rp 0"}
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="px-2 py-0.5 bg-emerald-300 dark:bg-emerald-700 text-emerald-950 dark:text-emerald-100 border border-black font-black text-[10px] rounded">
                +{periodMarginPercentage}% Margin
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                Keuntungan murni
              </span>
            </div>
          </div>

          {/* Card 2: Omzet Penjualan Periode */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-5 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider">
                OMZET PENJUALAN
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-blue text-white border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
              {stats ? formatRupiah(periodRevenue) : "Rp 0"}
            </div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              Total kotor pembayaran QRIS
            </p>
          </div>

          {/* Card 3: Pesanan Selesai Periode */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-5 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider">
                PESANAN SUKSES
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-yellow border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                <ShoppingBag className="w-4 h-4 text-black" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
              {stats ? `${periodOrders}` : "0"} <span className="text-sm font-bold text-gray-500">Invoice</span>
            </div>
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              <span>Status lunas & terkirim</span>
            </p>
          </div>

          {/* Card 4: Rata-Rata Profit per Pesanan */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-5 rounded-2xl space-y-2 relative overflow-hidden">
            <div className="flex justify-between items-center">
              <span className="text-xs font-black uppercase text-gray-500 tracking-wider">
                PROFIT / ORDER
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-pink text-white border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
              {stats ? formatRupiah(avgProfitPerOrder) : "Rp 0"}
            </div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              Rata-rata profit bersih tiap pesanan
            </p>
          </div>

        </div>
      </div>

      {/* ========================================================
          SECTION 2: RINGKASAN MENYELURUH (ALL-TIME OVERVIEW)
         ======================================================== */}
      <div className="bg-gradient-to-r from-gray-900 via-brand-dark to-gray-900 text-white border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_#000] p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-700 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-pink text-white font-black text-[10px] uppercase tracking-wider rounded border border-white/20 mb-1">
              <Sparkles className="w-3 h-3" />
              <span>SEMUA WAKTU (ALL-TIME)</span>
            </div>
            <h2 className="text-lg font-black uppercase tracking-wide text-white">
              Ringkasan Menyeluruh Toko
            </h2>
          </div>
          <p className="text-xs font-medium text-gray-300">
            Akumulasi total omzet kotor & profit bersih sejak toko pertama kali beroperasi
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* All-time Omzet */}
          <div className="p-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-xl space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">
              TOTAL OMZET KESELURUHAN
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {stats ? formatRupiah(allTimeRevenue) : "Rp 0"}
            </div>
            <p className="text-[11px] text-gray-400 font-medium">
              Total bruto penjualan seluruh transaksi
            </p>
          </div>

          {/* All-time Net Profit */}
          <div className="p-4 bg-emerald-500/20 backdrop-blur-sm border-2 border-emerald-400/50 rounded-xl space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                TOTAL PROFIT BERSIH KESELURUHAN
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-400 text-black font-black text-[9px] rounded">
                NET PROFIT
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
              {stats ? formatRupiah(allTimeProfit) : "Rp 0"}
            </div>
            <p className="text-[11px] text-emerald-400/90 font-medium">
              Total margin bersih keuntungan toko
            </p>
          </div>

          {/* All-time Completed Orders */}
          <div className="p-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-xl space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">
              TOTAL TRANSAKSI BERHASIL
            </span>
            <div className="text-xl sm:text-2xl font-black text-white font-mono">
              {stats ? `${allTimeOrders}` : "0"} Pesanan
            </div>
            <p className="text-[11px] text-gray-400 font-medium">
              Pesanan selesai terkirim ke pelanggan
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          SECTION 3: PRODUK TERLARIS & MARGIN KEUNTUNGAN PRODUK
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Cols: Top Selling Products with Profit */}
        <div className="lg:col-span-7 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
            <div className="space-y-0.5">
              <h2 className="text-lg font-black text-black dark:text-white uppercase tracking-wide flex items-center gap-2">
                <span>Produk Terlaris & Profit Margin</span>
                <Sparkles className="w-4 h-4 text-brand-pink fill-brand-pink" />
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Peringkat omzet dan laba bersih per produk pada periode {stats?.selectedPeriod?.monthLabel || ""}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {stats && stats.topProducts && stats.topProducts.length > 0 ? (
              stats.topProducts.map((p, idx) => (
                <div 
                  key={p.productId || idx}
                  className="p-3.5 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-brand-yellow border border-black flex items-center justify-center font-black text-xs shrink-0 text-black">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-black dark:text-white truncate">
                        {p.productName}
                      </div>
                      <div className="text-[11px] font-bold text-gray-500 flex items-center gap-2">
                        <span>Terjual: <strong>{p.totalQuantity} unit</strong></span>
                        <span>•</span>
                        <span>Omzet: {formatRupiah(p.totalSales)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap sm:border-l-2 sm:border-gray-200 sm:dark:border-gray-800 sm:pl-3">
                    <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      Profit Bersih
                    </div>
                    <div className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                      +{formatRupiah(p.totalProfit)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-gray-500 font-bold text-xs space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto text-gray-400" />
                <p>Belum ada transaksi pesanan lunas pada periode {stats?.selectedPeriod?.monthLabel || ""}.</p>
                <p className="text-[11px] text-gray-400">Data akan otomatis terisi saat pesanan baru selesai diproses.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 5 Cols: System Health & Provider Metrics */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card Kondisi Saldo & Otomasi */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 rounded-2xl space-y-4">
            <h2 className="text-sm font-black text-black dark:text-white uppercase tracking-wider border-b-2 border-black dark:border-gray-700 pb-2">
              Kondisi Saldo Provider
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

          {/* Card Ringkasan Konversi Pesanan */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 rounded-2xl space-y-4">
            <h2 className="text-sm font-black text-black dark:text-white uppercase tracking-wider border-b-2 border-black dark:border-gray-700 pb-2">
              Status Keseluruhan Pesanan
            </h2>

            <div className="space-y-2 text-xs font-bold">
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-emerald-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Selesai (Completed):
                </span>
                <span className="font-mono">{stats?.statusCounts?.completed || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-blue-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Diproses (Processing):
                </span>
                <span className="font-mono">{stats?.statusCounts?.processing || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-brand-yellow flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-yellow"></span>
                  Lunas (Paid):
                </span>
                <span className="font-mono">{stats?.statusCounts?.paid || 0}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                  Menunggu Pembayaran:
                </span>
                <span className="font-mono">{stats?.statusCounts?.waiting_payment || 0}</span>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
