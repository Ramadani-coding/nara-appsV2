import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  DollarSign, 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Wallet, 
  ArrowRight, 
  RefreshCw, 
  Layers, 
  TrendingUp
} from "lucide-react";
import { adminFetch } from "../../lib/api";

interface AdminStats {
  totalRevenue: number;
  totalOrders: number;
  statusCounts: Record<string, number>;
  activeProducts: number;
  totalProducts: number;
  emptyStockProducts: number;
  premkuSaldo: number;
  recentOrders: any[];
  topProducts: any[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

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
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSyncProducts = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await adminFetch("/products/sync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setSyncMsg("✅ Sinkronisasi produk berhasil diselesaikan!");
        await fetchStats();
      } else {
        setSyncMsg(`❌ Gagal: ${json.message}`);
      }
    } catch (err: any) {
      setSyncMsg(`❌ Gagal koneksi: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const getStatusBadge = (status: string, order?: any) => {
    const payment = order?.payments?.[0];
    const raw = payment?.rawCallback;
    const payStatus = (payment?.status || raw?.transaction_status || "").toLowerCase();
    if (payStatus === "expire" || payStatus === "expired" || /expire/i.test(raw?.status_message || "")) {
      return (
        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded">
          Expired
        </span>
      );
    }

    switch (status) {
      case "completed":
        return (
          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded">
            Selesai
          </span>
        );
      case "paid":
        return (
          <span className="px-2 py-0.5 bg-brand-blue-soft text-brand-blue dark:bg-blue-950 dark:text-blue-300 font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded">
            Lunas
          </span>
        );
      case "processing":
        return (
          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded">
            Diproses
          </span>
        );
      case "waiting_payment":
        return (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded">
            Menunggu Bayar
          </span>
        );
      case "failed":
      default:
        return (
          <span className="px-2 py-0.5 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded">
            Gagal
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-12">
      
      {/* ========================================================
          PAGE HEADER
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-black animate-ping" />
            <span>RINGKASAN PERFORMA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
            Dashboard Administrator
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
            Pantau status pesanan, arus pendapatan, margin produk, dan stok katalog real-time.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            title="Muat ulang data statistik"
            className="px-3.5 py-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleSyncProducts}
            disabled={syncing}
            className="px-4 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
            <span>{syncing ? "Menyinkronkan..." : "Sinkronisasi Premku"}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncMsg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-brand-yellow/30 dark:bg-amber-950/40 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl font-bold text-xs"
        >
          {syncMsg}
        </motion.div>
      )}

      {/* ========================================================
          4 KEY KPI METRIC CARDS (Neo-Brutalist)
         ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        {/* Card 1: Total Pendapatan */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-5 rounded-2xl relative overflow-hidden">
          <div className="absolute -right-2 -bottom-2 w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 rounded-full -z-0 opacity-60 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
              TOTAL PENDAPATAN
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-400 border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <DollarSign className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight">
            {stats ? formatRupiah(stats.totalRevenue) : "Rp 0"}
          </div>
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Dari pesanan lunas & selesai</span>
          </p>
        </div>

        {/* Card 2: Total Pesanan */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
              TOTAL PESANAN
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-blue text-white border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight">
            {stats ? `${stats.totalOrders} Transaksi` : "0 Transaksi"}
          </div>
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1">
            {stats?.statusCounts?.completed || 0} selesai, {stats?.statusCounts?.processing || 0} diproses
          </p>
        </div>

        {/* Card 3: Saldo Premiumku API */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
              SALDO PROVIDER (PREMKU)
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-pink text-white border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <Wallet className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight">
            {stats ? formatRupiah(stats.premkuSaldo) : "Rp 0"}
          </div>
          <p className="text-[11px] font-bold text-brand-pink mt-1">
            Dana pemenuhan otomatis API
          </p>
        </div>

        {/* Card 4: Katalog Produk */}
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-5 rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider">
              PRODUK AKTIF
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-yellow border-2 border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
              <Layers className="w-4 h-4 text-black" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-black dark:text-white tracking-tight">
            {stats ? `${stats.activeProducts} / ${stats.totalProducts}` : "0"}
          </div>
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mt-1">
            {stats?.emptyStockProducts || 0} produk kehabisan stok
          </p>
        </div>

      </div>

      {/* ========================================================
          STATUS BREAKDOWN & RECENT ORDERS
         ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 8 Cols: Recent Orders Table */}
        <div className="lg:col-span-8 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-5 sm:p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
            <div className="space-y-0.5">
              <h2 className="text-base sm:text-lg font-black text-black dark:text-white uppercase tracking-wide">
                Pesanan Terbaru
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                5 transaksi paling akhir yang masuk ke sistem
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-yellow text-black font-extrabold text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl"
            >
              <span>Semua Pesanan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black dark:border-gray-700 text-gray-500 dark:text-gray-400 font-black uppercase text-[10px]">
                  <th className="py-2.5 px-2">Order #</th>
                  <th className="py-2.5 px-2">Pembeli</th>
                  <th className="py-2.5 px-2">Total</th>
                  <th className="py-2.5 px-2">Status</th>
                  <th className="py-2.5 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 font-medium">
                {stats && stats.recentOrders && stats.recentOrders.length > 0 ? (
                  stats.recentOrders.map((order: any) => (
                    <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-[#1E2333]/50">
                      <td className="py-3 px-2 font-mono font-bold text-black dark:text-white">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-bold text-black dark:text-white truncate max-w-[140px]">
                          {order.customerPhone}
                        </div>
                        <div className="text-[10px] text-gray-500 truncate max-w-[140px]">
                          {order.customerEmail || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-2 font-bold text-black dark:text-white whitespace-nowrap">
                        {formatRupiah(order.totalAmount)}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        {getStatusBadge(order.status, order)}
                      </td>
                      <td className="py-3 px-2 text-right whitespace-nowrap">
                        <Link
                          to={`/admin/orders?search=${order.orderNumber}`}
                          className="px-2.5 py-1 bg-white dark:bg-[#151821] text-black dark:text-white font-extrabold text-[10px] uppercase border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] hover:bg-brand-yellow rounded"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500 font-bold">
                      Belum ada pesanan terbaru di database.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (Visible only on mobile screens < sm) */}
          <div className="block sm:hidden space-y-3">
            {stats && stats.recentOrders && stats.recentOrders.length > 0 ? (
              stats.recentOrders.map((order: any) => (
                <div
                  key={order.id}
                  className="p-3.5 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-xs text-black dark:text-white">
                      {order.orderNumber}
                    </span>
                    {getStatusBadge(order.status, order)}
                  </div>

                  <div className="text-xs space-y-0.5">
                    <div className="font-bold text-black dark:text-white">
                      {order.customerPhone}
                    </div>
                    {order.customerEmail && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                        {order.customerEmail}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] font-black uppercase text-gray-500">Total</div>
                      <div className="font-mono font-black text-sm text-brand-blue">
                        {formatRupiah(order.totalAmount)}
                      </div>
                    </div>
                    <Link
                      to={`/admin/orders?search=${order.orderNumber}`}
                      className="px-3.5 py-1.5 bg-brand-yellow text-black font-extrabold text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-lg"
                    >
                      Buka Detail
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-gray-500 font-bold text-xs">
                Belum ada pesanan terbaru di database.
              </div>
            )}
          </div>
        </div>

        {/* Right 4 Cols: Status Distribution & Quick Links */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status Breakdown Box */}
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-5 rounded-2xl space-y-4">
            <h2 className="text-sm font-black text-black dark:text-white uppercase tracking-wider border-b-2 border-black dark:border-gray-700 pb-2">
              Distribusi Status Pesanan
            </h2>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Selesai (Completed)</span>
                  </span>
                  <span className="font-mono">{stats?.statusCounts?.completed || 0}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded border border-black dark:border-gray-700 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full" 
                    style={{ width: `${stats?.totalOrders ? ((stats.statusCounts.completed || 0) / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Diproses (Processing)</span>
                  </span>
                  <span className="font-mono">{stats?.statusCounts?.processing || 0}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded border border-black dark:border-gray-700 overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full" 
                    style={{ width: `${stats?.totalOrders ? ((stats.statusCounts.processing || 0) / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Lunas (Paid)</span>
                  </span>
                  <span className="font-mono">{stats?.statusCounts?.paid || 0}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded border border-black dark:border-gray-700 overflow-hidden">
                  <div 
                    className="bg-brand-blue h-full" 
                    style={{ width: `${stats?.totalOrders ? ((stats.statusCounts.paid || 0) / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-1">
                  <span className="flex items-center gap-1.5 text-yellow-600 dark:text-yellow-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Menunggu Bayar</span>
                  </span>
                  <span className="font-mono">{stats?.statusCounts?.waiting_payment || 0}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded border border-black dark:border-gray-700 overflow-hidden">
                  <div 
                    className="bg-yellow-400 h-full" 
                    style={{ width: `${stats?.totalOrders ? ((stats.statusCounts.waiting_payment || 0) / stats.totalOrders) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-brand-blue-soft dark:bg-[#1E293B] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] p-5 rounded-2xl space-y-3">
            <h3 className="text-xs font-black uppercase text-brand-blue tracking-wider">
              AKSES CEPAT ADMIN
            </h3>
            <div className="space-y-2">
              <Link
                to="/admin/products"
                className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-[#151821] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-bold hover:bg-brand-yellow hover:text-black transition-colors"
              >
                <span>Atur Margin Flat Produk</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                to="/admin/orders?status=processing"
                className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-[#151821] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-bold hover:bg-brand-yellow hover:text-black transition-colors"
              >
                <span>Pesanan Butuh Tindakan</span>
                <span className="px-1.5 py-0.5 bg-brand-pink text-white rounded text-[10px]">
                  {stats?.statusCounts?.processing || 0}
                </span>
              </Link>
              <Link
                to="/admin/analytics"
                className="w-full flex items-center justify-between p-2.5 bg-white dark:bg-[#151821] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-bold hover:bg-brand-yellow hover:text-black transition-colors"
              >
                <span>Laporan & Statistik</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
