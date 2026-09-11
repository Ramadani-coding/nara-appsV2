import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  QrCode, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck, 
  Copy, 
  Check, 
  Clock, 
  RefreshCw, 
  AlertTriangle,
  ArrowLeft
} from 'lucide-react';
import { 
  getBackendOrder, 
  checkBackendPaymentStatus, 
  type BackendOrderDetail 
} from '../lib/api';

/**
 * Mengubah string waktu kadaluarsa dari Midtrans ("YYYY-MM-DD HH:mm:ss" WIB atau ISO)
 * menjadi timestamp millisecond yang akurat
 */
function parseExpiryTimestamp(expiryStr?: string | null, fallbackCreatedAt?: string): number | null {
  if (expiryStr && typeof expiryStr === 'string' && expiryStr.trim()) {
    try {
      if (expiryStr.includes('T')) {
        const d = new Date(expiryStr).getTime();
        if (!isNaN(d)) return d;
      }
      // Format Midtrans: "YYYY-MM-DD HH:mm:ss" WIB (+07:00)
      const cleaned = expiryStr.trim().replace(' ', 'T') + '+07:00';
      const d = new Date(cleaned).getTime();
      if (!isNaN(d)) return d;
    } catch {}
  }

  // Fallback: 15 menit dari order.createdAt jika belum ada info expiry spesifik
  if (fallbackCreatedAt) {
    try {
      const created = new Date(fallbackCreatedAt).getTime();
      if (!isNaN(created)) return created + 15 * 60 * 1000;
    } catch {}
  }

  return null;
}

