import React from 'react';
import { 
  Receipt, 
  Check, 
  Copy, 
  AlertTriangle, 
  Clock, 
  Loader2, 
  Key, 
  ShieldCheck, 
  Lock, 
  ArrowLeft, 
  Phone, 
  ExternalLink, 
  MessageCircle 
} from 'lucide-react';
import { type InvoiceData, type InvoiceAccount } from '../lib/invoiceData';

export interface OrderInvoiceCardProps {
  invoice: InvoiceData;
  copiedKey: string | null;
  copyToClipboard: (text: string, key: string) => void;
  copyAllAccounts?: () => void;
  handleRelock?: () => void;
  verifyPhoneInput?: string;
  setVerifyPhoneInput?: (val: string) => void;
  handleVerifyPhone?: (e: React.FormEvent) => void;
  isVerifyingPhone?: boolean;
  verifyError?: string | null;
  onNavigatePayment?: () => void;
  onNavigateCatalog?: () => void;
}

export const OrderInvoiceCard: React.FC<OrderInvoiceCardProps> = ({
  invoice,
  copiedKey,
  copyToClipboard,
  copyAllAccounts,
  handleRelock,
  verifyPhoneInput,
  setVerifyPhoneInput,
  handleVerifyPhone,
  isVerifyingPhone,
  verifyError,
  onNavigatePayment,
  onNavigateCatalog,
}) => {
  const copySingleAccount = (acc: InvoiceAccount, idx: number) => {
    const text = `PRODUK: ${acc.title} (${acc.packageBadge})\nEMAIL/USER: ${acc.emailOrUsername}\nPASSWORD: ${acc.passwordOrCode}`;
    copyToClipboard(text, `single-${idx}`);
  };

  return (
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
                ID: {invoice.id}
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(invoice.id, 'invoice-id')}
                aria-label="Salin nomor invoice"
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
          {invoice.status === 'KADALUARSA' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-2 border-black dark:border-rose-600 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 shrink-0" />
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                PEMBAYARAN KADALUARSA
              </span>
            </div>
          ) : invoice.status === 'MENUNGGU' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-2 border-black dark:border-amber-600 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
              <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                MENUNGGU PEMBAYARAN
              </span>
            </div>
          ) : invoice.status === 'DIPROSES' || invoice.isDeliveryPending ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border-2 border-black dark:border-blue-600 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue shrink-0" />
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                MEMPROSES AKUN
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-2 border-black dark:border-gray-700 rounded-full shadow-[2px_2px_0px_#000] shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider">
                {invoice.status}
              </span>
            </div>
          )}
        </div>

        {/* Receipt Summary Card */}
        <div className="bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 p-3.5 sm:p-5 rounded-xl space-y-3.5 sm:space-y-4 shadow-[2px_2px_0px_#000]">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 sm:gap-4">
            <div className="min-w-0">
              <h2 className="font-black text-sm sm:text-base text-black dark:text-white leading-snug">
                {invoice.productName}
              </h2>
              <span className="inline-block mt-1 text-[10px] sm:text-[11px] font-black px-2 py-0.5 bg-white dark:bg-[#151923] text-black dark:text-white border border-black dark:border-gray-700 rounded shadow-[1px_1px_0px_#000]">
                Qty: {invoice.qty}x
              </span>
            </div>
            <div className="text-sm sm:text-base font-black text-black dark:text-white sm:text-right whitespace-nowrap">
              Rp {invoice.unitPrice.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="border-t border-dashed border-gray-300 dark:border-gray-700 pt-3 space-y-2 text-xs font-bold text-gray-600 dark:text-gray-300">
            <div className="flex justify-between items-center">
              <span>Subtotal</span>
              <span className="text-black dark:text-white font-bold whitespace-nowrap">
                Rp {invoice.subtotal.toLocaleString('id-ID')}
              </span>
            </div>

            {invoice.discount > 0 && (
              <div className="flex justify-between items-center p-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded text-emerald-800 dark:text-emerald-300">
                <span>{invoice.discountLabel || 'Diskon'}</span>
                <span className="font-black whitespace-nowrap">
                  -Rp {invoice.discount.toLocaleString('id-ID')}
                </span>
              </div>
            )}

            {invoice.uniqueCode > 0 && (
              <div className="flex justify-between items-center">
                <span>Kode Unik</span>
                <span className="text-black dark:text-white font-bold whitespace-nowrap">
                  Rp {invoice.uniqueCode.toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>

          {/* Total Bayar */}
          <div className="border-t-2 border-black dark:border-gray-700 pt-3 flex items-baseline justify-between gap-2 flex-wrap sm:flex-nowrap">
            <span className="font-black text-xs sm:text-sm uppercase tracking-wider text-black dark:text-white shrink-0">
              TOTAL BAYAR
            </span>
            <span className="text-xl sm:text-2xl md:text-3xl font-black text-brand-blue whitespace-nowrap">
              Rp {invoice.total.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Detail Akun Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-7 h-7 bg-purple-100 dark:bg-purple-950/60 border-2 border-black dark:border-gray-700 rounded-lg flex items-center justify-center shadow-[1.5px_1.5px_0px_#000] shrink-0">
                <Key className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
              </div>
              <h3 className="font-black text-sm sm:text-base text-black dark:text-white">
                Detail Akun Anda
              </h3>
              {invoice.isVerified && !invoice.isLocked && handleRelock && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-400 rounded text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                    <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    <span>Terverifikasi</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRelock}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-400 dark:border-amber-600 rounded-lg text-[10px] font-black uppercase shadow-[1px_1px_0px_#000] cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    title="Kunci kembali kredensial akun untuk keamanan"
                  >
                    <Lock className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                    <span>Kunci Akun</span>
                  </button>
                </div>
              )}
            </div>

            {/* Multi-account "Salin Semua" button when qty > 1 */}
            {!invoice.isLocked && !invoice.isDeliveryPending && invoice.accounts.length > 1 && copyAllAccounts && (
              <button
                type="button"
                onClick={copyAllAccounts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1E2333] hover:bg-purple-50 dark:hover:bg-purple-950/40 text-black dark:text-white text-xs font-black border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
              >
                {copiedKey === 'copy-all-accounts' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Semua Akun Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin Semua ({invoice.accounts.length} Akun)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* State A-0: Status Pembayaran Kadaluarsa (Expired) */}
          {invoice.status === 'KADALUARSA' ? (
            <div className="bg-gradient-to-br from-rose-50 to-red-50/70 dark:from-rose-950/40 dark:to-red-950/30 border-2 border-rose-500 p-5 rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 border-2 border-rose-500 flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-rose-900 dark:text-rose-200">
                    Pembayaran Telah Kadaluarsa (Expired)
                  </h4>
                  <p className="text-xs text-rose-700 dark:text-rose-300 font-medium leading-relaxed">
                    Batas waktu pembayaran untuk pesanan ini telah habis. Transaksi otomatis dibatalkan oleh sistem dan kode QRIS tidak dapat digunakan lagi.
                  </p>
                  {invoice.failureReason && (
                    <div className="text-[11px] font-bold text-rose-800 dark:text-rose-300 bg-rose-100/80 dark:bg-rose-900/50 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 inline-block mt-1">
                      Keterangan: {invoice.failureReason}
                    </div>
                  )}
                </div>
              </div>

              {onNavigateCatalog && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onNavigateCatalog}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer"
                  >
                    <span>Pesan Ulang Produk</span>
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          ) : invoice.status === 'MENUNGGU' ? (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50/70 dark:from-amber-950/30 dark:to-yellow-950/20 border-2 border-black dark:border-amber-700/80 p-5 rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                  <Clock className="w-5 h-5 text-black" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-black dark:text-white">
                    Menunggu Pembayaran Pesanan
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                    Pesanan Anda saat ini masih berstatus <strong className="text-amber-800 dark:text-amber-300 uppercase">Menunggu Pembayaran</strong>. Detail kredensial akun digital ({invoice.qty}x unit) akan otomatis diproses dan langsung ditampilkan di sini setelah Anda menyelesaikan pembayaran QRIS.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-amber-900 dark:text-amber-300">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Silakan selesaikan pembayaran untuk mengaktifkan akun digital Anda.</span>
                  </div>
                </div>
              </div>

              {onNavigatePayment && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onNavigatePayment}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-brand-yellow hover:bg-yellow-400 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer"
                  >
                    <span>Lanjutkan Pembayaran QRIS</span>
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              )}
            </div>
          ) : invoice.isLocked && handleVerifyPhone ? (
            /* State Lock: Kredensial Akun Terproteksi (2-Factor WhatsApp Verification) */
            <div className="bg-gradient-to-br from-amber-50/90 to-orange-50/70 dark:from-[#1E1B29] dark:to-[#161420] border-2 border-black dark:border-amber-500/80 p-4 sm:p-6 rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
              <div className="flex items-start gap-3 sm:gap-3.5">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                  <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-black text-sm sm:text-base text-black dark:text-white">
                      Kredensial Akun Terproteksi
                    </h4>
                    <span className="text-[9px] sm:text-[10px] font-black uppercase px-2 py-0.5 bg-amber-300 text-black border border-black rounded shadow-[1px_1px_0px_#000]">
                      2-FA SECURITY
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                    Demi menjaga keamanan dan kerahasiaan akun digital Anda dari pihak asing, silakan masukkan nomor WhatsApp yang Anda gunakan saat pemesanan untuk membuka username &amp; password.
                  </p>
                  {invoice.customerPhone && (
                    <div className="text-[11px] font-mono text-gray-600 dark:text-gray-400 pt-1 flex flex-wrap items-center gap-1">
                      <span>Nomor Terdaftar:</span>
                      <strong className="text-black dark:text-white font-bold bg-white dark:bg-black/40 px-2 py-0.5 rounded border border-black/20 dark:border-gray-700 break-all">{invoice.customerPhone}</strong>
                    </div>
                  )}
                </div>
              </div>

              <form onSubmit={handleVerifyPhone} className="pt-2 space-y-3 bg-white dark:bg-[#181C2A] p-3.5 sm:p-4 rounded-xl border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000]">
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-black dark:text-gray-200">
                    Masukkan Nomor WhatsApp Pemesan
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 text-gray-400 pointer-events-none">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="tel"
                      required
                      disabled={isVerifyingPhone}
                      placeholder="081234567890"
                      aria-label="Nomor WhatsApp pemesan untuk verifikasi"
                      value={verifyPhoneInput || ''}
                      onChange={(e) => setVerifyPhoneInput?.(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-[#FAF8F5] dark:bg-[#12141C] border-2 border-black dark:border-gray-700 text-black dark:text-white font-bold text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000] font-mono"
                    />
                  </div>
                </div>

                {verifyError && (
                  <div className="p-3 bg-rose-100 dark:bg-rose-950/60 border-2 border-rose-500 rounded-xl text-xs font-bold text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{verifyError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingPhone || !verifyPhoneInput?.trim()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 bg-brand-blue hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer disabled:opacity-50 transition-all active:translate-x-0.5 active:translate-y-0.5"
                >
                  {isVerifyingPhone ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>MEMVERIFIKASI...</span>
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>BUKA KREDENSIAL AKUN</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : invoice.isDeliveryPending || invoice.accounts.length === 0 ? (
            /* State: Sudah Lunas, Sedang Diproses Sistem */
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50/70 dark:from-blue-950/30 dark:to-indigo-950/20 border-2 border-black dark:border-blue-700/80 p-5 rounded-2xl shadow-[4px_4px_0px_#000] space-y-3.5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-brand-blue text-white border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0 animate-pulse">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-black text-sm text-black dark:text-white flex items-center gap-2">
                    <span>Sedang Menyiapkan Detail Akun Anda...</span>
                  </h4>
                  <p className="text-xs text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
                    Pembayaran Anda telah diverifikasi <strong className="text-emerald-700 dark:text-emerald-400">LUNAS</strong>. Sistem saat ini sedang memproses dan menyiapkan kredensial akun digital Anda ({invoice.qty}x unit) secara otomatis.
                  </p>
                  <div className="flex items-center gap-2 pt-1 text-[11px] font-bold text-brand-blue dark:text-cyan-300">
                    <span className="inline-block w-2 h-2 rounded-full bg-brand-blue animate-ping" />
                    <span>Halaman ini akan otomatis memperbarui data akun tanpa perlu refresh...</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* State: Daftar Akun Riil Lengkap */
            <div className="space-y-3">
              {invoice.accounts.map((acc, idx) => {
                const urlMatch = acc.passwordOrCode.match(/https?:\/\/[^\s]+/);

                return (
                  <div 
                    key={idx}
                    className="bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 p-3.5 sm:p-4 space-y-3 rounded-xl shadow-[3px_3px_0px_#000]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-dashed border-gray-300 dark:border-gray-700 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 bg-yellow-300 text-black border border-black rounded shadow-[1px_1px_0px_#000]">
                          {acc.title}
                        </span>
                        <span className="text-[10px] sm:text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[180px] sm:max-w-none">
                          {acc.packageBadge}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => copySingleAccount(acc, idx)}
                        aria-label={`Salin detail akun ${acc.title}`}
                        className="text-[10px] font-bold text-brand-blue hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {copiedKey === `single-${idx}` ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-600 font-bold">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin Akun Ini</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Email / Username Field */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-extrabold uppercase text-gray-500 dark:text-gray-400 tracking-wider">
                          EMAIL / USERNAME
                        </label>
                        <div className="flex items-center justify-between p-2.5 bg-[#FAF8F5] dark:bg-[#151923] border-2 border-black dark:border-gray-700 text-xs font-mono font-bold text-black dark:text-white shadow-[1.5px_1.5px_0px_#000] rounded-lg gap-2">
                          <span className="break-all select-all min-w-0 leading-tight mr-1">{acc.emailOrUsername}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(acc.emailOrUsername, `email-${idx}`)}
                            aria-label="Salin email atau username"
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
                          PASSWORD / KREDENSIAL / AKSES
                        </label>
                        <div className="flex items-start justify-between p-2.5 bg-[#FAF8F5] dark:bg-[#151923] border-2 border-black dark:border-gray-700 text-xs font-mono font-bold text-black dark:text-white shadow-[1.5px_1.5px_0px_#000] rounded-lg gap-2">
                          <span className="break-all select-all whitespace-pre-wrap min-w-0 leading-tight mr-1 text-emerald-700 dark:text-emerald-400">{acc.passwordOrCode}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(acc.passwordOrCode, `pass-${idx}`)}
                            aria-label="Salin kata sandi atau kode akses"
                            title="Salin Password/Kredensial"
                            className="text-gray-600 dark:text-gray-300 hover:text-brand-blue shrink-0 p-1 cursor-pointer mt-0.5"
                          >
                            {copiedKey === `pass-${idx}` ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        {/* Quick Link if URL is detected in password */}
                        {urlMatch && (
                          <div className="pt-1">
                            <a
                              href={urlMatch[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded border border-blue-200 dark:border-blue-900"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Buka Link Akses / Email</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Warning Notice */}
          {invoice.warningNotice && (
            <div className={`p-3.5 border-2 rounded-xl flex items-start gap-2.5 shadow-[2px_2px_0px_#000] ${
              invoice.status === 'KADALUARSA'
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500'
                : 'bg-amber-50 dark:bg-amber-950/40 border-black dark:border-gray-700'
            }`}>
              <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
                invoice.status === 'KADALUARSA' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              }`} />
              <div className="text-xs text-black dark:text-gray-200">
                <strong className={`font-black block mb-0.5 ${
                  invoice.status === 'KADALUARSA' ? 'text-rose-800 dark:text-rose-300' : 'text-amber-800 dark:text-amber-300'
                }`}>PERHATIAN!</strong>
                <span className={`font-medium leading-relaxed ${
                  invoice.status === 'KADALUARSA' ? 'text-rose-700 dark:text-rose-300' : 'text-gray-700 dark:text-gray-300'
                }`}>{invoice.warningNotice}</span>
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
            href={`https://wa.me/6285750231336?text=Halo%20Admin%20Nara%20Premium,%20saya%20butuh%20bantuan%20terkait%20Invoice%20${encodeURIComponent(invoice.id)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Chat CS WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
};
