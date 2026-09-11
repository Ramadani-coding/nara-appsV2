import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  Receipt, 
  Key, 
  Phone, 
  Mail, 
  Send,
  Copy,
  Check,
  ExternalLink
} from "lucide-react";
import { API_BASE_URL, adminFetch } from "../../lib/api";

interface ParsedDeliveryAccount {
  username?: string;
  password?: string;
  product_type?: string;
  email?: string;
}

interface ParsedDeliveryResult {
  invoice?: string;
  accounts: ParsedDeliveryAccount[];
  rawText?: string;
  isProcessing?: boolean;
  status?: string;
  message?: string;
}

function parseDeliveryContent(content: string): ParsedDeliveryResult {
  if (!content) return { accounts: [], rawText: "" };
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    if (parsed && typeof parsed === "object") {
      let accounts: ParsedDeliveryAccount[] = [];
      if (Array.isArray(parsed.accounts)) {
        accounts = parsed.accounts;
      } else if (Array.isArray(parsed)) {
        accounts = parsed;
      }
      if (accounts.length > 0) {
        return {
          invoice: parsed.invoice,
          accounts,
        };
      }
      // Jika statusnya processing atau accounts masih kosong tetapi ada invoice
      if (parsed.status === "processing" || parsed.invoice || parsed.message) {
        return {
          invoice: parsed.invoice,
          accounts: [],
          isProcessing: true,
          status: parsed.status || "processing",
          message: parsed.message || "Akun sedang diproses secara otomatis oleh sistem supplier.",
        };
      }
    }
  } catch {
    // Abaikan jika bukan JSON, lanjut ke parsing berbasis baris
  }

  if (typeof content === "string") {
    const lines = content.split("\n");
    let username = "";
    let password = "";
    for (const line of lines) {
      if (/^(username|email|user):\s*(.*)$/i.test(line)) {
        username = line.replace(/^(username|email|user):\s*/i, "").trim();
      } else if (/^(password|pass|kredensial|akses):\s*(.*)$/i.test(line)) {
        password = line.replace(/^(password|pass|kredensial|akses):\s*/i, "").trim();
      }
    }
    if (username || password) {
      return {
        accounts: [{ username, password }],
      };
    }
  }

  return {
    accounts: [],
    rawText: content,
  };
}


