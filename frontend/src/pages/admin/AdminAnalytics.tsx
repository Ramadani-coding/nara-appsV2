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
  AlertCircle,
  FileSpreadsheet,
  Download
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

interface MonthlyAverageMetrics {
  totalMonths: number;
  revenue: number;
  profit: number;
  orders: number;
  marginPercentage: number;
  dailyAvgRevenue?: number;
  dailyAvgProfit?: number;
  dailyAvgOrders?: number;
  daysElapsed?: number;
}

interface MonthlyBreakdownItem {
  monthKey: string;
  monthLabel: string;
  revenue: number;
  profit: number;
  orders: number;
  marginPercentage: number;
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
  monthlyAverage?: MonthlyAverageMetrics;
  monthlyBreakdown?: MonthlyBreakdownItem[];
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

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

  const handleExportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    setExportFeedback(null);

    try {
      const queryParam = selectedMonth ? `?month=${encodeURIComponent(selectedMonth)}` : "";
      const res = await adminFetch(`/admin/reports/financial/export${queryParam}`);

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || "Gagal mengunduh file laporan Excel");
      }

      const disposition = res.headers.get("Content-Disposition");
      let filename = `Laporan_Keuangan_NaraStore_${selectedMonth || "all"}.xlsx`;
      if (disposition && disposition.includes("filename=")) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      link.remove();

      const periodLabel = stats?.selectedPeriod?.monthLabel || (selectedMonth === "all" ? "Semua Waktu" : selectedMonth);
      setExportFeedback({
        type: "success",
        message: `File Excel "${filename}" (${periodLabel}) berhasil diunduh! Berisi 3 Sheet: Ringkasan Eksekutif, Analisis Profit Produk, dan Jurnal Transaksi.`,
      });

      setTimeout(() => {
        setExportFeedback(null);
      }, 7000);
    } catch (err: any) {
      console.error("Gagal mengunduh laporan Excel:", err);
      setExportFeedback({
        type: "error",
        message: err.message || "Gagal memproses file Excel laporan keuangan.",
      });
    } finally {
      setExporting(false);
    }
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
            <div className="absolute left-3 pointer-events-none text-black dark:text-gray-300" aria-hidden="true">
              <Calendar className="w-4 h-4" />
            </div>
            <select
              id="analytics-month-select"
              aria-label="Pilih periode laporan penjualan"
              value={selectedMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              disabled={loading}
              className="pl-9 pr-8 py-2.5 min-h-[44px] bg-white dark:bg-[#1E2333] hover:bg-gray-50 dark:hover:bg-[#252c40] text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue appearance-none transition-all disabled:opacity-60"
            >
              {stats?.availableMonths?.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.isCurrent ? `Bulan Ini (${m.label})` : m.label}
                </option>
              ))}
              <option value="all">Semua Waktu (All-Time)</option>
            </select>
            <div className="absolute right-3 pointer-events-none text-black dark:text-gray-300 font-black text-xs" aria-hidden="true">
              ▼
            </div>
          </div>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={exporting || loading}
            aria-label="Export data laporan keuangan dan profit margin ke Excel"
            className="px-4 py-2.5 min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#000]"
            title="Download file Excel (.xlsx) dengan 3 sheet rapi dan berformat angka"
          >
            {exporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" aria-hidden="true" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-white" aria-hidden="true" />
            )}
            <span>{exporting ? "Membuat Excel..." : "Export Excel"}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={() => fetchStats(selectedMonth)}
            disabled={loading}
            aria-label="Segarkan data analitik"
            className="px-4 py-2.5 min-h-[44px] bg-white dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-[#252c40] text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Export Feedback Banner */}
      {exportFeedback && (
        <div 
          className={`p-3.5 border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3 text-xs font-bold transition-all ${
            exportFeedback.type === "success" 
              ? "bg-emerald-50 dark:bg-[#122b1f] text-emerald-950 dark:text-emerald-200 border-black" 
              : "bg-red-50 dark:bg-[#2b1212] text-red-950 dark:text-red-200 border-black"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2.5">
            {exportFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
            )}
            <span>{exportFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            className="text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white font-black text-xs px-2 py-1 cursor-pointer"
            aria-label="Tutup notifikasi"
          >
            ✕
          </button>
        </div>
      )}

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
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-black" aria-hidden="true"></span>
            <h2 className="text-sm font-black uppercase tracking-wider text-black dark:text-white">
              Performa Periode: <span className="text-brand-blue underline decoration-2 underline-offset-4">{stats?.selectedPeriod?.monthLabel || (loading ? "Memuat..." : "Periode")}</span>
            </h2>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
            {loading && !stats ? "..." : `${periodOrders} transaksi lunas`}
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
                <Coins className="w-4 h-4 text-black" aria-hidden="true" />
              </div>
            </div>
            {loading && !stats ? (
              <div className="h-8 w-32 bg-emerald-200 dark:bg-emerald-900/60 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-200 font-mono">
                {stats ? formatRupiah(periodProfit) : "Rp 0"}
              </div>
            )}
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
                <DollarSign className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
            </div>
            {loading && !stats ? (
              <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
                {stats ? formatRupiah(periodRevenue) : "Rp 0"}
              </div>
            )}
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
                <ShoppingBag className="w-4 h-4 text-black" aria-hidden="true" />
              </div>
            </div>
            {loading && !stats ? (
              <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
                {stats ? `${periodOrders}` : "0"} <span className="text-sm font-bold text-gray-500">Invoice</span>
              </div>
            )}
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
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
                <TrendingUp className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
            </div>
            {loading && !stats ? (
              <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 animate-pulse rounded my-1" />
            ) : (
              <div className="text-2xl sm:text-3xl font-black text-black dark:text-white font-mono">
                {stats ? formatRupiah(avgProfitPerOrder) : "Rp 0"}
              </div>
            )}
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              Rata-rata profit bersih tiap pesanan
            </p>
          </div>

        </div>
      </div>

      {/* ========================================================
          SECTION: RATA-RATA PENJUALAN DALAM 1 BULAN (AVERAGE SALES)
         ======================================================== */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_#000] p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black dark:border-gray-700 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-yellow text-black font-black text-[10px] uppercase tracking-wider rounded border border-black mb-1">
              <Calendar className="w-3 h-3" aria-hidden="true" />
              <span>BENCHMARK PENJUALAN TOKO</span>
            </div>
            <h2 className="text-lg font-black uppercase tracking-wide text-black dark:text-white flex items-center gap-2">
              <span>Rata-Rata Penjualan dalam 1 Bulan</span>
            </h2>
          </div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
            Dihitung dari riwayat {stats?.monthlyAverage?.totalMonths || 1} bulan operasional toko
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Rata-Rata Omzet / Bulan */}
          <div className="p-4 bg-blue-50/70 dark:bg-blue-950/20 border-2 border-black dark:border-blue-500/40 rounded-xl space-y-1">
            <span className="text-[10px] font-black uppercase text-blue-800 dark:text-blue-300 tracking-wider">
              RATA-RATA OMZET / BULAN
            </span>
            <div className="text-xl sm:text-2xl font-black text-black dark:text-white font-mono">
              {stats?.monthlyAverage ? formatRupiah(stats.monthlyAverage.revenue) : "Rp 0"}
            </div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              Standar penjualan bruto per bulan
            </p>
          </div>

          {/* Card 2: Rata-Rata Profit Bersih / Bulan */}
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/20 border-2 border-black dark:border-emerald-500/40 rounded-xl space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider">
                RATA-RATA PROFIT / BULAN
              </span>
              <span className="px-1.5 py-0.5 bg-emerald-300 dark:bg-emerald-800 text-emerald-950 dark:text-emerald-100 font-black text-[9px] rounded">
                +{stats?.monthlyAverage?.marginPercentage || 0}%
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono">
              {stats?.monthlyAverage ? formatRupiah(stats.monthlyAverage.profit) : "Rp 0"}
            </div>
            <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              Laba bersih murni rata-rata tiap bulan
            </p>
          </div>

          {/* Card 3: Rata-Rata Pesanan / Bulan */}
          <div className="p-4 bg-amber-50/70 dark:bg-amber-950/20 border-2 border-black dark:border-amber-500/40 rounded-xl space-y-1">
            <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-300 tracking-wider">
              RATA-RATA PESANAN / BULAN
            </span>
            <div className="text-xl sm:text-2xl font-black text-black dark:text-white font-mono">
              {stats?.monthlyAverage?.orders || 0} <span className="text-xs font-bold text-gray-500">Order/Bln</span>
            </div>
            <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">
              Frekuensi pesanan sukses bulanan
            </p>
          </div>

          {/* Card 4: Rata-Rata Penjualan Harian */}
          <div className="p-4 bg-purple-50/70 dark:bg-purple-950/20 border-2 border-black dark:border-purple-500/40 rounded-xl space-y-1">
            <span className="text-[10px] font-black uppercase text-purple-800 dark:text-purple-300 tracking-wider">
              RATA-RATA OMZET / HARI
            </span>
            <div className="text-xl sm:text-2xl font-black text-purple-900 dark:text-purple-200 font-mono">
              {stats?.monthlyAverage?.dailyAvgRevenue ? formatRupiah(stats.monthlyAverage.dailyAvgRevenue) : "Rp 0"}
            </div>
            <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
              Profit harian: ~{stats?.monthlyAverage?.dailyAvgProfit ? formatRupiah(stats.monthlyAverage.dailyAvgProfit) : "Rp 0"} / hari
            </p>
          </div>

        </div>

        {/* Historis Bulanan Ringkas jika ada data bulanan */}
        {stats?.monthlyBreakdown && stats.monthlyBreakdown.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs font-black text-black dark:text-white uppercase mb-2 flex items-center gap-1.5">
              <span>Riwayat Performa Antar Bulan</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {stats.monthlyBreakdown.map((m) => (
                <div 
                  key={m.monthKey}
                  className="p-2.5 bg-gray-50 dark:bg-[#12141C] border border-black/30 dark:border-gray-700 rounded-lg flex items-center justify-between text-xs font-bold"
                >
                  <div>
                    <div className="text-black dark:text-white">{m.monthLabel}</div>
                    <div className="text-[10px] text-gray-500">{m.orders} transaksi ({m.marginPercentage}% margin)</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-emerald-600 dark:text-emerald-400">+{formatRupiah(m.profit)}</div>
                    <div className="text-[10px] text-gray-400">{formatRupiah(m.revenue)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          SECTION 2: RINGKASAN MENYELURUH (ALL-TIME OVERVIEW)
         ======================================================== */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_#000] p-6 rounded-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-700 pb-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-brand-pink text-white font-black text-[10px] uppercase tracking-wider rounded border border-white/20 mb-1">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
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
            {loading && !stats ? (
              <div className="h-7 w-32 bg-white/20 animate-pulse rounded my-1" />
            ) : (
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats ? formatRupiah(allTimeRevenue) : "Rp 0"}
              </div>
            )}
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
            {loading && !stats ? (
              <div className="h-7 w-32 bg-emerald-400/30 animate-pulse rounded my-1" />
            ) : (
              <div className="text-xl sm:text-2xl font-black text-emerald-300 font-mono">
                {stats ? formatRupiah(allTimeProfit) : "Rp 0"}
              </div>
            )}
            <p className="text-[11px] text-emerald-400/90 font-medium">
              Total margin bersih keuntungan toko
            </p>
          </div>

          {/* All-time Completed Orders */}
          <div className="p-4 bg-white/10 backdrop-blur-sm border-2 border-white/20 rounded-xl space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-300 tracking-wider">
              TOTAL TRANSAKSI BERHASIL
            </span>
            {loading && !stats ? (
              <div className="h-7 w-20 bg-white/20 animate-pulse rounded my-1" />
            ) : (
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {stats ? `${allTimeOrders}` : "0"} Pesanan
              </div>
            )}
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3 gap-3">
            <div className="space-y-0.5">
              <h2 className="text-lg font-black text-black dark:text-white uppercase tracking-wide flex items-center gap-2">
                <span>Produk Terlaris & Profit Margin</span>
                <Sparkles className="w-4 h-4 text-brand-pink fill-brand-pink" aria-hidden="true" />
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Peringkat omzet dan laba bersih per produk pada periode {stats?.selectedPeriod?.monthLabel || ""}
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-600/40 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer self-start sm:self-auto shrink-0 shadow-[1px_1px_0px_#000]"
              title="Ekspor seluruh analisis profit produk ke format Excel"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Unduh Excel</span>
            </button>
          </div>

          <div className="space-y-3">
            {loading && !stats ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="p-3.5 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-gray-300 dark:bg-gray-700" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
                    </div>
                  </div>
                  <div className="h-6 w-20 bg-gray-200 dark:bg-gray-800 rounded" />
                </div>
              ))
            ) : stats && stats.topProducts && stats.topProducts.length > 0 ? (
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
                <AlertCircle className="w-8 h-8 mx-auto text-gray-400" aria-hidden="true" />
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
                  <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true"></span>
                  Selesai (Completed):
                </span>
                <span className="font-mono">{stats?.statusCounts?.completed || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-blue-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" aria-hidden="true"></span>
                  Diproses (Processing):
                </span>
                <span className="font-mono">{stats?.statusCounts?.processing || 0}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100 dark:border-gray-800">
                <span className="text-brand-yellow flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-brand-yellow" aria-hidden="true"></span>
                  Lunas (Paid):
                </span>
                <span className="font-mono">{stats?.statusCounts?.paid || 0}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-gray-500 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-gray-400" aria-hidden="true"></span>
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
