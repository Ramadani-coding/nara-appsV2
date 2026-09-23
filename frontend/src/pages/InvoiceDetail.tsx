import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Search, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { findInvoiceAsync, type InvoiceData } from '../lib/invoiceData';
import { verifyBackendOrderPhone, clearOrderSessionToken } from '../lib/api';
import { OrderInvoiceCard } from '../components/OrderInvoiceCard';

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isLookup = searchParams.get('lookup') === 'true';

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [altQuery, setAltQuery] = useState('');

  // Selalu inisialisasi dengan null dan loading true
  // agar TIDAK PERNAH memunculkan mock/fake credentials sebelum otentikasi live selesai
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [verifyPhoneInput, setVerifyPhoneInput] = useState('');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const cleanId = (id || invoice?.id || '').replace(/^#/, '');

  // Fungsi untuk mengunci kembali kredensial akun kapan saja
  const handleRelock = async () => {
    if (!cleanId) return;
    clearOrderSessionToken(cleanId);
    setVerifyPhoneInput('');
    setVerifyError(null);
    setIsLoading(true);
    const lockedRes = await findInvoiceAsync(cleanId, { skipToken: true });
    if (lockedRes) {
      setInvoice(lockedRes);
    }
    setIsLoading(false);
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyPhoneInput.trim() || !cleanId) return;

    setIsVerifyingPhone(true);
    setVerifyError(null);

    try {
      const res = await verifyBackendOrderPhone(cleanId, verifyPhoneInput.trim());
      if (res.success && res.token) {
        // Hapus parameter lookup jika ada agar tidak memaksa skipToken lagi
        if (searchParams.has('lookup')) {
          searchParams.delete('lookup');
          setSearchParams(searchParams, { replace: true });
        }
        // Refresh detail invoice lengkap dengan token verifikasi yang valid
        const updated = await findInvoiceAsync(cleanId, { customToken: res.token });
        if (updated) {
          setInvoice(updated);
        }
      } else {
        setVerifyError(res.message || 'Nomor WhatsApp tidak cocok dengan pesanan ini.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Terjadi kesalahan saat verifikasi.');
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let pollTimer: any = null;
    let pollCount = 0;

    const loadInvoice = async (initial = false) => {
      if (!id || !isMounted) return;
      if (initial) setIsLoading(true);

      try {
        const res = await findInvoiceAsync(id, { skipToken: isLookup });
        if (!isMounted) return;

        if (res) {
          setInvoice(res);
          setIsLoading(false);

          // Jika status kadaluarsa, terkunci, atau akun sudah tersedia, hentikan polling
          if (res.status === 'KADALUARSA' || res.isLocked || (!res.isDeliveryPending && res.accounts.length > 0)) {
            return;
          }
        } else {
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }

      // Adaptive polling backoff: 2.5s -> 5s -> 10s, max 60 polls (~8-10 min)
      pollCount++;
      if (pollCount <= 60 && isMounted) {
        const delay = pollCount <= 12 ? 2500 : pollCount <= 36 ? 5000 : 10000;
        pollTimer = setTimeout(() => {
          loadInvoice(false);
        }, delay);
      }
    };

    loadInvoice(true);

    return () => {
      isMounted = false;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [id, isLookup]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAllAccounts = () => {
    if (!invoice || invoice.accounts.length === 0) return;
    const formatted = invoice.accounts
      .map(
        (acc, i) =>
          `AKUN #${i + 1} (${acc.packageBadge})\nEmail/User: ${acc.emailOrUsername}\nPassword/Akses: ${acc.passwordOrCode}`
      )
      .join('\n\n---\n\n');
    copyToClipboard(formatted, 'copy-all-accounts');
  };

  const handleSearchOther = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = altQuery.trim().replace(/^#/, '');
    if (clean) {
      clearOrderSessionToken(clean);
      navigate(`/invoice/${encodeURIComponent(clean)}?lookup=true`);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4 text-black dark:text-gray-100">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-blue" />
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400">Memuat rincian invoice dari sistem...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="max-w-xl mx-auto space-y-6 pb-16 text-black dark:text-gray-100">
        <button 
          onClick={() => navigate('/#categories-filter')}
          className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-white dark:bg-[#1E2333] text-black dark:text-white font-extrabold text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn cursor-pointer rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" />
          <span>KEMBALI</span>
          <span className="hidden sm:inline">KE KATALOG</span>
        </button>

        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-6 sm:p-8 text-center space-y-5 rounded-2xl">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-950/60 border-2 border-black dark:border-gray-700 rounded-xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
            <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white">
              Invoice Tidak Ditemukan
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium max-w-md mx-auto leading-relaxed">
              Nomor invoice <span className="font-mono font-bold text-black dark:text-white">"{id}"</span> tidak terdaftar dalam sistem kami. Pastikan nomor invoice sudah sesuai.
            </p>
          </div>

          {/* Alternative Search Bar */}
          <form onSubmit={handleSearchOther} className="flex gap-2 max-w-md mx-auto pt-2">
            <input 
              type="text"
              placeholder="Cari nomor invoice lain..."
              value={altQuery}
              onChange={(e) => setAltQuery(e.target.value)}
              className="w-full bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 py-2.5 px-3.5 text-xs font-bold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000] rounded-xl"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] neo-btn shrink-0 cursor-pointer rounded-xl"
            >
              <Search className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2">
            <button
              onClick={() => navigate('/#categories-filter')}
              className="px-6 py-2.5 bg-white dark:bg-[#1E2333] hover:bg-gray-100 text-black dark:text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn cursor-pointer rounded-xl"
            >
              Kembali ke Katalog Produk
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-4 sm:space-y-6 pb-20 text-black dark:text-gray-100"
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

      {/* ========================================================
          INVOICE CARD (Consolidated Reusable Component)
         ======================================================== */}
      <OrderInvoiceCard
        invoice={invoice}
        copiedKey={copiedKey}
        copyToClipboard={copyToClipboard}
        copyAllAccounts={copyAllAccounts}
        handleRelock={handleRelock}
        verifyPhoneInput={verifyPhoneInput}
        setVerifyPhoneInput={setVerifyPhoneInput}
        handleVerifyPhone={handleVerifyPhone}
        isVerifyingPhone={isVerifyingPhone}
        verifyError={verifyError}
        onNavigatePayment={() => navigate(`/payment/${encodeURIComponent(cleanId)}`)}
        onNavigateCatalog={() => navigate('/#categories-filter')}
      />
    </motion.div>
  );
}