interface OrderItem {
  id: number;
  productName: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Payment {
  id: number;
  paymentMethod: string;
  qrCodeUrl?: string;
  status: string;
  transactionId?: string;
  rawCallback?: any;
  createdAt?: string;
  settledAt?: string | null;
}

interface FailureReasonInfo {
  category: string;
  badge: string;
  title: string;
  description: string;
  code?: string;
}

function getOrderFailureReason(order: Order): FailureReasonInfo | null {
  if (order.status !== "failed") return null;

  const payment = order.payments && order.payments.length > 0
    ? order.payments[order.payments.length - 1]
    : null;
  const raw = payment?.rawCallback;

  const payStatus = (payment?.status || raw?.transaction_status || "").toLowerCase();
  const statusCode = raw?.status_code;
  const statusMessage = raw?.status_message;

  // 1. Expired / Kadaluarsa di Midtrans
  if (payStatus === "expire" || /expire/i.test(statusMessage || "")) {
    return {
      category: "MIDTRANS_EXPIRED",
      badge: "KADALUARSA",
      title: "Batas Waktu Pembayaran Habis (QRIS Expired)",
      description: "Pelanggan tidak menyelesaikan transfer pembayaran QRIS sebelum batas waktu habis. Transaksi otomatis kadaluarsa di Midtrans dan QRIS dinonaktifkan.",
      code: statusCode || "407",
    };
  }

  // 2. Dibatalkan
  if (payStatus === "cancel" || /cancel/i.test(statusMessage || "")) {
    return {
      category: "MIDTRANS_CANCELLED",
      badge: "DIBATALKAN",
      title: "Transaksi Dibatalkan (QRIS Cancelled)",
      description: statusMessage || "Pembayaran QRIS telah dibatalkan secara sistem atau oleh pihak merchant.",
      code: statusCode || "202",
    };
  }

  // 3. Ditolak oleh Fraud / Bank
  if (payStatus === "deny" || /deny/i.test(statusMessage || "")) {
    return {
      category: "MIDTRANS_DENIED",
      badge: "DITOLAK",
      title: "Pembayaran Ditolak (Payment Denied)",
      description: statusMessage || "Transaksi ditolak oleh sistem keamanan (fraud detection) Midtrans atau pihak penerbit m-Banking/e-Wallet.",
      code: statusCode || "202",
    };
  }

  // 4. Pembayaran sudah lunas tapi kendala auto-order supplier
  if (payStatus === "settlement" || order.paidAt) {
    return {
      category: "PROVIDER_ERROR",
      badge: "KENDALA SUPPLIER",
      title: "Pembayaran Lunas, Kendala Auto-Order Supplier",
      description: "Pembayaran QRIS telah diterima dan berstatus settlement, namun auto-order ke provider supplier mengalami kendala. Silakan input akun secara manual melalui form intervensi di bawah.",
    };
  }

  // 5. Belum ada pembayaran dibuat
  if (!payment) {
    return {
      category: "NO_PAYMENT",
      badge: "TAGIHAN GAGAL",
      title: "Gagal Inisialisasi Tagihan QRIS",
      description: "Sistem tidak dapat meng-generate QRIS untuk pesanan ini atau pesanan dibatalkan sebelum kode pembayaran diterbitkan.",
    };
  }

  // 6. Default fallback
  return {
    category: "FAILED",
    badge: "GAGAL / KADALUARSA",
    title: statusMessage || "Pembayaran Tidak Berhasil / Kadaluarsa",
    description: "Transaksi pembayaran QRIS gagal diselesaikan atau telah kadaluarsa di sistem gateway pembayaran.",
    code: statusCode,
  };
}

interface Delivery {
  id: number;
  productName: string;
  content: string;
  status: string;
  deliveredAt: string;
}

interface Order {
  id: number;
  orderNumber: string;
  refId: string;
  customerPhone: string;
  customerEmail: string | null;
  status: string;
  totalAmount: number;
  createdAt: string;
  paidAt: string | null;
  completedAt: string | null;
  items: OrderItem[];
  payments: Payment[];
  deliveries: Delivery[];
}

export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get("status") || "all";
  const initialSearch = searchParams.get("search") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState(initialSearch);

  // Selected order for modal detail
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");

  // Delivery form state
  const [deliveryProduct, setDeliveryProduct] = useState("");
  const [deliveryContent, setDeliveryContent] = useState("");
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [deliverySuccessMsg, setDeliverySuccessMsg] = useState<string | null>(null);
  const [copiedDeliveryKey, setCopiedDeliveryKey] = useState<string | null>(null);
  const [syncingProvider, setSyncingProvider] = useState(false);

