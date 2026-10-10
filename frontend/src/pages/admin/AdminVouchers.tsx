import React, { useState, useEffect, useMemo } from "react";
import { 
  Ticket, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  ShieldCheck, 
  Copy, 
  Check, 
  RefreshCw, 
  Percent, 
  X,
  Calendar
} from "lucide-react";
import { 
  fetchAdminVouchers, 
  createAdminVoucher, 
  updateAdminVoucher, 
  deleteAdminVoucher, 
  toggleAdminVoucherStatus,
  type AdminVoucher 
} from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

// Helper untuk format objek Date / ISO string ke format YYYY-MM-DD input date
// Berdasarkan zona waktu lokal browser untuk mencegah ketidaksesuaian/pergeseran tanggal
const formatLocalDateToInput = (d: Date | string): string => {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "inactive">("all");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    discountPercent: 10,
    maxDiscountAmount: "" as number | string,
    minPurchaseAmount: 0 as number | string,
    maxUsage: 50,
    startDate: formatLocalDateToInput(new Date()),
    endDate: formatLocalDateToInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    minMarginProtection: 0,
    isActive: true,
  });

  // Delete Confirm State
  const [deleteTarget, setDeleteTarget] = useState<AdminVoucher | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const notifyVoucherChange = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nara:voucher-updated"));
      if ("BroadcastChannel" in window) {
        try {
          const bc = new BroadcastChannel("nara_voucher_sync");
          bc.postMessage({ type: "VOUCHER_CHANGED" });
          bc.close();
        } catch {}
      }
    }
  };

  const loadVouchers = async (isSilent: boolean = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const data = await fetchAdminVouchers();
      setVouchers(data);
    } catch (err: any) {
      console.error("Gagal mengambil voucher:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVouchers();

    // Supabase Realtime listener untuk tabel vouchers di admin
    const channel = supabase
      .channel("realtime:admin:vouchers:table")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vouchers" },
        (payload) => {
          console.log("⚡ [Admin Vouchers Realtime]", payload.eventType);
          loadVouchers(true);
        }
      )
      .subscribe();

    // Cross-tab broadcast listener
    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("nara_voucher_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "VOUCHER_CHANGED") {
            loadVouchers(true);
          }
        };
      } catch {}
    }

    return () => {
      channel.unsubscribe();
      if (bc) bc.close();
    };
  }, []);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Status helper
  const getVoucherStatus = (v: AdminVoucher) => {
    const now = new Date();
    const end = new Date(v.endDate);
    const start = new Date(v.startDate);

    if (!v.isActive) return "inactive";
    if (now > end) return "expired";
    if (now < start) return "scheduled";
    if (v.usedCount >= v.maxUsage) return "exhausted";
    return "active";
  };

  // Filtered vouchers
  const filteredVouchers = useMemo(() => {
    return vouchers.filter((v) => {
      const status = getVoucherStatus(v);
      if (statusFilter === "active" && status !== "active") return false;
      if (statusFilter === "expired" && status !== "expired" && status !== "exhausted") return false;
      if (statusFilter === "inactive" && status !== "inactive") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          v.code.toLowerCase().includes(query) ||
          v.name.toLowerCase().includes(query) ||
          (v.description && v.description.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [vouchers, statusFilter, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = vouchers.length;
    const active = vouchers.filter((v) => getVoucherStatus(v) === "active").length;
    const totalUsed = vouchers.reduce((acc, v) => acc + (v.usedCount || 0), 0);
    const totalQuota = vouchers.reduce((acc, v) => acc + (v.maxUsage || 0), 0);
    return { total, active, totalUsed, totalQuota };
  }, [vouchers]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingId(null);
    setFormError(null);
    const now = new Date();
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    setFormData({
      code: "",
      name: "",
      description: "",
      discountPercent: 10,
      maxDiscountAmount: "",
      minPurchaseAmount: 0,
      maxUsage: 50,
      startDate: formatLocalDateToInput(now),
      endDate: formatLocalDateToInput(future),
      minMarginProtection: 0,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (v: AdminVoucher) => {
    setIsEditMode(true);
    setEditingId(v.id);
    setFormError(null);
    setFormData({
      code: v.code,
      name: v.name,
      description: v.description || "",
      discountPercent: v.discountPercent,
      maxDiscountAmount: v.maxDiscountAmount || "",
      minPurchaseAmount: v.minPurchaseAmount || 0,
      maxUsage: v.maxUsage,
      startDate: formatLocalDateToInput(v.startDate),
      endDate: formatLocalDateToInput(v.endDate),
      minMarginProtection: v.minMarginProtection || 0,
      isActive: v.isActive,
    });
    setIsModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = formData.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanCode) {
      setFormError("Kode voucher wajib diisi (hanya huruf, angka, tanda minus/underscore).");
      return;
    }

    if (!formData.name.trim()) {
      setFormError("Nama voucher wajib diisi.");
      return;
    }

    const pct = Number(formData.discountPercent);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setFormError("Persentase diskon harus di antara 1% sampai 100%.");
      return;
    }

    const maxUsageNum = Number(formData.maxUsage);
    if (isNaN(maxUsageNum) || maxUsageNum < 1) {
      setFormError("Kuota pemakaian minimal 1 kali.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setFormError("Tanggal mulai dan tanggal berakhir wajib diisi.");
      return;
    }

    const [sYear, sMonth, sDay] = formData.startDate.split("-").map(Number);
    const localStart = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);

    const [eYear, eMonth, eDay] = formData.endDate.split("-").map(Number);
    const localEnd = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

    if (localEnd <= localStart) {
      setFormError("Tanggal berakhir harus lebih lama daripada tanggal mulai voucher.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        code: cleanCode,
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        discountPercent: pct,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        minPurchaseAmount: Number(formData.minPurchaseAmount) || 0,
        maxUsage: maxUsageNum,
        startDate: localStart.toISOString(),
        endDate: localEnd.toISOString(),
        minMarginProtection: Number(formData.minMarginProtection) || 0,
        isActive: formData.isActive,
      };

      if (isEditMode && editingId) {
        await updateAdminVoucher(editingId, payload);
      } else {
        await createAdminVoucher(payload);
      }

      setIsModalOpen(false);
      notifyVoucherChange();
      await loadVouchers();
    } catch (err: any) {
      setFormError(err.message || "Gagal menyimpan voucher");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle status
  const handleToggle = async (id: number) => {
    try {
      await toggleAdminVoucherStatus(id);
      setVouchers((prev) =>
        prev.map((v) => (v.id === id ? { ...v, isActive: !v.isActive } : v))
      );
      notifyVoucherChange();
    } catch (err: any) {
      alert(err.message || "Gagal mengubah status voucher");
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteAdminVoucher(deleteTarget.id);
      setVouchers((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      notifyVoucherChange();
    } catch (err: any) {
      alert(err.message || "Gagal menghapus voucher");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 text-black dark:text-gray-100">
      
      {/* ========================================================
          TOP HEADER & STATS CARDS
         ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Ticket className="w-6 h-6 text-brand-blue" />
            <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight">
              Kelola Voucher Promo
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium mt-1">
            Setting persentase potongan harga, batas waktu tersedia, kuota pemakaian, dan proteksi margin anti-rugi.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => loadVouchers(false)}
            disabled={isLoading}
            className="p-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] rounded-xl cursor-pointer neo-btn"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] rounded-xl cursor-pointer neo-btn flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>TAMBAH VOUCHER</span>
          </button>
        </div>
      </div>

      {/* Top Statistic Chips */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
            TOTAL VOUCHER
          </div>
          <div className="text-2xl font-black text-black dark:text-white">{stats.total}</div>
          <div className="text-[11px] text-gray-500 font-semibold">Tercatat di sistem</div>
        </div>

        <div className="p-4 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            VOUCHER AKTIF
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.active}</div>
          <div className="text-[11px] text-gray-500 font-semibold">Siap dipilih pelanggan</div>
        </div>

        <div className="p-4 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-brand-blue">
            TOTAL PEMAKAIAN
          </div>
          <div className="text-2xl font-black text-brand-blue">{stats.totalUsed}x</div>
          <div className="text-[11px] text-gray-500 font-semibold">Dari {stats.totalQuota} kuota total</div>
        </div>

        <div className="p-4 bg-brand-yellow/30 dark:bg-amber-950/30 border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] rounded-2xl space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>PROTEKSI MARGIN</span>
          </div>
          <div className="text-2xl font-black text-black dark:text-white">100% AKTIF</div>
          <div className="text-[11px] text-amber-900 dark:text-amber-300 font-bold">Diskon anti-rugi modal</div>
        </div>
      </div>

      {/* ========================================================
          FILTER & SEARCH BAR
         ======================================================== */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: "all", label: "Semua" },
            { id: "active", label: "Aktif" },
            { id: "expired", label: "Kadaluarsa / Habis" },
            { id: "inactive", label: "Nonaktif" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? "bg-brand-blue text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                  : "bg-gray-100 dark:bg-[#1E2333] text-gray-600 dark:text-gray-300 hover:bg-gray-200 border border-transparent"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Cari kode atau nama voucher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 text-xs font-bold rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
          />
        </div>
      </div>

      {/* ========================================================
          VOUCHER LIST TABLE / CARDS
         ======================================================== */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_#000] rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-blue" />
            <p className="text-xs font-bold text-gray-500">Memuat data voucher promo...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <Ticket className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto" />
            <div className="font-black text-lg text-black dark:text-white">Tidak Ada Voucher Ditemukan</div>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {searchQuery ? "Tidak ada voucher yang cocok dengan pencarian Anda." : "Belum ada voucher yang dibuat. Klik tombol di atas untuk menambah voucher baru."}
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-2 px-4 py-2 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] rounded-xl neo-btn cursor-pointer"
            >
              + Tambah Voucher Baru
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black dark:border-gray-700 bg-[#FAF8F5] dark:bg-[#151923] font-black uppercase tracking-wider text-[11px] text-gray-600 dark:text-gray-400">
                  <th className="p-3.5 sm:p-4">KODE & NAMA VOUCHER</th>
                  <th className="p-3.5 sm:p-4">POTONGAN (%)</th>
                  <th className="p-3.5 sm:p-4">PERIODE KETERSEDIAAN</th>
                  <th className="p-3.5 sm:p-4">KUOTA PEMAKAIAN</th>
                  <th className="p-3.5 sm:p-4">STATUS</th>
                  <th className="p-3.5 sm:p-4 text-right">AKSI</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 dark:divide-gray-800">
                {filteredVouchers.map((v) => {
                  const status = getVoucherStatus(v);
                  const remainingQuota = Math.max(0, v.maxUsage - v.usedCount);
                  const usagePercent = Math.min(100, Math.round((v.usedCount / v.maxUsage) * 100));

                  const startDateFormatted = new Date(v.startDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                  const endDateFormatted = new Date(v.endDate).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      {/* 1. Code & Name */}
                      <td className="p-3.5 sm:p-4 min-w-[220px]">
                        <div className="flex items-start gap-2.5">
                          <div className="p-2 bg-brand-yellow/30 dark:bg-amber-950/40 border border-black dark:border-gray-700 rounded-lg shrink-0">
                            <Ticket className="w-4 h-4 text-black dark:text-amber-300" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-black text-sm text-black dark:text-white tracking-wide">
                                {v.code}
                              </span>
                              <button
                                onClick={() => copyCode(v.code)}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded cursor-pointer text-gray-500"
                                title="Salin kode"
                              >
                                {copiedCode === v.code ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="font-bold text-gray-800 dark:text-gray-200 truncate">
                              {v.name}
                            </div>
                            {v.description && (
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">
                                {v.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 2. Discount % */}
                      <td className="p-3.5 sm:p-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-pink text-white font-black text-xs rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                            <Percent className="w-3 h-3" />
                            <span>{v.discountPercent}% OFF</span>
                          </span>
                          {v.maxDiscountAmount ? (
                            <div className="text-[10px] font-bold text-gray-500 dark:text-gray-400">
                              Maks. Rp {v.maxDiscountAmount.toLocaleString("id-ID")}
                            </div>
                          ) : (
                            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Tanpa batas nominal
                            </div>
                          )}
                          {v.minPurchaseAmount > 0 && (
                            <div className="text-[10px] text-gray-500">
                              Min. belanja Rp {v.minPurchaseAmount.toLocaleString("id-ID")}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Validity Duration */}
                      <td className="p-3.5 sm:p-4 min-w-[190px]">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-gray-700 dark:text-gray-300 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                            <span>{startDateFormatted} — {endDateFormatted}</span>
                          </div>
                          {status === "expired" ? (
                            <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 block">
                              ✕ Masa berlaku telah habis
                            </span>
                          ) : status === "scheduled" ? (
                            <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 block">
                              ⏳ Dimulai pada {startDateFormatted}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block">
                              ✓ Sedang aktif tersedia
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Usage Quota */}
                      <td className="p-3.5 sm:p-4 min-w-[160px]">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="text-black dark:text-white font-mono font-black">
                              {v.usedCount} / {v.maxUsage}x
                            </span>
                            <span className="text-gray-500 text-[10px]">
                              Sisa {remainingQuota}x
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden border border-black/20">
                            <div
                              className={`h-full ${
                                usagePercent >= 100
                                  ? "bg-rose-500"
                                  : usagePercent > 70
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* 5. Status Toggle */}
                      <td className="p-3.5 sm:p-4 whitespace-nowrap">
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggle(v.id)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border border-black flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_#000] ${
                              v.isActive
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                                : "bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                v.isActive ? "bg-emerald-500" : "bg-gray-400"
                              }`}
                            />
                            <span>{v.isActive ? "AKTIF" : "NONAKTIF"}</span>
                          </button>
                        </div>
                      </td>

                      {/* 6. Actions */}
                      <td className="p-3.5 sm:p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(v)}
                            className="p-2 bg-white dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white border border-black dark:border-gray-700 shadow-[1px_1px_0px_#000] rounded-lg cursor-pointer neo-btn"
                            title="Edit Voucher"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(v)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-500 shadow-[1px_1px_0px_#000] rounded-lg cursor-pointer neo-btn"
                            title="Hapus Voucher"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================
          MODAL TAMBAH / EDIT VOUCHER
         ======================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-[#181C2A] border-4 border-black dark:border-gray-600 rounded-2xl shadow-[8px_8px_0px_#000] p-5 sm:p-6 space-y-4 my-8 text-black dark:text-white">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-brand-blue" />
                <h3 className="text-lg font-black uppercase tracking-tight">
                  {isEditMode ? "Edit Pengaturan Voucher" : "Tambah Voucher Promo Baru"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-500 rounded-xl flex items-center gap-2.5 text-xs font-bold text-rose-800 dark:text-rose-200 shadow-[2px_2px_0px_#000]">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <p>{formError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-bold">
              {/* Kode Voucher */}
              <div className="space-y-1">
                <label className="block uppercase text-[11px] font-black">
                  Kode Voucher Promo <span className="text-brand-pink">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="MISAL: HEMAT10, GAJIAN20, SPESIALNARA"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    })
                  }
                  className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl font-mono text-sm tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                />
                <p className="text-[10px] text-gray-500 font-medium">
                  Pelanggan akan memilih kode ini di halaman Konfirmasi Pesanan.
                </p>
              </div>

              {/* Nama Voucher */}
              <div className="space-y-1">
                <label className="block uppercase text-[11px] font-black">
                  Nama Voucher <span className="text-brand-pink">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misal: Promo Hemat 10% Spesial"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                />
              </div>

              {/* Deskripsi */}
              <div className="space-y-1">
                <label className="block uppercase text-[11px] font-black">
                  Deskripsi / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan singkat voucher..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                />
              </div>

              {/* Diskon % & Plafon Maks Diskon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block uppercase text-[11px] font-black">
                    Potongan Harga (%) <span className="text-brand-pink">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      required
                      min={1}
                      max={100}
                      value={formData.discountPercent}
                      onChange={(e) =>
                        setFormData({ ...formData, discountPercent: Number(e.target.value) })
                      }
                      className="w-full p-2.5 pr-8 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                    />
                    <Percent className="w-4 h-4 text-gray-500 absolute right-3 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block uppercase text-[11px] font-black">
                    Maks. Diskon (Rp, Opsional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    placeholder="Kosongkan jika bebas"
                    value={formData.maxDiscountAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, maxDiscountAmount: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                  />
                </div>
              </div>

              {/* Minimal Belanja & Kuota Pemakaian */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block uppercase text-[11px] font-black">
                    Minimal Pembelian (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.minPurchaseAmount}
                    onChange={(e) =>
                      setFormData({ ...formData, minPurchaseAmount: e.target.value })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block uppercase text-[11px] font-black">
                    Berapa Kali Boleh Dipakai <span className="text-brand-pink">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.maxUsage}
                    onChange={(e) =>
                      setFormData({ ...formData, maxUsage: Number(e.target.value) })
                    }
                    className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                  />
                  <p className="text-[10px] text-gray-500 font-medium">
                    Batas total transaksi yang dapat menggunakan voucher ini.
                  </p>
                </div>
              </div>

              {/* Berapa Lama Tersedia (Tanggal Mulai & Berakhir) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block uppercase text-[11px] font-black">
                    Tanggal Mulai Tersedia <span className="text-brand-pink">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block uppercase text-[11px] font-black">
                    Tanggal Berakhir (Expired) <span className="text-brand-pink">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full p-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000]"
                  />
                </div>
              </div>

              {/* Jaminan Proteksi Margin Note */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 rounded-xl space-y-1 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-black text-xs uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Garansi Proteksi Margin Otomatis (Anti-Rugi)</span>
                </div>
                <p className="text-[11px] text-amber-950 dark:text-amber-200 leading-relaxed font-medium">
                  Sistem otomatis menjaga harga jual setelah diskon agar tidak pernah berada di bawah modal supplier (<span className="font-mono">providerPrice</span>). Jika nominal % diskon melebihi keuntungan produk, diskon akan dibatasi aman di batas margin produk sehingga toko Anda <strong>dijamin tidak rugi</strong>.
                </p>
              </div>

              {/* Status Switch */}
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl">
                <div>
                  <div className="font-black uppercase text-xs text-black dark:text-white">
                    Aktifkan Voucher Ini Sekarang
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Jika nonaktif, voucher tidak akan ditampilkan di halaman checkout.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-5 h-5 accent-brand-blue cursor-pointer"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-white dark:bg-[#1E2333] text-black dark:text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 rounded-xl shadow-[2px_2px_0px_#000] cursor-pointer neo-btn"
                >
                  BATAL
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] cursor-pointer neo-btn flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>MENYIMPAN...</span>
                    </>
                  ) : (
                    <span>{isEditMode ? "SIMPAN PERUBAHAN" : "BUAT VOUCHER SEKARANG"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL HAPUS KONFIRMASI
         ======================================================== */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#181C2A] border-4 border-black dark:border-gray-600 rounded-2xl shadow-[8px_8px_0px_#000] p-6 space-y-4 text-center text-black dark:text-white">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-500 rounded-xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black uppercase">Hapus Voucher?</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                Apakah Anda yakin ingin menghapus voucher{" "}
                <span className="font-mono font-bold text-rose-600">{deleteTarget.code}</span>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-white dark:bg-[#1E2333] text-black dark:text-white font-black text-xs uppercase border-2 border-black dark:border-gray-700 rounded-xl shadow-[2px_2px_0px_#000] neo-btn cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] neo-btn cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus Voucher"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
