import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Check, 
  Copy, 
  AlertTriangle, 
  MessageCircle, 
  Key, 
  ExternalLink,
  Receipt
} from 'lucide-react';
import { getAllInvoices, findInvoice, findInvoiceAsync, type InvoiceData } from '../lib/invoiceData';

export default function MyOrders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlOrderId = searchParams.get('id');

  const allInvoices = useMemo(() => getAllInvoices(), []);
  const [liveInvoice, setLiveInvoice] = useState<InvoiceData | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (urlOrderId) {
      findInvoiceAsync(urlOrderId).then((res) => {
        if (isMounted && res) {
          setLiveInvoice(res);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [urlOrderId]);

  // Tampilkan pesanan HANYA jika ada ID di URL atau ada pesanan tersimpan di perangkat pengguna
  const activeInvoice: InvoiceData | undefined = useMemo(() => {
    if (liveInvoice) return liveInvoice;
    if (urlOrderId) {
      const match = findInvoice(urlOrderId);
      if (match) return match;
    }
    // Hanya ambil pesanan riil milik pembeli, jangan fallback ke invoice contoh statis
    return allInvoices.find(inv => !['#20260309165713URQE', 'ORD-892147', 'ORD-761230'].includes(inv.id));
  }, [allInvoices, urlOrderId, liveInvoice]);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6 pb-20 text-black dark:text-gray-100"
    >
      {/* Top Header Bar: Responsive anti-overlap */}
      <div className="flex items-center justify-between gap-2">
        <button 
          onClick={() => navigate('/#categories-filter')}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-[#1E2333] text-black dark:text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn cursor-pointer rounded-xl shrink-0"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>KEMBALI</span>
          <span className="hidden sm:inline">KE KATALOG</span>
        </button>

        <span className="text-[10px] sm:text-[11px] font-black uppercase text-gray-500 dark:text-gray-400 tracking-wider text-right shrink-0">
          STATUS PESANAN RESMI
        </span>
      </div>

      {/* If no invoice found */}
      {!activeInvoice ? (
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-8 text-center space-y-4 rounded-2xl">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 border-2 border-black dark:border-gray-700 rounded-xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
            <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-black text-black dark:text-white">Pesanan Belum Ditemukan</h2>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            Data pesanan tidak ditemukan atau belum ada pesanan yang dibuat.
          </p>
          <button
            onClick={() => navigate('/#categories-filter')}
            className="px-5 py-2 bg-brand-blue text-white font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer"
          >
            Lihat Katalog Produk
          </button>
        </div>
      ) : (
        /* ========================================================
            INVOICE CARD (Identical to InvoiceDetail.tsx - ONLY this order)
           ======================================================== */
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] rounded-2xl overflow-hidden">
          
          {/* Top Gradient Accent Bar */}
          <div className="h-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-brand-pink" />

          <div className="p-4 sm:p-8 space-y-5 sm:space-y-6">
            
            {/* Header: Title & Status Badge */}
            <div className="flex items-start justify-between border-b-2 border-black dark:border-gray-700 pb-4 gap-2">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-brand-blue shrink-0" />
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-black dark:text-white tracking-tight">
                    Invoice
                  </h1>
                </div>
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  <span className="text-xs font-black text-gray-500 dark:text-gray-400 font-mono">
                    ID: {activeInvoice.id}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(activeInvoice.id, 'invoice-id')}
                    className="text-[10px] font-bold text-brand-blue hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedKey === 'invoice-id' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-bold">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Badge */}
              {activeInvoice.status === 'KADALUARSA' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-2 border-black dark:border-rose-600 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                    PEMBAYARAN KADALUARSA
                  </span>
                </div>
              ) : activeInvoice.status === 'MENUNGGU' ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-2 border-black dark:border-amber-600 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                    MENUNGGU PEMBAYARAN
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-2 border-black dark:border-gray-700 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                    {activeInvoice.status}
                  </span>
                </div>
              )}
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 p-3.5 sm:p-5 rounded-xl space-y-3.5 sm:space-y-4 shadow-[2px_2px_0px_#000]">
              {/* Item Row: Mobile friendly stacking to prevent squeezed text */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
                <div className="min-w-0">
                  <h2 className="font-black text-sm sm:text-base text-black dark:text-white leading-snug">
                    {activeInvoice.productName}
                  </h2>
                  <span className="inline-block mt-1 text-[10px] sm:text-[11px] font-black px-2 py-0.5 bg-white dark:bg-[#151923] text-black dark:text-white border border-black dark:border-gray-700 rounded shadow-[1px_1px_0px_#000]">
                    Qty: {activeInvoice.qty}x
                  </span>
                </div>
                <div className="text-sm sm:text-base font-black text-black dark:text-white sm:text-right whitespace-nowrap">
                  Rp {activeInvoice.unitPrice.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-3 space-y-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                {/* Subtotal */}
                <div className="flex justify-between items-center">
                  <span>Subtotal</span>
                  <span className="text-black dark:text-white font-bold whitespace-nowrap">
                    Rp {activeInvoice.subtotal.toLocaleString('id-ID')}
                  </span>
                </div>

                {/* Discount if applicable */}
                {activeInvoice.discount > 0 && (
                  <div className="flex justify-between items-center p-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded text-emerald-800 dark:text-emerald-300">
                    <span>{activeInvoice.discountLabel || 'Diskon'}</span>
                    <span className="font-black whitespace-nowrap">
                      -Rp {activeInvoice.discount.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}

                {/* Unique Code */}
                {activeInvoice.uniqueCode > 0 && (
                  <div className="flex justify-between items-center">
                    <span>Kode Unik</span>
                    <span className="text-black dark:text-white font-bold whitespace-nowrap">
                      Rp {activeInvoice.uniqueCode.toLocaleString('id-ID')}
                    </span>
                  </div>
                )}
              </div>

              {/* Total Bayar: Unbreakable price on mobile */}
              <div className="border-t-2 border-black dark:border-gray-700 pt-3 flex items-baseline justify-between gap-2 flex-wrap sm:flex-nowrap">
                <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-black dark:text-white shrink-0">
                  TOTAL BAYAR
                </span>
                <span className="text-xl sm:text-2xl md:text-3xl font-black text-brand-blue whitespace-nowrap">
                  Rp {activeInvoice.total.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Detail Akun Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-purple-100 dark:bg-purple-950/60 border-2 border-black dark:border-gray-700 rounded-lg flex items-center justify-center shadow-[1.5px_1.5px_0px_#000] shrink-0">
                  <Key className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                </div>
                <h3 className="font-black text-sm sm:text-base text-black dark:text-white">
                  Detail Akun Anda
                </h3>
              </div>

              {/* Account Cards */}
              {activeInvoice.accounts.map((acc, idx) => (
                <div 
                  key={idx}
                  className="bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 p-3.5 sm:p-4 space-y-3 rounded-xl shadow-[3px_3px_0px_#000]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-dashed border-gray-300 dark:border-gray-700 pb-2">
                    <span className="text-xs font-black uppercase text-black dark:text-white">
                      {acc.title}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-black dark:border-gray-700 rounded uppercase max-w-full truncate">
                      {acc.packageBadge}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Email / Username Field */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        EMAIL / USERNAME
                      </label>
                      <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] dark:bg-[#151923] border-2 border-black dark:border-gray-700 text-xs font-mono font-bold text-black dark:text-white shadow-[1.5px_1.5px_0px_#000] rounded-lg gap-2">
                        <span className="break-all line-clamp-2 min-w-0 leading-tight mr-1">{acc.emailOrUsername}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(acc.emailOrUsername, `email-${idx}`)}
                          title="Salin Email/Username"
                          className="text-gray-600 dark:text-gray-300 hover:text-brand-blue shrink-0 p-1 cursor-pointer"
                        >
                          {copiedKey === `email-${idx}` ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Password Field */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                        PASSWORD / KREDENSIAL
                      </label>
                      <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] dark:bg-[#151923] border-2 border-black dark:border-gray-700 text-xs font-mono font-bold text-black dark:text-white shadow-[1.5px_1.5px_0px_#000] rounded-lg gap-2">
                        <span className="break-all line-clamp-2 min-w-0 leading-tight mr-1">{acc.passwordOrCode}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(acc.passwordOrCode, `pass-${idx}`)}
                          title="Salin Password/Kredensial"
                          className="text-gray-600 dark:text-gray-300 hover:text-brand-blue shrink-0 p-1 cursor-pointer"
                        >
                          {copiedKey === `pass-${idx}` ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Warning Card */}
              {activeInvoice.warningNotice && (
                <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border-2 border-black dark:border-gray-700 flex items-start gap-2.5 rounded-xl shadow-[2px_2px_0px_#000]">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-black dark:text-gray-200">
                    <strong className="font-black text-amber-800 dark:text-amber-300 block mb-0.5">PERHATIAN!</strong>
                    <span className="font-medium text-gray-700 dark:text-gray-300 leading-relaxed">{activeInvoice.warningNotice}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Need Help Footer with WhatsApp CTA */}
            <div className="text-center pt-2 space-y-2 border-t-2 border-black dark:border-gray-700">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 block">
                BUTUH BANTUAN?
              </span>
              <a
                href={`https://wa.me/6285750231336?text=Halo%20Admin%20Nara%20Premium,%20saya%20butuh%20bantuan%20terkait%20Invoice%20${encodeURIComponent(activeInvoice.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-black hover:bg-gray-800 text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn rounded-xl transition-all"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Hubungi Admin</span>
                <ExternalLink className="w-3 h-3 text-gray-400 ml-1 shrink-0" />
              </a>
            </div>

          </div>
        </div>
      )}
    </motion.div>
  );
}