  const handleCopyDelivery = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDeliveryKey(key);
    setTimeout(() => setCopiedDeliveryKey(null), 2000);
  };

  const handleSyncProvider = async () => {
    if (!selectedOrder) return;
    setSyncingProvider(true);
    try {
      const res = await adminFetch(`/admin/orders/${selectedOrder.id}/sync-provider`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedOrder(json.data);
        setOrders(prev => prev.map(o => o.id === json.data.id ? json.data : o));
      } else {
        alert(json.message || "Gagal menyinkronkan status dengan supplier");
      }
    } catch (err: any) {
      alert(`Error sinkronisasi: ${err.message}`);
    } finally {
      setSyncingProvider(false);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
      const url = new URL(`${API_BASE_URL}/admin/orders`, base);
      if (statusFilter !== "all") url.searchParams.set("status", statusFilter);
      if (searchQuery.trim()) url.searchParams.set("search", searchQuery.trim());

      const res = await adminFetch(url.toString());
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setOrders(json.data);
          
          // If search param points to single order and not yet selected
          if (initialSearch && json.data.length > 0) {
            const match = json.data.find((o: Order) => o.orderNumber === initialSearch);
            if (match) openDetail(match);
          }
        }
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const openDetail = async (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setDeliveryProduct(order.items[0]?.productName || "");
    setDeliveryContent("");
    setDeliverySuccessMsg(null);

    // Otomatis sinkronkan status & akun terbaru dari server
    try {
      const res = await adminFetch(`/admin/orders/${order.id}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSelectedOrder(json.data);
          setNewStatus(json.data.status);
          setOrders(prev => prev.map(o => o.id === json.data.id ? json.data : o));
        }
      }
    } catch (e) {
      console.warn("Gagal memperbarui detail pesanan otomatis:", e);
    }
  };

  const closeDetail = () => {
    setSelectedOrder(null);
  };

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await adminFetch(`/admin/orders/${selectedOrder.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        // Update local list
        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, status: newStatus } : o));
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
        alert("Status pesanan berhasil diperbarui!");
      } else {
        alert(`Gagal: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !deliveryProduct || !deliveryContent.trim()) return;

    setSubmittingDelivery(true);
    try {
      const res = await adminFetch(`/admin/orders/${selectedOrder.id}/deliveries`, {
        method: "POST",
        body: JSON.stringify({
          productName: deliveryProduct,
          content: deliveryContent.trim(),
          status: "delivered",
        }),
      });

      const json = await res.json();
      if (json.success) {
        setDeliverySuccessMsg("Detail produk digital berhasil dikirim & pesanan otomatis diselesaikan!");
        // Refresh orders list
        await fetchOrders();
        // Update current selected order
        if (json.data) {
          setSelectedOrder(prev => prev ? {
            ...prev,
            status: "completed",
            deliveries: [...prev.deliveries, json.data],
          } : null);
        }
        setDeliveryContent("");
      } else {
        alert(`Gagal menyimpan: ${json.message}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  const tabs = [
    { key: "all", label: "Semua Pesanan" },
    { key: "waiting_payment", label: "Menunggu Bayar" },
    { key: "paid", label: "Lunas" },
    { key: "processing", label: "Diproses" },
    { key: "completed", label: "Selesai" },
    { key: "failed", label: "Gagal" },
  ];

  const getStatusBadge = (status: string, order?: Order) => {
    switch (status) {
      case "completed":
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-lg inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Selesai</span>
          </span>
        );
      case "paid":
        return (
          <span className="px-2.5 py-1 bg-brand-blue-soft text-brand-blue dark:bg-blue-950 dark:text-blue-300 font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-lg inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Lunas</span>
          </span>
        );
      case "processing":
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-lg inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Diproses</span>
          </span>
        );
      case "waiting_payment":
        return (
          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-lg inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Menunggu Bayar</span>
          </span>
        );
      case "failed":
      default: {
        const failure = order ? getOrderFailureReason(order) : null;
        return (
          <div className="inline-flex flex-col items-start gap-1">
            <span className="px-2.5 py-1 bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 font-extrabold text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-lg inline-flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              <span>{failure?.badge || "Gagal"}</span>
            </span>
            {failure && (
              <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 max-w-[150px] truncate" title={failure.title}>
                {failure.title}
              </span>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* ========================================================
          PAGE TITLE
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-yellow border-2 border-black shadow-[2px_2px_0px_#000] font-black text-xs uppercase tracking-wider mb-2">
            <span>MANAJEMEN PESANAN</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white leading-tight">
            Daftar Pesanan Pelanggan
          </h1>
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
            Periksa status QRIS, intervensi pesanan manual, dan kirimkan detail akun digital.
          </p>
        </div>

        <button
          onClick={fetchOrders}
          className="px-4 py-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-100 text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* ========================================================
          FILTER TABS & SEARCH BAR
         ======================================================== */}
      <div className="space-y-4">
        
        {/* Status Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-2 rounded-xl font-black text-xs uppercase tracking-wider border-2 whitespace-nowrap transition-all cursor-pointer ${
                statusFilter === tab.key
                  ? "bg-brand-blue text-white border-black shadow-[3px_3px_0px_#000]"
                  : "bg-white dark:bg-[#181C2A] text-gray-700 dark:text-gray-300 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] hover:bg-gray-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search input */}
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor order (mis. ORD-...), nomor WA, email, atau nama produk..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] text-sm font-medium rounded-xl focus:outline-none focus:border-brand-blue text-black dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-brand-yellow text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer shrink-0"
          >
            Cari
          </button>
        </form>
      </div>

      {/* ========================================================
          ORDERS CONTAINER (Desktop Table + Mobile Cards)
         ======================================================== */}
      
      {/* 1. Desktop Table View (Hidden on mobile < md) */}
      <div className="hidden md:block bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black dark:border-gray-700 bg-gray-50 dark:bg-[#12141C] text-gray-600 dark:text-gray-300 font-black uppercase text-[11px]">
                <th className="py-3.5 px-4">Nomor Order</th>
                <th className="py-3.5 px-4">Kontak Pelanggan</th>
                <th className="py-3.5 px-4">Produk</th>
                <th className="py-3.5 px-4">Total</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Waktu</th>
                <th className="py-3.5 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-200 dark:divide-gray-800 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-bold">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-blue" />
                    <span>Memuat daftar pesanan...</span>
                  </td>
                </tr>
              ) : orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-[#1E2333]/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-black text-black dark:text-white whitespace-nowrap">
                      {order.orderNumber}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-black dark:text-white flex items-center gap-1">
                        <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{order.customerPhone}</span>
                      </div>
                      {order.customerEmail && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate max-w-[150px]">{order.customerEmail}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-0.5">
                          <div className="font-bold text-black dark:text-white truncate max-w-[180px]">
                            {order.items[0].productName}
                          </div>
                          {order.items.length > 1 && (
                            <div className="text-[10px] font-bold text-gray-500">
                              +{order.items.length - 1} item lainnya
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-black dark:text-white whitespace-nowrap">
                      {formatRupiah(order.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getStatusBadge(order.status, order)}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono text-[11px]">
                      {new Date(order.createdAt).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => openDetail(order)}
                        className="px-3 py-1.5 bg-brand-yellow text-black font-extrabold text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-lg cursor-pointer"
                      >
                        Buka Detail
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-bold space-y-2">
                    <Receipt className="w-8 h-8 mx-auto text-gray-400" />
                    <div>Tidak ada data pesanan yang cocok dengan filter atau kata kunci.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Mobile Cards View (Visible only on mobile < md) */}
      <div className="block md:hidden space-y-4">
        {loading ? (
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-8 rounded-2xl text-center text-gray-500 font-bold space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-blue" />
            <div className="text-xs">Memuat daftar pesanan...</div>
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] rounded-2xl p-4 space-y-3 text-black dark:text-white"
            >
              {/* Header: Order Number & Status */}
              <div className="flex items-center justify-between gap-2 border-b-2 border-black dark:border-gray-700 pb-2.5">
                <div>
                  <div className="text-[10px] font-black uppercase text-gray-500">NOMOR ORDER</div>
                  <div className="font-mono font-black text-sm text-black dark:text-white">
                    {order.orderNumber}
                  </div>
                </div>
                <div>{getStatusBadge(order.status, order)}</div>
              </div>

              {/* Customer Contact */}
              <div className="bg-gray-50 dark:bg-[#12141C] p-3 rounded-xl border border-gray-200 dark:border-gray-800 space-y-1 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-black dark:text-white">
                  <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{order.customerPhone}</span>
                </div>
                {order.customerEmail && (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{order.customerEmail}</span>
                  </div>
                )}
              </div>

              {/* Order Items Preview */}
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase text-gray-500">PRODUK YANG DIBELI</div>
                {order.items && order.items.length > 0 ? (
                  <div className="p-2.5 bg-gray-50 dark:bg-[#12141C] border border-gray-200 dark:border-gray-800 rounded-xl text-xs">
                    <div className="font-bold text-black dark:text-white">
                      {order.items[0].productName}
                    </div>
                    <div className="text-[11px] text-gray-500 flex justify-between items-center mt-1">
                      <span>Jumlah: {order.items[0].quantity}x</span>
                      {order.items.length > 1 && (
                        <span className="font-bold text-brand-pink">
                          +{order.items.length - 1} item lain
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-gray-400">-</div>
                )}
              </div>

              {/* Total & Time Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800">
                <div>
                  <div className="text-[10px] font-black uppercase text-gray-500">TOTAL TAGIHAN</div>
                  <div className="font-mono font-black text-base text-brand-blue">
                    {formatRupiah(order.totalAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-black uppercase text-gray-500">WAKTU PESAN</div>
                  <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                    {new Date(order.createdAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={() => openDetail(order)}
                className="w-full py-2.5 bg-brand-yellow text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Buka Detail Pesanan</span>
              </button>
            </div>
          ))
        ) : (
          <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-8 rounded-2xl text-center text-gray-500 font-bold space-y-2 text-xs">
            <Receipt className="w-8 h-8 mx-auto text-gray-400" />
            <div>Tidak ada data pesanan yang cocok dengan filter atau kata kunci.</div>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL DETAIL PESANAN & INTERVENSI MANUAL
         ======================================================== */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[8px_8px_0px_0px_#000000] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 text-black dark:text-white"
            >
              
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b-2 border-black dark:border-gray-700 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-brand-blue" />
                    <h2 className="text-xl font-black tracking-tight uppercase">
                      Detail Pesanan
                    </h2>
                  </div>
                  <div className="font-mono text-xs font-bold text-gray-500">
                    Order ID: {selectedOrder.orderNumber} (Ref: {selectedOrder.refId})
                  </div>
                </div>

                <button
                  onClick={closeDetail}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 border-2 border-black dark:border-gray-700 flex items-center justify-center shadow-[1px_1px_0px_#000] cursor-pointer hover:bg-red-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer & Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl space-y-1.5">
                  <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    DATA PEMBELI
                  </div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>WhatsApp: {selectedOrder.customerPhone}</span>
                  </div>
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-brand-blue" />
                    <span>Email: {selectedOrder.customerEmail || "Tidak ada email"}</span>
                  </div>
                </div>

                <div className="p-3.5 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl space-y-1.5">
                  <div className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                    STATUS & WAKTU
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">Status:</span>
                    {getStatusBadge(selectedOrder.status, selectedOrder)}
                  </div>
                  <div className="text-[11px] font-mono text-gray-500">
                    Dibuat: {new Date(selectedOrder.createdAt).toLocaleString("id-ID")}
                  </div>
                </div>
              </div>

              {/* Box Detail Alasan Kegagalan Pesanan */}
              {selectedOrder.status === 'failed' && (() => {
                const failureInfo = getOrderFailureReason(selectedOrder);
                const payment = selectedOrder.payments && selectedOrder.payments.length > 0
                  ? selectedOrder.payments[selectedOrder.payments.length - 1]
                  : null;
                return (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 shadow-[3px_3px_0px_#000] rounded-xl space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-rose-200 dark:border-rose-900 pb-2">
                      <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-xs uppercase tracking-wider">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>DETAIL MASALAH & ALASAN GAGAL</span>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-600 text-white font-mono font-black text-[10px] uppercase rounded">
                        {failureInfo?.category || "FAILED"} {failureInfo?.code ? `(KODE ${failureInfo.code})` : ""}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-sm font-black text-rose-900 dark:text-rose-200">
                        {failureInfo?.title || "Transaksi Tidak Berhasil"}
                      </div>
                      <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                        {failureInfo?.description}
                      </p>
                    </div>

                    {payment && (
                      <div className="p-3 bg-white dark:bg-black/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs font-mono space-y-1.5 text-gray-800 dark:text-gray-200">
                        <div className="flex justify-between items-center py-0.5 border-b border-dashed border-gray-200 dark:border-gray-800">
                          <span className="text-gray-500 font-sans font-bold text-[11px]">Transaction ID:</span>
                          <span className="font-bold text-[11px] truncate max-w-[240px]">
                            {payment.transactionId || payment.rawCallback?.transaction_id || "-"}
                          </span>
                        </div>
                        {payment.rawCallback?.expiry_time && (
                          <div className="flex justify-between items-center py-0.5 border-b border-dashed border-gray-200 dark:border-gray-800">
                            <span className="text-gray-500 font-sans font-bold text-[11px]">Batas Waktu (Expiry Midtrans):</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                              {payment.rawCallback.expiry_time} WIB
                            </span>
                          </div>
                        )}
                        {payment.rawCallback?.status_message && (
                          <div className="flex justify-between items-center py-0.5">
                            <span className="text-gray-500 font-sans font-bold text-[11px]">Pesan Midtrans Gateway:</span>
                            <span className="font-bold text-[11px] text-gray-900 dark:text-gray-100">
                              {payment.rawCallback.status_message}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Order Items List */}
              <div className="space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Rincian Item Yang Dipesan
                </div>
                <div className="border-2 border-black dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="p-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2 bg-white dark:bg-[#151821] text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-black dark:text-white break-words">{item.productName}</div>
                        <div className="text-[11px] text-gray-500">
                          {formatRupiah(item.price)} × {item.quantity} unit
                        </div>
                      </div>
                      <div className="font-bold font-mono text-black dark:text-white sm:text-right shrink-0">
                        {formatRupiah(item.subtotal)}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-brand-yellow/20 flex justify-between items-center text-xs font-black">
                    <span>TOTAL TAGIHAN</span>
                    <span className="font-mono text-sm">{formatRupiah(selectedOrder.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Digital Delivery / Credentials Section */}
              <div className="space-y-3 pt-2 border-t-2 border-black dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-brand-pink" />
                    <span>Data Pengiriman Produk Digital (Akun / Lisensi)</span>
                  </div>
                </div>

                {/* Existing Deliveries if any */}
                {selectedOrder.deliveries && selectedOrder.deliveries.length > 0 ? (
                  <div className="space-y-3">
                    {selectedOrder.deliveries.map((del) => {
                      const parsedData = parseDeliveryContent(del.content);
                      const isProcessing = parsedData.isProcessing;

                      return (
                        <div 
                          key={del.id} 
                          className={`p-3.5 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs space-y-3 ${
                            isProcessing 
                              ? "bg-amber-50/70 dark:bg-amber-950/20" 
                              : "bg-emerald-50 dark:bg-emerald-950/40"
                          }`}
                        >
                          <div className={`font-bold flex justify-between items-center border-b pb-2 ${
                            isProcessing
                              ? "text-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900/60"
                              : "text-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60"
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm">{del.productName}</span>
                              {isProcessing && (
                                <span className="px-2 py-0.5 bg-amber-300 text-black border border-black rounded text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                  Sedang Diproses
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-gray-600 dark:text-gray-400">
                              {new Date(del.deliveredAt).toLocaleString("id-ID")}
                            </span>
                          </div>

                          {/* Jika status akun supplier masih dalam antrean / diproses */}
                          {isProcessing ? (
                            <div className="p-3 bg-white dark:bg-[#12141C] border-2 border-amber-400 dark:border-amber-600 rounded-xl space-y-3 shadow-[2px_2px_0px_#f59e0b]">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                                  </span>
                                  <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
                                    Menunggu Kredensial dari Supplier
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  disabled={syncingProvider}
                                  onClick={handleSyncProvider}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-black text-[11px] font-black uppercase rounded-lg border border-black shadow-[1px_1px_0px_#000] cursor-pointer disabled:opacity-50 transition-all active:translate-x-0.5 active:translate-y-0.5"
                                >
                                  <RefreshCw className={`w-3 h-3 ${syncingProvider ? "animate-spin" : ""}`} />
                                  <span>{syncingProvider ? "Memeriksa..." : "Cek / Sinkronkan Akun Sekarang"}</span>
                                </button>
                              </div>

                              <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                                {parsedData.message || "Akun sedang diproses secara instan oleh sistem supplier. Klik tombol sinkronisasi di atas atau refresh jika akun sudah siap."}
                              </p>

                              {parsedData.invoice && (
                                <div className="flex items-center justify-between text-[11px] font-mono bg-amber-50/60 dark:bg-black/50 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800">
                                  <span className="text-gray-600 dark:text-gray-400 font-bold">No. Ref Supplier:</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-amber-900 dark:text-amber-300">{parsedData.invoice}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyDelivery(parsedData.invoice!, `inv-${del.id}`)}
                                      className="p-1 hover:bg-amber-200 dark:hover:bg-amber-900 rounded text-amber-700 dark:text-amber-300 transition-colors"
                                      title="Salin No. Ref Supplier"
                                    >
                                      {copiedDeliveryKey === `inv-${del.id}` ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5 text-gray-500" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : parsedData.accounts.length > 0 ? (
                            <div className="space-y-2.5">
                              {/* Invoice ID supplier jika ada */}
                              {parsedData.invoice && (
                                <div className="flex items-center justify-between text-[11px] bg-white dark:bg-black/50 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                  <span className="text-gray-600 dark:text-gray-400 font-semibold">Invoice Provider:</span>
                                  <div className="flex items-center gap-1.5 font-mono">
                                    <span className="font-bold text-gray-900 dark:text-gray-100">{parsedData.invoice}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyDelivery(parsedData.invoice!, `inv-${del.id}`)}
                                      className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded text-emerald-700 dark:text-emerald-300 transition-colors"
                                      title="Salin Invoice Provider"
                                    >
                                      {copiedDeliveryKey === `inv-${del.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {parsedData.accounts.map((acc, accIdx) => {
                                const userVal = acc.username || acc.email || "";
                                const passVal = acc.password || "";
                                const copyAllText = `Email/User: ${userVal}\nPassword/Akses: ${passVal}`;
                                const urlMatch = passVal.match(/https?:\/\/[^\s]+/);

                                return (
                                  <div key={accIdx} className="bg-white dark:bg-[#12141C] border border-emerald-300 dark:border-emerald-800 rounded-lg p-3 space-y-2.5 shadow-sm">
                                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1.5">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-yellow-300 text-black border border-black rounded shadow-[1px_1px_0px_#000]">
                                          AKUN #{accIdx + 1}
                                        </span>
                                        {acc.product_type && (
                                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                                            {acc.product_type}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyDelivery(copyAllText, `all-${del.id}-${accIdx}`)}
                                        className="text-[10px] font-bold flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-emerald-100 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-700 transition-colors"
                                      >
                                        {copiedDeliveryKey === `all-${del.id}-${accIdx}` ? (
                                          <>
                                            <Check className="w-3 h-3 text-emerald-600" />
                                            <span className="text-emerald-600">Tersalin!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3" />
                                            <span>Salin Semua</span>
                                          </>
                                        )}
                                      </button>
                                    </div>

                                    {/* Email / Username field */}
                                    {userVal && (
                                      <div className="space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                          Email / Username
                                        </div>
                                        <div className="flex items-center justify-between bg-gray-50 dark:bg-black/40 p-2 rounded border border-gray-200 dark:border-gray-800 font-mono text-xs">
                                          <span className="select-all font-semibold text-gray-900 dark:text-gray-100 break-all">{userVal}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyDelivery(userVal, `user-${del.id}-${accIdx}`)}
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded ml-2 shrink-0"
                                            title="Salin Username"
                                          >
                                            {copiedDeliveryKey === `user-${del.id}-${accIdx}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                                            )}
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Password / Akses field */}
                                    {passVal && (
                                      <div className="space-y-1">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                                          Password / Akses
                                        </div>
                                        <div className="flex items-start justify-between bg-gray-50 dark:bg-black/40 p-2 rounded border border-gray-200 dark:border-gray-800 font-mono text-xs">
                                          <span className="select-all font-semibold text-emerald-700 dark:text-emerald-400 break-all whitespace-pre-wrap">{passVal}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyDelivery(passVal, `pass-${del.id}-${accIdx}`)}
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded ml-2 shrink-0 mt-0.5"
                                            title="Salin Password"
                                          >
                                            {copiedDeliveryKey === `pass-${del.id}-${accIdx}` ? (
                                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            ) : (
                                              <Copy className="w-3.5 h-3.5 text-gray-500" />
                                            )}
                                          </button>
                                        </div>
                                        {urlMatch && (
                                          <div className="pt-1">
                                            <a
                                              href={urlMatch[0]}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-900"
                                            >
                                              <ExternalLink className="w-3 h-3" />
                                              <span>Buka Tautan Akses / Email</span>
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Fallback teks manual biasa */
                            <div className="space-y-1">
                              <pre className="p-3 bg-white dark:bg-black/50 border border-emerald-300 dark:border-emerald-800 rounded-lg font-mono text-[11px] whitespace-pre-wrap break-all text-gray-900 dark:text-emerald-100">
                                {parsedData.rawText || del.content}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-medium">
                    Belum ada data lisensi/akun yang dikirimkan untuk pesanan ini.
                  </div>
                )}

                {/* Form to manual fulfill / send digital account */}
                <form onSubmit={handleAddDelivery} className="p-4 bg-gray-50 dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-xl space-y-3">
                  <div className="text-xs font-black uppercase text-gray-700 dark:text-gray-300">
                    Input Manual Detail Akun / Lisensi (Intervensi Admin)
                  </div>
                  
                  {deliverySuccessMsg && (
                    <div className="p-2 bg-emerald-100 text-emerald-800 text-xs font-bold rounded">
                      {deliverySuccessMsg}
                    </div>
                  )}

                  <div className="space-y-2">
                    <input 
                      type="text"
                      value={deliveryProduct}
                      onChange={(e) => setDeliveryProduct(e.target.value)}
                      placeholder="Nama Produk (mis. CapCut Pro 1 Bulan)"
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-[#181C2A] border border-black dark:border-gray-700 rounded-lg text-xs font-medium"
                    />
                    <textarea
                      value={deliveryContent}
                      onChange={(e) => setDeliveryContent(e.target.value)}
                      placeholder="Ketik detail akun, email:password, kode voucher, atau link akses untuk pembeli..."
                      rows={3}
                      required
                      className="w-full px-3 py-2 bg-white dark:bg-[#181C2A] border border-black dark:border-gray-700 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingDelivery}
                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingDelivery ? "Menyimpan..." : "Kirim Lisensi & Tandai Selesai"}</span>
                  </button>
                </form>
              </div>

              {/* Status Update Override */}
              <div className="pt-2 border-t-2 border-black dark:border-gray-700 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">
                  Ubah Status Pesanan Manual
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full sm:flex-1 px-3 py-2.5 bg-white dark:bg-[#12141C] border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl text-xs font-bold text-black dark:text-white"
                  >
                    <option value="waiting_payment">Menunggu Bayar (waiting_payment)</option>
                    <option value="paid">Lunas (paid)</option>
                    <option value="processing">Diproses (processing)</option>
                    <option value="completed">Selesai (completed)</option>
                    <option value="failed">Gagal (failed)</option>
                  </select>

                  <button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus || newStatus === selectedOrder.status}
                    className="w-full sm:w-auto px-5 py-2.5 bg-brand-blue text-white font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {updatingStatus ? "Menyimpan..." : "Perbarui Status"}
                  </button>
                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