export default function Payment() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Fallbacks from URL search params & location state (if navigated from checkout)
  const initialAmount = searchParams.get('amount') || '0';
  const initialProduct = searchParams.get('product') || 'Produk Digital Premium';
  const initialPhone = searchParams.get('phone') || '';
  const initialEmail = searchParams.get('email') || '';
  const initialQty = searchParams.get('qty') || '1';
  const initialExpiryParam = searchParams.get('expiry');
  const initialOrderData = (location.state as any)?.orderData;

  const [order, setOrder] = useState<BackendOrderDetail | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'failed'>('pending');
  const [copied, setCopied] = useState(false);
  const [targetExpiryTime, setTargetExpiryTime] = useState<number | null>(() => {
    if (initialExpiryParam) return parseExpiryTimestamp(initialExpiryParam);
    if (initialOrderData?.payment?.expiryTime) return parseExpiryTimestamp(initialOrderData.payment.expiryTime);
    return null;
  });
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Ambil detail order dan QRIS dari backend
  const fetchOrderData = useCallback(async () => {
    if (!orderId) return;
    try {
      const data = await getBackendOrder(orderId);
      if (data) {
        setOrder(data);

        // Ambil batas waktu riil yang diberikan Midtrans
        const paymentRecord = data.payments?.[0];
        const expiryRaw = paymentRecord?.expiryTime || (paymentRecord as any)?.rawCallback?.expiry_time;
        const targetTs = parseExpiryTimestamp(expiryRaw, data.createdAt);

        if (targetTs) {
          setTargetExpiryTime(targetTs);
          const remainingSec = Math.max(0, Math.floor((targetTs - Date.now()) / 1000));
          setTimeLeft(remainingSec);

          // Jika waktu riil dari Midtrans sudah terlewat dan order belum lunas
          if (remainingSec <= 0 && data.status === 'waiting_payment') {
            setStatus('failed');
            setErrorMessage('Batas waktu pembayaran resmi telah habis (Expired). Kode QRIS ini telah dinonaktifkan.');
            return;
          }
        }

        if (data.status === 'paid' || data.status === 'processing' || data.status === 'completed') {
          setStatus('success');
        } else if (data.status === 'failed') {
          setStatus('failed');
        }
      }
    } catch (err: any) {
      console.error('Gagal mengambil data order:', err);
    } finally {
      setIsLoadingOrder(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  // 2. Countdown timer pembayaran berbasis batas waktu riil Midtrans
  useEffect(() => {
    if (!targetExpiryTime || status === 'success' || status === 'failed') return;

    const tick = () => {
      const now = Date.now();
      const diffMs = targetExpiryTime - now;
      const remainingSec = Math.max(0, Math.floor(diffMs / 1000));
      setTimeLeft(remainingSec);

      if (remainingSec <= 0) {
        setTimeLeft(0);
        setStatus('failed');
        setErrorMessage('Batas waktu pembayaran resmi telah habis (Expired). Kode QRIS ini dinonaktifkan permanen.');
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetExpiryTime, status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const copyOrderId = () => {
    if (orderId) {
      navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 3. Polling status otomatis ke backend & sinkronisasi Midtrans Core API setiap 3.5 detik
  useEffect(() => {
    if (!orderId || status === 'success' || status === 'failed') return;

    const interval = setInterval(async () => {
      try {
        const res = await checkBackendPaymentStatus(orderId);
        if (res) {
          // Sinkronkan expiryTime dari status jika sebelumnya belum terdeteksi
          const resExpiry = res.payment?.expiryTime || res.payment?.rawCallback?.expiry_time;
          if (resExpiry && !targetExpiryTime) {
            const targetTs = parseExpiryTimestamp(resExpiry, res.createdAt);
            if (targetTs) {
              setTargetExpiryTime(targetTs);
              const remainingSec = Math.max(0, Math.floor((targetTs - Date.now()) / 1000));
              setTimeLeft(remainingSec);
            }
          }

          if (res.status === 'paid' || res.status === 'processing' || res.status === 'completed') {
            setStatus('success');
            clearInterval(interval);

            // Simpan cache lokal untuk riwayat MyOrders
            try {
              const existing = JSON.parse(localStorage.getItem('nara_orders') || '[]');
              const newOrder = {
                id: orderId,
                product: res.items?.[0]?.productName || initialProduct,
                qty: res.items?.[0]?.quantity || Number(initialQty) || 1,
                total: res.totalAmount || Number(initialAmount) || 0,
                phone: res.customerPhone || initialPhone,
                email: res.customerEmail || initialEmail,
                status: 'completed',
                date: new Date().toLocaleDateString('id-ID', { 
                  day: '2-digit', 
                  month: 'short', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                }),
              };
              localStorage.setItem('nara_orders', JSON.stringify([newOrder, ...existing]));
            } catch (e) {
              console.error('Failed to update localStorage', e);
            }

            setTimeout(() => {
              navigate(`/invoice/${encodeURIComponent(orderId)}`);
            }, 2000);
          } else if (res.status === 'failed' || res.payment?.status === 'expire' || res.payment?.status === 'cancel') {
            setStatus('failed');
            setTimeLeft(0);
            setErrorMessage('Batas waktu pembayaran telah habis atau transaksi dibatalkan. Kode QRIS ini telah dinonaktifkan.');
            clearInterval(interval);
          }
        }
      } catch (_pollErr) {
        // Polling silent error
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [orderId, status, targetExpiryTime, initialProduct, initialQty, initialAmount, initialPhone, initialEmail, navigate]);

  // 4. Tombol manual Cek Status Pembayaran
  const handleManualCheckStatus = async () => {
    if (!orderId || isCheckingStatus) return;
    setIsCheckingStatus(true);
    setErrorMessage(null);

    try {
      const res = await checkBackendPaymentStatus(orderId);
      if (res.status === 'paid' || res.status === 'processing' || res.status === 'completed') {
        setStatus('success');
        setTimeout(() => {
          navigate(`/invoice/${encodeURIComponent(orderId)}`);
        }, 1500);
      } else if (res.status === 'failed' || res.payment?.status === 'expire' || res.payment?.status === 'cancel') {
        setStatus('failed');
        setTimeLeft(0);
        setErrorMessage('Batas waktu pembayaran telah habis atau dibatalkan. Kode QRIS ini telah dinonaktifkan.');
      } else {
        setErrorMessage('Pembayaran belum terdeteksi. Silakan pastikan Anda sudah menyelesaikan transaksi pada aplikasi e-wallet/m-Banking.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memeriksa status pembayaran.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Display values
  const displayAmount = order?.totalAmount ?? Number(initialAmount);
  const displayProduct = order?.items?.[0]?.productName ?? initialProduct;
  const displayQty = order?.items?.[0]?.quantity ?? Number(initialQty);
  const displayPhone = order?.customerPhone ?? initialPhone;
  const displayEmail = order?.customerEmail ?? initialEmail;
  const paymentRecord = order?.payments?.[0];
  const qrCodeUrl = paymentRecord?.qrCodeUrl || initialOrderData?.payment?.qrCodeUrl;

  const isExpired = status === 'failed' || (timeLeft !== null && timeLeft <= 0);
  const isPaid = status === 'success';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto space-y-6 pb-16 text-black dark:text-gray-100"
    >
      {/* Header Info */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-between mb-2">
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1E2333] text-black dark:text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali</span>
          </button>
          <span className="px-3 py-1 bg-brand-yellow text-black font-black text-xs uppercase border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg inline-block">
            PEMBAYARAN RESMI QRIS
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-black dark:text-white">
          Scan QRIS untuk Bayar
        </h1>
        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
          Dapat dibayar melalui GoPay, OVO, Dana, ShopeePay, BCA, dan seluruh m-Banking.
        </p>
      </div>

      {/* Main Payment Card */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[6px_6px_0px_0px_#000000] p-4 sm:p-6 space-y-5 sm:space-y-6 rounded-2xl">
        
        {/* Timer Bar - Berubah secara dinamis sesuai status pembayaran & batas waktu riil */}
        {isExpired ? (
          <div className="flex items-center justify-between p-3 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-500 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black text-rose-700 dark:text-rose-400">
              <Clock className="w-4 h-4" />
              <span>Batas Waktu Pembayaran:</span>
            </div>
            <span className="font-mono font-black text-xs text-white bg-rose-600 px-2.5 py-1 border border-black rounded shadow-[1px_1px_0px_#000]">
              00:00 (KADALUARSA)
            </span>
          </div>
        ) : isPaid ? (
          <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-500 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span>Status Pembayaran:</span>
            </div>
            <span className="font-mono font-black text-xs text-white bg-emerald-600 px-2.5 py-1 border border-black rounded shadow-[1px_1px_0px_#000]">
              LUNAS (1X DIGUNAKAN)
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-black">
              <Clock className="w-4 h-4 text-brand-pink" />
              <span>Sisa Waktu Pembayaran:</span>
            </div>
            <span className="font-mono font-black text-sm text-brand-pink bg-white dark:bg-[#181C2A] px-2 py-0.5 border border-black dark:border-gray-700 rounded">
              {timeLeft !== null ? formatTime(timeLeft) : 'Menghitung...'}
            </span>
          </div>
        )}

        {/* QR Code Container - Proteksi 1x Transaksi & Deaktivasi Permanen jika Expired / Paid */}
        <div className="flex flex-col items-center justify-center p-4 sm:p-6 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-2xl relative">
          
          {isExpired ? (
            /* STATE 1: QRIS KADALUARSA (EXPIRED) - Kode QRIS Ditutup Permanen */
            <div className="w-full flex flex-col items-center justify-center p-5 sm:p-6 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-500 rounded-xl text-center space-y-3">
              <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/60 rounded-2xl flex items-center justify-center border-2 border-rose-500 shadow-[2px_2px_0px_#000]">
                <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider rounded border border-black inline-block">
                  QRIS KADALUARSA (EXPIRED)
                </span>
                <h3 className="font-black text-base text-rose-900 dark:text-rose-200">
                  Kode QRIS Tidak Dapat Digunakan
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 max-w-xs leading-relaxed font-medium mx-auto">
                  Batas waktu pembayaran resmi dari sistem telah habis. Kode QRIS ini dinonaktifkan permanen dan tidak dapat dipindai lagi demi keamanan transaksi.
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="mt-2 px-5 py-2.5 bg-brand-blue text-white text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] neo-btn rounded-xl cursor-pointer"
              >
                Buat Pesanan Baru
              </button>
            </div>
          ) : isPaid ? (
            /* STATE 2: QRIS SUDAH DIBAYAR (1X PENGGUNAAN) - Kode QRIS Ditutup Otomatis */
            <div className="w-full flex flex-col items-center justify-center p-5 sm:p-6 bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-xl text-center space-y-3">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/60 rounded-2xl flex items-center justify-center border-2 border-emerald-500 shadow-[2px_2px_0px_#000]">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 bg-emerald-600 text-white font-black text-[10px] uppercase tracking-wider rounded border border-black inline-block">
                  QRIS SELESAI DIGUNAKAN (LUNAS)
                </span>
                <h3 className="font-black text-base text-emerald-900 dark:text-emerald-200">
                  Pembayaran Berhasil Diterima
                </h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 max-w-xs leading-relaxed font-medium mx-auto">
                  Kode QRIS ini hanya berlaku untuk 1x transaksi dan telah dinonaktifkan secara otomatis. Anda tidak dapat melakukan pembayaran ulang pada QRIS ini.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300 pt-1">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span>Mengalihkan ke invoice & rincian akun...</span>
              </div>
            </div>
          ) : (
            /* STATE 3: PENDING - Kode QRIS Aktif Dapat Discan */
            <>
              <div className="bg-white p-3 border-2 border-black shadow-[3px_3px_0px_#000] rounded-xl relative min-w-[200px] min-h-[200px] flex items-center justify-center">
                {isLoadingOrder && !qrCodeUrl ? (
                  <div className="flex flex-col items-center gap-2 text-xs font-black text-gray-500 py-10">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
                    <span>Memuat Kode QRIS Resmi...</span>
                  </div>
                ) : qrCodeUrl ? (
                  <img 
                    src={qrCodeUrl} 
                    alt="Kode QRIS Resmi" 
                    className="w-48 h-48 sm:w-52 sm:h-52 object-contain select-none"
                  />
                ) : (
                  <div className="relative">
                    <QrCode className="w-44 h-44 sm:w-48 sm:h-48 text-black" />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="w-10 h-10 bg-brand-pink text-white font-black text-xs flex items-center justify-center border-2 border-black shadow-[1px_1px_0px_#000] rounded">
                        QRIS
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1 text-center">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                <span>NMID: ID1020039281920 (NARA DIGITAL STORE)</span>
              </div>
              <div className="mt-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 text-center">
                🔒 Kode QRIS hanya dapat digunakan untuk 1x transaksi pembayaran.
              </div>
            </>
          )}
        </div>

        {/* Order Breakdown Box */}
        <div className="space-y-2.5 bg-[#FAF8F5] dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 p-3.5 sm:p-4 text-xs font-bold rounded-xl">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 uppercase">Nomor Pesanan</span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-black dark:text-white font-black">{orderId}</span>
              <button 
                onClick={copyOrderId}
                className="p-1 bg-white dark:bg-[#181C2A] border border-black dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer shrink-0 rounded"
                title="Salin Nomor Pesanan"
              >
                {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3 text-black dark:text-white" />}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-gray-500 dark:text-gray-400 uppercase">Produk</span>
            <span className="text-black dark:text-white font-black truncate max-w-[200px] text-right">{displayProduct}</span>
          </div>

          {displayQty > 1 && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 uppercase">Jumlah (Qty)</span>
              <span className="text-black dark:text-white font-black">{displayQty} Pcs</span>
            </div>
          )}

          {displayPhone && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 uppercase">Tujuan WhatsApp</span>
              <span className="text-black dark:text-white font-black font-mono">{displayPhone}</span>
            </div>
          )}

          {displayEmail && (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400 uppercase">Email Penerima</span>
              <span className="text-black dark:text-white font-black truncate max-w-[180px]">{displayEmail}</span>
            </div>
          )}

          <div className="border-t-2 border-black dark:border-gray-700 pt-2 flex justify-between items-center text-sm">
            <span className="font-black uppercase text-black dark:text-white">Total Bayar</span>
            <span className="font-black text-lg text-brand-blue whitespace-nowrap">
              Rp {displayAmount.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Error Notice if any */}
        {errorMessage && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 rounded-xl flex items-center gap-2.5 text-xs font-bold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Status Area */}
        {status === 'pending' && !isExpired && (
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-black dark:border-gray-700 flex items-center justify-center gap-2 text-xs font-black text-amber-900 dark:text-amber-200 rounded-xl">
              <Loader2 className="w-4 h-4 animate-spin text-black dark:text-white" />
              <span>MENUNGGU PEMBAYARAN VIA QRIS...</span>
            </div>

            {/* Manual Check Button */}
            <button
              onClick={handleManualCheckStatus}
              disabled={isCheckingStatus}
              className="w-full py-3 bg-white dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-gray-800 text-black dark:text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[3px_3px_0px_#000] neo-btn flex items-center justify-center gap-2 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingStatus ? 'animate-spin' : ''}`} />
              <span>{isCheckingStatus ? 'MEMERIKSA PEMBAYARAN...' : 'CEK STATUS PEMBAYARAN'}</span>
            </button>
          </div>
        )}

        {status === 'verifying' && (
          <div className="p-4 bg-brand-blue text-white border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 text-xs font-black rounded-xl">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>MEMVERIFIKASI PEMBAYARAN & MEMPROSES PESANAN...</span>
          </div>
        )}

        {status === 'success' && (
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="p-4 bg-emerald-400 text-black border-2 border-black shadow-[4px_4px_0px_#000] text-center space-y-1 rounded-xl"
          >
            <div className="flex items-center justify-center gap-1.5 font-black text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>PEMBAYARAN QRIS BERHASIL DIVERIFIKASI!</span>
            </div>
            <p className="text-xs font-bold">Pesanan lunas, mengalihkan ke rincian invoice & detail akun...</p>
          </motion.div>
        )}

        {isExpired && (
          <div className="p-4 bg-rose-100 text-rose-900 border-2 border-rose-500 rounded-xl text-center space-y-2">
            <div className="flex items-center justify-center gap-2 font-black text-sm text-rose-700">
              <AlertTriangle className="w-5 h-5" />
              <span>PEMBAYARAN KADALUARSA</span>
            </div>
            <p className="text-xs font-medium">Batas waktu pembayaran dari sistem telah habis. QRIS tidak dapat digunakan lagi.</p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-brand-blue text-white text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer"
            >
              Pesan Ulang
            </button>
          </div>
        )}

      </div>

      {/* Safety Notice */}
      <div className="p-3 bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 text-center text-xs font-bold text-gray-600 dark:text-gray-400 rounded-xl shadow-[2px_2px_0px_#000]">
        🔒 Pembayaran QRIS ini aman, terenkripsi resmi, dan terlindungi dengan sistem keamanan otomatis 24/7.
      </div>
    </motion.div>
  );
}
