import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { getAllInvoices, findInvoice, findInvoiceAsync, type InvoiceData } from '../lib/invoiceData';
import { verifyBackendOrderPhone, clearOrderSessionToken } from '../lib/api';
import { OrderInvoiceCard } from '../components/OrderInvoiceCard';

export default function MyOrders() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlOrderId = searchParams.get('id');

  const allInvoices = useMemo(() => getAllInvoices(), []);
  const [liveInvoice, setLiveInvoice] = useState<InvoiceData | null>(null);

  const [verifyPhoneInput, setVerifyPhoneInput] = useState('');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

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

  const copyAllAccounts = () => {
    if (!activeInvoice?.accounts) return;
    const text = activeInvoice.accounts
      .map((acc, idx) => `[AKUN ${idx + 1}: ${acc.title}]\nEmail/User: ${acc.emailOrUsername}\nPassword: ${acc.passwordOrCode}`)
      .join('\n\n');
    copyToClipboard(text, 'all-accounts');
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (activeInvoice?.id || '').replace(/^#/, '');
    if (!verifyPhoneInput.trim() || !cleanId) return;

    setIsVerifyingPhone(true);
    setVerifyError(null);

    try {
      const res = await verifyBackendOrderPhone(cleanId, verifyPhoneInput.trim());
      if (res.success && res.token) {
        const refreshed = await findInvoiceAsync(cleanId);
        if (refreshed) {
          setLiveInvoice(refreshed);
        }
      } else {
        setVerifyError(res.message || 'Nomor WhatsApp tidak cocok.');
      }
    } catch (err: any) {
      setVerifyError(err.message || 'Gagal memverifikasi nomor WhatsApp.');
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleRelock = async () => {
    const cleanId = (activeInvoice?.id || '').replace(/^#/, '');
    if (!cleanId) return;
    clearOrderSessionToken(cleanId);
    setVerifyPhoneInput('');
    setVerifyError(null);
    const lockedRes = await findInvoiceAsync(cleanId, { skipToken: true });
    if (lockedRes) {
      setLiveInvoice(lockedRes);
    }
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
        <OrderInvoiceCard 
          invoice={activeInvoice}
          copiedKey={copiedKey}
          copyToClipboard={copyToClipboard}
          copyAllAccounts={copyAllAccounts}
          handleRelock={handleRelock}
          verifyPhoneInput={verifyPhoneInput}
          setVerifyPhoneInput={setVerifyPhoneInput}
          handleVerifyPhone={handleVerifyPhone}
          isVerifyingPhone={isVerifyingPhone}
          verifyError={verifyError}
          onNavigatePayment={() => navigate(`/checkout/payment?id=${encodeURIComponent(activeInvoice.id)}`)}
          onNavigateCatalog={() => navigate('/#categories-filter')}
        />
      )}
    </motion.div>
  );
}
