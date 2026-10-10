import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveService } from '../lib/useLiveCatalog';
import { usePremkuBalance } from '../lib/usePremkuBalance';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  ArrowRight,
  ShieldCheck, 
  QrCode, 
  Plus, 
  Minus, 
  Phone, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  Users,
  Ticket,
  ChevronRight,
  X,
  Percent
} from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { enqueueBackendOrder, getQueueTicketStatus, fetchAvailableVouchers, type AvailableVoucher } from '../lib/api';
import { 
  validatePhoneLocal, 
  validatePhoneWithBackend, 
  type LocalPhoneValidationResult 
} from '../lib/phoneValidation';

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialPackageId = searchParams.get('package');
  const service = useLiveService(id || '');
  
  const selectedPackageId = initialPackageId || service?.packages[0]?.id || '';

  const { isMaintenance, getMaxAllowedQty } = usePremkuBalance();

  // Find selected package or fallback to first package
  const selectedPackage = service?.packages.find(p => p.id === selectedPackageId) || service?.packages[0];
  const isOutOfStock = !selectedPackage || selectedPackage.stockCount <= 0;
  const selectedModalPrice = selectedPackage?.providerPrice || selectedPackage?.price || 0;

  // Logic deskripsi produk & ketentuan paket
  const hasPkgDesc = Boolean(selectedPackage?.description && selectedPackage.description.trim().length > 0);
  const hasSvcDesc = Boolean(service?.description && service.description.trim().length > 0);
  const boxDescription = hasPkgDesc 
    ? selectedPackage?.description 
    : (hasSvcDesc ? service?.description : '');
  const boxTitle = hasPkgDesc 
    ? `Ketentuan Paket (${selectedPackage?.name}):` 
    : 'Deskripsi & Ketentuan Layanan:';

  // Status maintenance dari saldo modal supplier riil
  const isSelectedPkgMaintenance = !isOutOfStock && selectedPackage 
    ? (selectedPackage.isMaintenance !== undefined ? selectedPackage.isMaintenance : isMaintenance(selectedModalPrice))
    : false;

  // Batasi kuantitas maksimum: TIDAK BOLEH melebihi stok yang tersedia (stockCount)
  // dan juga dibatasi oleh saldo modal akun Premku jika berlaku
  const maxAllowedQty = selectedPackage && !isOutOfStock && !isSelectedPkgMaintenance
    ? Math.min(
        selectedPackage.stockCount,
        selectedPackage.maxAllowedQty !== undefined
          ? selectedPackage.maxAllowedQty
          : (selectedPackage.providerPrice
              ? (getMaxAllowedQty(selectedPackage.providerPrice, selectedPackage.stockCount) || selectedPackage.stockCount)
              : selectedPackage.stockCount)
      )
    : 0;

  const [phone, setPhone] = useState('');
  const [phoneValidation, setPhoneValidation] = useState<LocalPhoneValidationResult>(() => validatePhoneLocal(''));
  const [isVerifyingPhoneRemote, setIsVerifyingPhoneRemote] = useState(false);
  const [remoteWaStatus, setRemoteWaStatus] = useState<{
    checked: boolean;
    registered: boolean;
    message?: string;
  }>({ checked: false, registered: true });

  const email = '';
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Status Voucher Promo yang Dikonfigurasi Admin
  const [availableVouchers, setAvailableVouchers] = useState<AvailableVoucher[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<AvailableVoucher | null>(null);
  const [isLoadingVouchers, setIsLoadingVouchers] = useState(false);
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const [voucherRealtimeAlert, setVoucherRealtimeAlert] = useState<{
    message: string;
    type: 'info' | 'warning' | 'success';
  } | null>(null);

  // Auto-dismiss alert realtime setelah 7 detik
  useEffect(() => {
    if (!voucherRealtimeAlert) return;
    const t = setTimeout(() => {
      setVoucherRealtimeAlert(null);
    }, 7000);
    return () => clearTimeout(t);
  }, [voucherRealtimeAlert]);

  // Sinkronisasi Realtime Voucher Promo (Supabase WebSocket, BroadcastChannel, Tab Focus, & Fallback Polling)
  useEffect(() => {
    if (!selectedPackage) return;
    let isCancelled = false;

    const syncVouchers = async (isSilent = false) => {
      if (!selectedPackage) return;
      if (!isSilent) setIsLoadingVouchers(true);

      const effProductId = selectedPackage.productId || 
        (typeof selectedPackage.id === 'number' ? selectedPackage.id : undefined) ||
        (selectedPackage.providerId && !isNaN(Number(selectedPackage.providerId)) ? Number(selectedPackage.providerId) : undefined);

      try {
        const data = await fetchAvailableVouchers(effProductId, quantity, {
          providerId: selectedPackage.providerId,
          packageId: selectedPackage.id,
          price: selectedPackage.price,
          providerPrice: selectedPackage.providerPrice,
        });

        if (isCancelled) return;

        setAvailableVouchers(data);

        // Evaluasi dan sinkronkan voucher yang sedang dipilih secara realtime
        setSelectedVoucher((currentVoucher) => {
          if (!currentVoucher) return null;

          const currentTotal = selectedPackage.price * quantity;
          const matched = data.find((v) => v.id === currentVoucher.id);

          // Kasus 1: Voucher telah dihapus oleh admin
          if (!matched) {
            setVoucherRealtimeAlert({
              message: `Voucher promo "${currentVoucher.code}" baru saja ditarik atau dihapus oleh admin. Total pembayaran telah disesuaikan.`,
              type: 'warning',
            });
            return null;
          }

          // Kasus 2: Voucher dinonaktifkan oleh admin
          if (!matched.isActive) {
            setVoucherRealtimeAlert({
              message: `Voucher "${matched.code}" telah dinonaktifkan oleh admin. Total pembayaran telah disesuaikan.`,
              type: 'warning',
            });
            return null;
          }

          // Kasus 3: Kuota pemakaian voucher habis
          if (matched.remainingUsage <= 0) {
            setVoucherRealtimeAlert({
              message: `Kuota voucher "${matched.code}" baru saja habis digunakan pembeli lain.`,
              type: 'warning',
            });
            return null;
          }

          // Kasus 4: Periode voucher kadaluarsa
          const now = new Date();
          if (now > new Date(matched.endDate) || now < new Date(matched.startDate)) {
            setVoucherRealtimeAlert({
              message: `Masa berlaku voucher "${matched.code}" telah berakhir.`,
              type: 'warning',
            });
            return null;
          }

          // Hitung ulang nominal diskon jika admin mengubah diskon %, plafon rupiah, atau margin
          const nominalDiscount = Math.round((currentTotal * matched.discountPercent) / 100);
          const maxCap = matched.maxDiscountAmount && matched.maxDiscountAmount > 0 ? matched.maxDiscountAmount : Infinity;
          const estimatedDiscount = Math.min(nominalDiscount, maxCap);
          const newEffectiveDiscount = matched.effectiveDiscount > 0 ? matched.effectiveDiscount : estimatedDiscount;

          if (newEffectiveDiscount !== currentVoucher.effectiveDiscount) {
            setVoucherRealtimeAlert({
              message: `Diskon voucher "${matched.code}" otomatis disesuaikan secara realtime menjadi Rp ${newEffectiveDiscount.toLocaleString('id-ID')}.`,
              type: 'success',
            });
          }

          return {
            ...matched,
            effectiveDiscount: newEffectiveDiscount,
          };
        });
      } catch (err) {
        console.warn("Gagal sinkronisasi voucher realtime:", err);
      } finally {
        if (!isCancelled && !isSilent) {
          setIsLoadingVouchers(false);
        }
      }
    };

    // 1. Sinkronisasi awal
    syncVouchers(false);

    // 2. Hubungkan ke Supabase Realtime WebSocket (Tabel 'vouchers')
    const channel = supabase
      .channel(`realtime:checkout:vouchers:${selectedPackage.id || 'current'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vouchers' },
        (payload) => {
          console.log('⚡ [Realtime Checkout] Update voucher dari Supabase:', payload.eventType);
          syncVouchers(true);
        }
      )
      .subscribe((status) => {
        console.log('⚡ [Realtime Checkout] WebSocket status:', status);
      });

    // 3. BroadcastChannel (Sinkronisasi seketika antar-tab browser lokal <10ms)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        bc = new BroadcastChannel('nara_voucher_sync');
        bc.onmessage = (event) => {
          if (event.data?.type === 'VOUCHER_CHANGED') {
            console.log('⚡ [Realtime Checkout] Broadcast sync diterima');
            syncVouchers(true);
          }
        };
      } catch {}
    }

    // 4. Custom DOM Event (Untuk update dalam 1 window/tab)
    const onCustomEvent = () => {
      syncVouchers(true);
    };
    window.addEventListener('nara:voucher-updated', onCustomEvent);

    // 5. Visibility Change (Saat user kembali ke tab ini)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncVouchers(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 6. Polling interval ringan (setiap 5 detik) sebagai jaminan fallback
    const pollInterval = setInterval(() => {
      syncVouchers(true);
    }, 5000);

    return () => {
      isCancelled = true;
      channel.unsubscribe();
      if (bc) bc.close();
      window.removeEventListener('nara:voucher-updated', onCustomEvent);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearInterval(pollInterval);
    };
  }, [selectedPackage?.id, selectedPackage?.productId, selectedPackage?.providerId, selectedPackage?.price, quantity]);

  // Status antrean checkout (BullMQ Queue Ruang Tunggu)
  interface QueueState {
    ticketId: string;
    position: number;
    estimatedWaitSeconds: number;
    status: 'waiting' | 'processing' | 'completed' | 'failed';
    errorMessage?: string;
    result?: any;
  }
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const hasNavigatedRef = useRef(false);

  // Polling status antrean otomatis setiap 1.2 detik
  useEffect(() => {
    if (!queueState?.ticketId || queueState.status === 'completed' || queueState.status === 'failed') {
      return;
    }

    let isCancelled = false;

    const interval = setInterval(async () => {
      try {
        const statusRes = await getQueueTicketStatus(queueState.ticketId);
        if (isCancelled || hasNavigatedRef.current) return;

        if (statusRes.success && statusRes.data) {
          const current = statusRes.data;

          if (current.status === 'completed' && current.result?.orderNumber) {
            hasNavigatedRef.current = true;
            clearInterval(interval);

            const resData = current.result;
            const productNameWithQty = quantity > 1 
              ? `${selectedPackage?.name} (${quantity}x)` 
              : selectedPackage?.name;
            const expiryParam = resData.payment?.expiryTime ? `&expiry=${encodeURIComponent(resData.payment.expiryTime)}` : '';

            // Update state dengan result lengkap
            setQueueState({
              ticketId: queueState.ticketId,
              status: 'completed',
              position: 0,
              estimatedWaitSeconds: 0,
              result: resData,
            });

            // Langsung eksekusi navigasi ke QRIS tanpa delay setTimeout yang rentan ter-cancel!
            navigate(
              `/payment/${resData.orderNumber}?amount=${resData.totalAmount}&product=${encodeURIComponent(
                productNameWithQty || 'Produk'
              )}&phone=${encodeURIComponent(phone.trim())}&email=${encodeURIComponent(
                email.trim()
              )}&qty=${quantity}${expiryParam}`,
              { state: { orderData: resData }, replace: true }
            );
          } else if (current.status === 'failed') {
            clearInterval(interval);
            setSubmitError(current.errorMessage || 'Gagal memproses pesanan di antrean.');
            setQueueState(null);
            setIsSubmitting(false);
          } else {
            setQueueState((prev) => (prev ? {
              ...prev,
              status: current.status,
              position: current.position,
              estimatedWaitSeconds: current.estimatedWaitSeconds,
            } : null));
          }
        }
      } catch (err: any) {
        console.warn('Gagal polling antrean:', err.message);
      }
    }, 1200);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [queueState?.ticketId, queueState?.status, quantity, selectedPackage?.name, phone, email, navigate]);

  // Otomatis sinkronkan kuantitas agar tidak melebihi stok / saldo akun Premku
  useEffect(() => {
    if (isOutOfStock || isSelectedPkgMaintenance) {
      setQuantity(0);
    } else if (maxAllowedQty > 0) {
      if (quantity > maxAllowedQty) {
        setQuantity(maxAllowedQty);
      } else if (quantity < 1) {
        setQuantity(1);
      }
    } else {
      setQuantity(1);
    }
  }, [maxAllowedQty, isOutOfStock, isSelectedPkgMaintenance, selectedPackageId]);

  // Hanya perbolehkan angka (0-9) dan bersihkan karakter lain + validasi lokal instan
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '');
    setPhone(digitsOnly);
    setSubmitError(null);

    const localCheck = validatePhoneLocal(digitsOnly);
    setPhoneValidation(localCheck);
    setRemoteWaStatus({ checked: false, registered: true });

    if (localCheck.isValid) {
      setIsVerifyingPhoneRemote(true);
    } else {
      setIsVerifyingPhoneRemote(false);
    }
  };

  // Debounced Remote WhatsApp Check ke Backend / Fonnte (600ms)
  useEffect(() => {
    if (!phoneValidation.isValid || !phone.trim()) {
      setIsVerifyingPhoneRemote(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const remoteRes = await validatePhoneWithBackend(phone);
        setRemoteWaStatus({
          checked: true,
          registered: remoteRes.registered,
          message: remoteRes.message,
        });
      } catch {
        setRemoteWaStatus({
          checked: true,
          registered: true,
        });
      } finally {
        setIsVerifyingPhoneRemote(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [phone, phoneValidation.isValid]);

  // Cegah pengetikan huruf atau simbol pada keyboard
  const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Escape'].includes(e.key) ||
      e.ctrlKey || 
      e.metaKey
    ) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  if (!service || !selectedPackage) {
    return (
      <div className="text-center py-20 text-black dark:text-gray-100 max-w-md mx-auto">
        <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[4px_4px_0px_#000] p-8 space-y-4 rounded-2xl">
          <h2 className="text-2xl font-black">Layanan Tidak Ditemukan</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Paket yang Anda pilih tidak valid atau sudah tidak tersedia.</p>
          <button
            onClick={() => navigate('/#categories-filter')}
            className="px-6 py-2.5 bg-brand-blue text-white font-black text-sm border-2 border-black shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer"
          >
            Kembali ke Katalog
          </button>
        </div>
      </div>
    );
  }

  const rawTotalPrice = selectedPackage.price * quantity;
  const discountAmount = selectedVoucher ? selectedVoucher.effectiveDiscount : 0;
  const finalPrice = Math.max(0, rawTotalPrice - discountAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isOutOfStock || isSelectedPkgMaintenance || isSubmitting) return;
    if (quantity > maxAllowedQty || quantity > selectedPackage.stockCount || quantity < 1) {
      setSubmitError(`Kuantitas pembelian tidak boleh melebihi stok yang tersedia (${selectedPackage.stockCount} unit).`);
      return;
    }

    if (!phone.trim()) {
      setSubmitError('Nomor WhatsApp wajib diisi.');
      return;
    }

    const localCheck = validatePhoneLocal(phone.trim());
    if (!localCheck.isValid) {
      setSubmitError(localCheck.message || 'Nomor WhatsApp tidak valid. Pastikan nomor seluler resmi Indonesia (10-13 digit).');
      return;
    }

    if (remoteWaStatus.checked && !remoteWaStatus.registered) {
      setSubmitError(remoteWaStatus.message || 'Nomor ini tidak terdaftar di WhatsApp. Harap gunakan nomor WhatsApp aktif.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const productNameWithQty = quantity > 1 
      ? `${selectedPackage.name} (${quantity}x)` 
      : selectedPackage.name;

    try {
      const effProductId = selectedPackage.productId || 
        (typeof selectedPackage.id === 'number' ? selectedPackage.id : undefined) ||
        (selectedPackage.providerId && !isNaN(Number(selectedPackage.providerId)) ? Number(selectedPackage.providerId) : undefined);

      const orderPayload = {
        productId: effProductId,
        packageId: String(selectedPackage.providerId || selectedPackage.id),
        productName: selectedPackage.name,
        price: selectedPackage.price,
        quantity,
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
        voucherId: selectedVoucher ? selectedVoucher.id : undefined,
        voucherCode: selectedVoucher ? selectedVoucher.code : undefined,
      };

      // 1. Panggil API Checkout (Cerdas: Direct jika sepi, Queue jika ada lonjakan)
      const res = await enqueueBackendOrder(orderPayload);

      // KASUS A: Masuk antrean karena ada lonjakan pembeli lain
      if (res.success && res.queued && res.data?.ticketId) {
        hasNavigatedRef.current = false;
        setQueueState({
          ticketId: res.data.ticketId,
          position: res.data.position || 1,
          estimatedWaitSeconds: res.data.estimatedWaitSeconds || 3,
          status: 'waiting',
        });
        return;
      }

      // KASUS B: Diproses langsung tanpa antrean (hanya 1 pembeli / server senggang)
      if (res.success && (!res.queued || res.data?.orderNumber)) {
        const orderData = res.data;
        if (orderData?.orderNumber) {
          const expiryParam = orderData.payment?.expiryTime ? `&expiry=${encodeURIComponent(orderData.payment.expiryTime)}` : '';
          navigate(
            `/payment/${orderData.orderNumber}?amount=${orderData.totalAmount}&product=${encodeURIComponent(
              productNameWithQty
            )}&phone=${encodeURIComponent(phone.trim())}&email=${encodeURIComponent(
              email.trim()
            )}&qty=${quantity}${expiryParam}`,
            { state: { orderData } }
          );
          return;
        }
      }

      throw new Error(res.message || 'Gagal memproses pesanan QRIS');
    } catch (err: any) {
      console.error('Error saat membuat pesanan:', err);
      setSubmitError(err.message || 'Terjadi kendala saat menghubungi server pembayaran. Silakan coba lagi.');
      setIsSubmitting(false);
      setQueueState(null);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto space-y-6 pb-20 text-black dark:text-gray-100"
    >
      {/* Top Header Bar with Back Button & Step Badge */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-[#1E2333] text-black dark:text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] neo-btn rounded-xl cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>KEMBALI</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-yellow text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] rounded-lg">
          <span>LANGKAH 1 DARI 2</span>
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-black dark:text-white">
          Konfirmasi Pesanan
        </h1>
      </div>

      {/* Warning Banner if Out of Stock or Coming Soon */}
      {isOutOfStock ? (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-200 text-xs font-bold shadow-[3px_3px_0px_#000]">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-black block uppercase text-[11px]">Stok Produk Sedang Habis</span>
            <span>Maaf, stok untuk paket ini sedang kosong. Silakan pilih varian lain atau kembali ke katalog.</span>
          </div>
        </div>
      ) : isSelectedPkgMaintenance ? (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-500 rounded-xl flex items-center gap-3 text-amber-950 dark:text-amber-100 text-xs font-bold shadow-[3px_3px_0px_#000]">
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-black block uppercase text-[11px]">Produk Segera Hadir (Coming Soon)</span>
            <span>Layanan untuk paket ini sedang disiapkan dan akan segera hadir. Pembelian belum dapat diproses saat ini.</span>
          </div>
        </div>
      ) : null}
      
      {/* Card 1: Ringkasan Paket & Kuantitas */}
      <div className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_0px_#000000] rounded-2xl p-4 sm:p-6 space-y-4">
        {/* Header Strip */}
        <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-black dark:text-white">
            <Sparkles className="w-4 h-4 text-brand-blue" />
            <span>RINGKASAN PAKET</span>
          </div>
          {isOutOfStock ? (
            <span className="text-[10px] font-black px-2.5 py-1 bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-400 rounded-md">
              ● STOK KOSONG
            </span>
          ) : isSelectedPkgMaintenance ? (
            <span className="text-[10px] font-black px-2.5 py-1 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-500 rounded-md flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-700 dark:text-amber-300" />
              <span>COMING SOON</span>
            </span>
          ) : (
            <span className="text-[10px] font-black px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-black dark:border-gray-700 rounded-md">
              ● PROSES INSTAN
            </span>
          )}
        </div>



        {/* Selected Product Highlight Box / Card */}
        <div className={`p-3.5 sm:p-4 border-2 rounded-2xl flex flex-col gap-3.5 transition-all relative overflow-hidden ${
          isOutOfStock 
            ? 'opacity-40 grayscale bg-gray-100 dark:bg-gray-800/80 border-gray-400 dark:border-gray-700 cursor-not-allowed pointer-events-none select-none shadow-none' 
            : isSelectedPkgMaintenance
            ? 'bg-amber-50/30 dark:bg-[#1E2333] border-amber-500 shadow-[3px_3px_0px_#000]'
            : 'bg-[#FAF8F5] dark:bg-[#1E2333] border-black dark:border-gray-700 shadow-[3px_3px_0px_#000]'
        }`}>
          <div className="flex items-start gap-3 sm:gap-3.5">
            <div className="p-2 sm:p-2.5 bg-white dark:bg-[#151923] border-2 border-black dark:border-gray-700 rounded-xl shrink-0 shadow-[2px_2px_0px_#000]">
              <AppLogo id={service.iconId} imageUrl={selectedPackage.imageUrl || service.imageUrl} className="w-12 h-12 sm:w-14 sm:h-14" />
            </div>
            
            <div className="flex-grow min-w-0 space-y-1.5">
              {/* Category & Status Badge Row (In-flow flex layout to prevent any overlapping) */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-blue truncate">
                  {service.name} • {service.category}
                </span>

                {isOutOfStock ? (
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-rose-600 text-white rounded-md shrink-0 border border-black shadow-[1px_1px_0px_#000]">
                    ✕ HABIS
                  </span>
                ) : isSelectedPkgMaintenance ? (
                  <span className="px-2 py-0.5 text-[9px] font-black uppercase bg-amber-400 text-amber-950 rounded-md shrink-0 border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5 text-amber-900" />
                    <span>COMING SOON</span>
                  </span>
                ) : null}
              </div>

              {/* Product Title - Clean, wrapping naturally with no obstruction */}
              <h3 className="font-black text-sm sm:text-base text-black dark:text-white leading-snug">
                {selectedPackage.name}
              </h3>

              {/* Package Type & Duration Tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-100 text-cyan-800 border border-black/30 rounded-md">
                  {selectedPackage.type}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-100 text-gray-800 border border-black/30 rounded-md">
                  {selectedPackage.duration}
                </span>
                {!isOutOfStock && !isSelectedPkgMaintenance && (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md">
                    ✓ READY ({selectedPackage.stockCount} UNIT)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Product Description & Service Details */}
          <div className="pt-3 border-t border-dashed border-gray-300 dark:border-gray-700 space-y-2.5">
            {/* Package Specific Terms & Information / Product Description Box */}
            {boxDescription && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  <Sparkles className="w-3.5 h-3.5 text-brand-pink shrink-0" />
                  <span>{boxTitle}</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium bg-white/90 dark:bg-black/25 p-3 rounded-xl border border-black/10 dark:border-gray-700 whitespace-pre-line">
                  {boxDescription}
                </p>
              </div>
            )}

            {/* 3. Guarantees & Features Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px] font-bold text-gray-700 dark:text-gray-300">
              <div className="p-2 bg-white/70 dark:bg-black/20 rounded-lg border border-black/10 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Garansi</span>
              </div>
              <div className="p-2 bg-white/70 dark:bg-black/20 rounded-lg border border-black/10 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                <span className="truncate">Legal & Aman</span>
              </div>
              <div className="p-2 bg-white/70 dark:bg-black/20 rounded-lg border border-black/10 dark:border-gray-700 flex items-center gap-1.5 shadow-sm col-span-2 sm:col-span-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Proses Cepat</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quantity Stepper Row */}
        <div className={`pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-[#181C2A] ${
          isOutOfStock || isSelectedPkgMaintenance ? 'opacity-50 pointer-events-none' : ''
        }`}>
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-black dark:text-white block">
              Jumlah Pembelian
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold block">
              Rp {selectedPackage.price.toLocaleString('id-ID')} / unit
            </span>
            {isOutOfStock ? (
              <span className="text-[10px] text-rose-600 dark:text-rose-400 font-extrabold block mt-0.5">
                Stok habis (tidak dapat dipesan)
              </span>
            ) : isSelectedPkgMaintenance ? (
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-extrabold block mt-0.5">
                Pembelian dinonaktifkan (segera hadir / coming soon)
              </span>
            ) : maxAllowedQty > 0 ? (
              <span className="text-[10px] text-brand-blue dark:text-cyan-400 font-extrabold block mt-0.5">
                Maksimal {maxAllowedQty} unit
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button 
              type="button" 
              onClick={() => setQuantity(prev => (prev > 1 ? prev - 1 : 1))}
              disabled={isOutOfStock || isSelectedPkgMaintenance || quantity <= 1}
              aria-label="Kurangi jumlah pesanan"
              className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border-2 border-black dark:border-gray-700 font-black text-sm flex items-center justify-center transition-all ${
                quantity <= 1 || isOutOfStock || isSelectedPkgMaintenance
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 shadow-none cursor-not-allowed' 
                  : 'bg-white dark:bg-[#1E2333] text-black dark:text-white hover:bg-gray-100 shadow-[2px_2px_0px_#000] cursor-pointer neo-btn active:translate-x-0.5 active:translate-y-0.5'
              }`}
            >
              <Minus className="w-4 h-4" />
            </button>

            <div className="min-w-[44px] h-11 px-3 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 font-black text-base flex items-center justify-center shadow-[2px_2px_0px_#000] rounded-xl font-mono">
              {quantity}
            </div>

            <button 
              type="button" 
              onClick={() => setQuantity(prev => (prev < maxAllowedQty ? prev + 1 : prev))}
              disabled={isOutOfStock || isSelectedPkgMaintenance || quantity >= maxAllowedQty}
              aria-label="Tambah jumlah pesanan"
              title={quantity >= maxAllowedQty ? `Maksimal pembelian adalah ${maxAllowedQty} unit` : 'Tambah jumlah pesanan'}
              className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border-2 font-black text-sm flex items-center justify-center transition-all ${
                isOutOfStock || isSelectedPkgMaintenance || quantity >= maxAllowedQty
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 border-gray-400 shadow-none cursor-not-allowed'
                  : 'bg-brand-blue text-white hover:bg-blue-700 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] cursor-pointer neo-btn active:translate-x-0.5 active:translate-y-0.5'
              }`}
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================
            SECTION VOUCHER PROMO (PILIH VOUCHER DARI ADMIN)
           ======================================================== */}
        <div className={`pt-2 border-t border-dashed border-gray-300 dark:border-gray-700 ${
          isOutOfStock || isSelectedPkgMaintenance ? 'opacity-50 pointer-events-none' : ''
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-black dark:text-white">
              <Ticket className="w-4 h-4 text-brand-pink" />
              <span>Voucher Diskon Toko</span>
            </div>
            {availableVouchers.filter(v => v.isEligible && v.effectiveDiscount > 0).length > 0 && !selectedVoucher && (
              <span className="text-[10px] font-black px-2 py-0.5 bg-brand-yellow text-black border border-black rounded shadow-[1px_1px_0px_#000]">
                Tersedia {availableVouchers.filter(v => v.isEligible && v.effectiveDiscount > 0).length} Voucher
              </span>
            )}
          </div>

          {/* Notifikasi Realtime Banner */}
          <AnimatePresence>
            {voucherRealtimeAlert && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                className={`p-2.5 mb-2.5 rounded-xl border-2 flex items-start justify-between gap-2 text-xs font-bold ${
                  voucherRealtimeAlert.type === 'warning'
                    ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-400 text-rose-900 dark:text-rose-200 shadow-[2px_2px_0px_#f43f5e]'
                    : voucherRealtimeAlert.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-400 text-emerald-900 dark:text-emerald-200 shadow-[2px_2px_0px_#10b981]'
                    : 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 text-blue-900 dark:text-blue-200 shadow-[2px_2px_0px_#3b82f6]'
                }`}
              >
                <div className="flex items-start gap-1.5 min-w-0">
                  <span className="text-sm shrink-0">⚡</span>
                  <span className="leading-tight">{voucherRealtimeAlert.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setVoucherRealtimeAlert(null)}
                  className="p-0.5 text-gray-500 hover:text-black dark:hover:text-white shrink-0 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {!selectedVoucher ? (
            /* STATE 1: BELUM MEMILIH VOUCHER -> TOMBOL PILIH VOUCHER */
            <button
              type="button"
              onClick={() => setIsVoucherModalOpen(true)}
              disabled={isOutOfStock || isSelectedPkgMaintenance}
              className="w-full p-3.5 bg-[#FAF8F5] dark:bg-[#1E2333] hover:bg-gray-100 dark:hover:bg-[#252b3d] border-2 border-black dark:border-gray-700 rounded-xl shadow-[2px_2px_0px_#000] neo-btn flex items-center justify-between gap-3 text-left transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-brand-pink/20 dark:bg-brand-pink/30 border border-black dark:border-gray-600 flex items-center justify-center shrink-0">
                  <Percent className="w-4 h-4 text-brand-pink" />
                </div>
                <div className="min-w-0">
                  <span className="font-black text-xs text-black dark:text-white block group-hover:text-brand-blue transition-colors">
                    Pilih Voucher Diskon
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold block truncate">
                    {isLoadingVouchers
                      ? "Memeriksa voucher aktif..."
                      : availableVouchers.filter(v => v.isEligible && v.effectiveDiscount > 0).length > 0
                      ? "Klik untuk memilih voucher potongan harga"
                      : "Pilih dari voucher aktif toko"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#151923] border border-black dark:border-gray-600 rounded-lg text-[10px] font-black uppercase shrink-0 shadow-[1px_1px_0px_#000]">
                <span>PILIH</span>
                <ChevronRight className="w-3 h-3" />
              </div>
            </button>
          ) : (
            /* STATE 2: VOUCHER SUDAH DIPILIH -> TAMPILKAN KARTU VOUCHER */
            <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/40 border-2 border-emerald-500 rounded-xl space-y-2 shadow-[3px_3px_0px_#000] relative">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-black text-xs text-emerald-900 dark:text-emerald-200 bg-white dark:bg-[#151923] px-2 py-0.5 rounded border border-emerald-400">
                      {selectedVoucher.code}
                    </span>
                    <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-600 text-white rounded">
                      {selectedVoucher.discountPercent}% OFF
                    </span>
                  </div>
                  <div className="font-black text-xs text-emerald-950 dark:text-emerald-100 truncate">
                    {selectedVoucher.name}
                  </div>
                  <div className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300">
                    Potongan Harga: -Rp {discountAmount.toLocaleString('id-ID')}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsVoucherModalOpen(true)}
                    className="px-2 py-1 bg-white dark:bg-[#181C2A] text-black dark:text-white border border-black dark:border-gray-700 text-[10px] font-black uppercase rounded neo-btn cursor-pointer"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedVoucher(null)}
                    aria-label="Hapus voucher"
                    className="p-1 bg-white dark:bg-[#181C2A] text-rose-600 border border-black dark:border-gray-700 text-[10px] font-black rounded neo-btn cursor-pointer"
                    title="Batalkan Voucher"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Notice jika diskon dibatasi oleh batas margin produk (Anti-Rugi) */}
              {selectedVoucher.isCappedByMargin && (
                <div className="pt-1 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>Proteksi Margin: Diskon dibatasi maks. Rp {discountAmount.toLocaleString('id-ID')} agar tidak melebihi margin modal produk.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Total Price Strip */}
        <div className={`p-3.5 border-2 rounded-xl flex flex-col gap-2 transition-all ${
          isOutOfStock || isSelectedPkgMaintenance
            ? 'opacity-50 bg-gray-100 dark:bg-gray-800 border-gray-400 shadow-none'
            : 'bg-brand-blue-soft/40 dark:bg-brand-blue/10 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000]'
        }`}>
          {selectedVoucher && discountAmount > 0 && (
            <div className="space-y-1 pb-1.5 border-b border-black/10 dark:border-gray-700 text-xs font-bold">
              <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                <span>Subtotal ({quantity}x item)</span>
                <span>Rp {rawTotalPrice.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-black">
                <span>Diskon Voucher ({selectedVoucher.code})</span>
                <span>-Rp {discountAmount.toLocaleString('id-ID')}</span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="font-black text-xs uppercase tracking-wide text-gray-700 dark:text-gray-300 block">
                Total Pembayaran
              </span>
              {quantity > 1 && !isOutOfStock && !isSelectedPkgMaintenance && !selectedVoucher && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                  {quantity}x paket @ Rp {selectedPackage.price.toLocaleString('id-ID')}
                </span>
              )}
            </div>
            <span className={`text-xl sm:text-2xl font-black ${
              isOutOfStock || isSelectedPkgMaintenance ? 'text-gray-500' : 'text-brand-blue'
            }`}>
              Rp {finalPrice.toLocaleString('id-ID')}
            </span>
          </div>
        </div>
      </div>

      {/* Card 2: Form Kontak Penerima */}
      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#181C2A] border-2 border-black dark:border-gray-700 shadow-[5px_5px_0px_0px_#000000] rounded-2xl p-4 sm:p-6 space-y-5">
        <div className="border-b-2 border-black dark:border-gray-700 pb-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand-blue" />
            <h2 className="text-xs sm:text-sm font-black text-black dark:text-white uppercase tracking-wider">
              Nomor WhatsApp Penerima
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-1">
            Akses akun akan otomatis dikirim ke nomor ini.
          </p>
        </div>
        
        {/* WhatsApp Input Field with Provider Badge & Fonnte Verification */}
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <label className="block text-xs font-black uppercase text-black dark:text-white">
              Nomor WhatsApp Aktif <span className="text-brand-pink">*</span>
            </label>
            
            {/* Live Indonesian Operator Badge */}
            {phoneValidation.provider && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-400 rounded-md text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>{phoneValidation.provider}</span>
                <span className="text-[9px] opacity-75 font-mono">({phone.length} Digit)</span>
              </span>
            )}
          </div>
          
          <div className="relative flex items-center">
            <input 
              required
              disabled={isOutOfStock || isSelectedPkgMaintenance || isSubmitting}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={14}
              placeholder="081234567890"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
              className={`w-full border-2 py-3 pl-4 pr-11 text-sm font-bold focus:outline-none rounded-xl font-mono tracking-wide ${
                isOutOfStock || isSelectedPkgMaintenance || isSubmitting
                  ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 text-gray-400 cursor-not-allowed'
                  : phone.length >= 4 && !phoneValidation.isValid
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-500 text-black dark:text-white focus:ring-2 focus:ring-rose-400 shadow-[2px_2px_0px_#f43f5e]'
                  : phoneValidation.isValid
                  ? 'bg-[#FAF8F5] dark:bg-[#1E2333] border-emerald-500 text-black dark:text-white focus:ring-2 focus:ring-emerald-400 shadow-[2px_2px_0px_#10b981]'
                  : 'bg-[#FAF8F5] dark:bg-[#1E2333] border-black dark:border-gray-700 text-black dark:text-white focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000] placeholder:text-gray-400 dark:placeholder:text-gray-500'
              }`}
            />

            {/* Input Status Icon */}
            <div className="absolute right-3.5 flex items-center pointer-events-none">
              {isVerifyingPhoneRemote ? (
                <div title="Memeriksa WhatsApp...">
                  <Loader2 className="w-4 h-4 animate-spin text-brand-blue" />
                </div>
              ) : phoneValidation.isValid && remoteWaStatus.checked && remoteWaStatus.registered ? (
                <div title="Terverifikasi aktif di WhatsApp">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : phone.length >= 4 && !phoneValidation.isValid ? (
                <div title="Format nomor tidak valid">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
              ) : null}
            </div>
          </div>

          {/* Validation Feedback & Warnings */}
          {phone.length > 0 && !phoneValidation.isValid ? (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{phoneValidation.message}</span>
            </div>
          ) : remoteWaStatus.checked && !remoteWaStatus.registered ? (
            <div className="flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-300 font-bold bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-xl border-2 border-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{remoteWaStatus.message || 'Nomor ini tidak terdaftar di WhatsApp. Harap gunakan nomor WhatsApp aktif.'}</span>
            </div>
          ) : isVerifyingPhoneRemote ? (
            <div className="flex items-center gap-1.5 text-[11px] text-brand-blue font-bold">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>Memeriksa status akun WhatsApp...</span>
            </div>
          ) : phoneValidation.isValid ? (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Nomor seluler valid ({phoneValidation.provider}) &amp; siap menerima kredensial akun.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Wajib nomor aktif Indonesia.</span>
            </div>
          )}
        </div>

        {/* Optional Email Input Field
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-black uppercase text-black dark:text-white">
              Email Penerima <span className="text-gray-400 font-normal normal-case">(Opsional)</span>
            </label>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cadangan</span>
          </div>
          
          <input 
            disabled={isOutOfStock || isSelectedPkgMaintenance || isSubmitting}
            type="email"
            placeholder="contoh@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`w-full border-2 py-3 px-4 text-sm font-bold focus:outline-none rounded-xl tracking-wide ${
              isOutOfStock || isSelectedPkgMaintenance || isSubmitting
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 text-gray-400 cursor-not-allowed'
                : 'bg-[#FAF8F5] dark:bg-[#1E2333] border-black dark:border-gray-700 text-black dark:text-white focus:ring-2 focus:ring-brand-blue shadow-[2px_2px_0px_#000] placeholder:text-gray-400 dark:placeholder:text-gray-500'
            }`}
          />
        </div> */}

        {/* Error Banner */}
        {submitError && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-500 rounded-xl flex items-center gap-3 text-rose-800 dark:text-rose-200 text-xs font-bold shadow-[3px_3px_0px_#000]">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <p>{submitError}</p>
          </div>
        )}

        {/* Security & Guarantee Note */}
        <div className="p-3 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 rounded-xl flex items-center gap-3 shadow-[2px_2px_0px_#000]">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 border border-black dark:border-gray-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="text-[11px] sm:text-xs text-gray-700 dark:text-gray-300 font-semibold leading-relaxed">
            Data Anda terenkripsi aman. Pembayaran QRIS diproses resmi dan terlindungi dengan sistem keamanan otomatis.
          </p>
        </div>

        {/* Submit CTA Button */}
        <button 
          type="submit"
          disabled={isOutOfStock || isSelectedPkgMaintenance || isSubmitting}
          className={`w-full py-3.5 sm:py-4 font-black text-xs sm:text-sm uppercase tracking-wider border-2 rounded-xl flex items-center justify-center gap-2 transition-all ${
            isOutOfStock
              ? 'bg-gray-300 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-400 dark:border-gray-700 shadow-none cursor-not-allowed opacity-60 pointer-events-none'
              : isSelectedPkgMaintenance
              ? 'bg-amber-200 dark:bg-amber-900/60 text-amber-950 dark:text-amber-100 border-amber-500 shadow-none cursor-not-allowed opacity-85 select-none'
              : isSubmitting
              ? 'bg-blue-400 text-white border-black cursor-wait shadow-none'
              : 'bg-brand-blue hover:bg-blue-700 text-white border-black shadow-[4px_4px_0px_#000] neo-btn cursor-pointer'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>MEMPROSES TRANSAKSI QRIS...</span>
            </>
          ) : isOutOfStock ? (
            <>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>STOK PRODUK SEDANG HABIS</span>
            </>
          ) : isSelectedPkgMaintenance ? (
            <>
              <Clock className="w-4 h-4 text-amber-900 dark:text-amber-200" />
              <span>PRODUK COMING SOON</span>
            </>
          ) : (
            <>
              <QrCode className="w-4 h-4" />
              <span>BAYAR DENGAN QRIS SEKARANG</span>
            </>
          )}
        </button>
      </form>

      {/* ========================================================
          RUANG TUNGGU ANTREAN (MODAL NEO-BRUTALIST QUEUE SYSTEM)
         ======================================================== */}
      {queueState && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-white dark:bg-[#1E2333] border-4 border-black dark:border-gray-600 rounded-2xl shadow-[8px_8px_0px_#000] p-6 space-y-5 text-center text-black dark:text-white"
          >
            {/* Header Badge */}
            <div className="flex justify-center">
              {queueState.status === 'completed' ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-400 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>TRANSAKSI SIAP!</span>
                </div>
              ) : queueState.status === 'processing' ? (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-blue text-white font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SEDANG MEMPROSES...</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-brand-yellow text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] rounded-xl">
                  <Users className="w-4 h-4" />
                  <span>RUANG TUNGGU ANTREAN</span>
                </div>
              )}
            </div>

            {/* Title & Description */}
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase tracking-tight">
                {queueState.status === 'completed'
                  ? 'Pesanan Siap Dibayar!'
                  : queueState.status === 'processing'
                  ? 'Menyiapkan Pembayaran QRIS'
                  : 'Pesanan Anda Dalam Antrean'}
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 font-bold">
                {queueState.status === 'completed'
                  ? 'Mengalihkan Anda ke halaman kode QRIS...'
                  : queueState.status === 'processing'
                  ? 'Sedang mengunci alokasi stok dan generate transaksi Midtrans...'
                  : 'Sistem antrean cerdas mengamankan transaksi Anda dari lonjakan server.'}
              </p>
            </div>

            {/* Queue Position Box */}
            <div className="p-5 bg-[#FAF8F5] dark:bg-[#141824] border-2 border-black dark:border-gray-700 rounded-xl space-y-3 shadow-[3px_3px_0px_#000]">
              <div className="text-[11px] font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Nomor Antrean Anda
              </div>
              <div className="text-4xl font-black tracking-tight text-brand-blue dark:text-blue-400 font-mono">
                {queueState.status === 'completed' ? 'SELESAI' : `#${queueState.position}`}
              </div>

              {/* Progress bar visual */}
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-3 rounded-full border border-black dark:border-gray-700 overflow-hidden relative">
                <motion.div
                  className={`h-full ${
                    queueState.status === 'completed'
                      ? 'bg-emerald-500'
                      : queueState.status === 'processing'
                      ? 'bg-brand-blue'
                      : 'bg-brand-yellow'
                  }`}
                  animate={{
                    width:
                      queueState.status === 'completed'
                        ? '100%'
                        : queueState.status === 'processing'
                        ? '85%'
                        : `${Math.max(15, 100 - queueState.position * 15)}%`,
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Est. Tunggu: ~{queueState.estimatedWaitSeconds}s
                </span>
                <span className="font-mono text-[10px] text-gray-400">
                  ID: {queueState.ticketId.slice(0, 14)}...
                </span>
              </div>
            </div>

            {/* Action button if completed (Garansi anti-stuck) */}
            {queueState.status === 'completed' && queueState.result?.orderNumber && (
              <button
                type="button"
                onClick={() => {
                  const resData = queueState.result;
                  const productNameWithQty = quantity > 1 
                    ? `${selectedPackage?.name} (${quantity}x)` 
                    : selectedPackage?.name;
                  const expiryParam = resData.payment?.expiryTime ? `&expiry=${encodeURIComponent(resData.payment.expiryTime)}` : '';
                  navigate(
                    `/payment/${resData.orderNumber}?amount=${resData.totalAmount}&product=${encodeURIComponent(
                      productNameWithQty || 'Produk'
                    )}&phone=${encodeURIComponent(phone.trim())}&email=${encodeURIComponent(
                      email.trim()
                    )}&qty=${quantity}${expiryParam}`,
                    { state: { orderData: resData }, replace: true }
                  );
                }}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase tracking-wider border-2 border-black rounded-xl shadow-[3px_3px_0px_#000] neo-btn cursor-pointer flex items-center justify-center gap-2"
              >
                <span>LANJUT KE PEMBAYARAN SEKARANG</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* Important Info Note */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 rounded-xl text-left text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <span className="text-base leading-none">💡</span>
              <p className="leading-relaxed text-[11px]">
                Memproses antrean secara bergantian agar pesanan tidak tabrakan. 
                <strong className="block mt-0.5 font-bold">Harap tidak me-refresh atau menutup tab browser ini.</strong>
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ========================================================
          MODAL PILIH VOUCHER PROMO (USER HANYA DAPAT MEMILIH)
         ======================================================== */}
      {isVoucherModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white dark:bg-[#181C2A] border-4 border-black dark:border-gray-600 rounded-2xl shadow-[8px_8px_0px_#000] p-5 sm:p-6 space-y-4 my-8 text-black dark:text-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-brand-pink" />
                <h3 className="text-base sm:text-lg font-black uppercase tracking-tight">
                  Pilih Voucher Promo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Vouchers */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {isLoadingVouchers ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-blue" />
                  <p className="text-xs font-bold text-gray-500">Memeriksa voucher yang tersedia...</p>
                </div>
              ) : availableVouchers.length === 0 ? (
                <div className="py-10 text-center space-y-2 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                  <Ticket className="w-8 h-8 mx-auto text-gray-400" />
                  <div className="font-black text-sm">Tidak Ada Voucher Tersedia</div>
                  <p className="text-xs text-gray-500">Saat ini belum ada voucher promo aktif untuk produk ini.</p>
                </div>
              ) : (
                availableVouchers.map((v) => {
                  const isSelected = selectedVoucher?.id === v.id;
                  const nominalDiscount = Math.round((rawTotalPrice * v.discountPercent) / 100);
                  const maxCap = v.maxDiscountAmount && v.maxDiscountAmount > 0 ? v.maxDiscountAmount : Infinity;
                  const estimatedDiscount = Math.min(nominalDiscount, maxCap);
                  const effectiveDiscount = v.effectiveDiscount > 0 ? v.effectiveDiscount : estimatedDiscount;
                  const isEligible = v.isEligible && (v.effectiveDiscount > 0 || rawTotalPrice >= (v.minPurchaseAmount || 0));

                  return (
                    <div
                      key={v.id}
                      className={`p-3.5 sm:p-4 border-2 rounded-xl transition-all relative space-y-2.5 ${
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 shadow-[3px_3px_0px_#10b981]"
                          : isEligible
                          ? "bg-[#FAF8F5] dark:bg-[#1E2333] border-black dark:border-gray-700 hover:border-brand-blue shadow-[2px_2px_0px_#000]"
                          : "bg-gray-100 dark:bg-gray-800/60 border-gray-300 dark:border-gray-700 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-xs px-2 py-0.5 bg-white dark:bg-[#151923] border border-black dark:border-gray-600 rounded">
                              {v.code}
                            </span>
                            <span className="px-2 py-0.5 bg-brand-pink text-white text-[10px] font-black uppercase rounded border border-black shadow-[1px_1px_0px_#000]">
                              {v.discountPercent}% DISKON
                            </span>
                          </div>
                          <h4 className="font-black text-xs sm:text-sm text-black dark:text-white leading-snug">
                            {v.name}
                          </h4>
                          {v.description && (
                            <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">
                              {v.description}
                            </p>
                          )}
                        </div>

                        {/* Potongan nominal */}
                        {isEligible && effectiveDiscount > 0 ? (
                          <div className="text-right shrink-0">
                            <span className="text-[10px] uppercase font-black text-gray-500 block">HEMAT</span>
                            <span className="font-black text-sm text-emerald-600 dark:text-emerald-400">
                              -Rp {effectiveDiscount.toLocaleString('id-ID')}
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Terms & Info Row */}
                      <div className="pt-2 border-t border-dashed border-gray-300 dark:border-gray-700 flex flex-wrap items-center justify-between gap-2 text-[10px] font-bold text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>Sisa Kuota: {v.remainingUsage}x</span>
                          <span>•</span>
                          <span>Berlaku s/d {new Date(v.endDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>

                        {v.isCappedByMargin && isEligible && (
                          <div className="w-full text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1 font-semibold">
                            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>Proteksi Margin: Diskon disesuaikan ke batas aman Rp {effectiveDiscount.toLocaleString('id-ID')}.</span>
                          </div>
                        )}

                        {!isEligible && (
                          <div className="w-full text-[10px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{v.ineligibilityReason || "Tidak memenuhi syarat untuk pesanan ini"}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Button */}
                      <div className="pt-1 flex justify-end">
                        {isSelected ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVoucher(null);
                              setIsVoucherModalOpen(false);
                            }}
                            className="px-4 py-1.5 bg-rose-50 text-rose-700 border border-rose-400 rounded-lg text-xs font-black uppercase cursor-pointer neo-btn"
                          >
                            Batalkan Pilihan
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!isEligible}
                            onClick={() => {
                              setSelectedVoucher({
                                ...v,
                                effectiveDiscount,
                              });
                              setIsVoucherModalOpen(false);
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                              isEligible
                                ? "bg-brand-blue hover:bg-blue-700 text-white border-2 border-black shadow-[2px_2px_0px_#000] neo-btn"
                                : "bg-gray-200 dark:bg-gray-800 text-gray-400 border border-gray-400 cursor-not-allowed"
                            }`}
                          >
                            Gunakan Voucher
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t-2 border-black dark:border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setIsVoucherModalOpen(false)}
                className="px-5 py-2.5 bg-white dark:bg-[#1E2333] text-black dark:text-white font-black text-xs uppercase tracking-wider border-2 border-black dark:border-gray-700 rounded-xl shadow-[2px_2px_0px_#000] cursor-pointer neo-btn"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
