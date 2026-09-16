import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLiveService } from '../lib/useLiveCatalog';
import { usePremkuBalance } from '../lib/usePremkuBalance';
import { 
  ArrowLeft, 
  ShieldCheck, 
  QrCode, 
  Plus, 
  Minus, 
  Phone, 
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Loader2
} from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { createBackendOrder } from '../lib/api';
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

  const totalPrice = selectedPackage.price * quantity;

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
      // Panggil backend API untuk membuat pesanan dan charge QRIS Midtrans Core API
      const res = await createBackendOrder({
        productId: typeof selectedPackage.id === 'number' ? selectedPackage.id : undefined,
        packageId: String(selectedPackage.providerId || selectedPackage.id),
        productName: selectedPackage.name,
        price: selectedPackage.price,
        quantity,
        customerPhone: phone.trim(),
        customerEmail: email.trim() || undefined,
      });

      if (res.success && res.data.orderNumber) {
        // Navigasi ke halaman pembayaran QRIS dengan orderNumber dari backend
        const expiryParam = res.data.payment?.expiryTime ? `&expiry=${encodeURIComponent(res.data.payment.expiryTime)}` : '';
        navigate(
          `/payment/${res.data.orderNumber}?amount=${res.data.totalAmount}&product=${encodeURIComponent(
            productNameWithQty
          )}&phone=${encodeURIComponent(phone.trim())}&email=${encodeURIComponent(
            email.trim()
          )}&qty=${quantity}${expiryParam}`,
          { state: { orderData: res.data } }
        );
      } else {
        throw new Error(res.message || 'Gagal membuat pesanan QRIS');
      }
    } catch (err: any) {
      console.error('Error saat membuat pesanan:', err);
      setSubmitError(err.message || 'Terjadi kendala saat menghubungi server pembayaran. Silakan coba lagi.');
      setIsSubmitting(false);
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

      {/* Warning Banner if Out of Stock or Maintenance */}
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
          <Wrench className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <span className="font-black block uppercase text-[11px]">Produk Sedang Maintenance</span>
            <span>Layanan untuk paket ini sedang dalam masa pemeliharaan sistem. Pembelian belum dapat diproses saat ini.</span>
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
              <Wrench className="w-3 h-3 text-amber-700" />
              <span>MAINTENANCE</span>
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
                    <Wrench className="w-2.5 h-2.5 text-amber-900" />
                    <span>MAINTENANCE</span>
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
            {/* 1. Main Service / Product Description */}

            {/* 2. Package Specific Terms & Information */}
            {selectedPackage.description && selectedPackage.description !== service.description && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  <Sparkles className="w-3.5 h-3.5 text-brand-pink shrink-0" />
                  <span>Ketentuan Paket ({selectedPackage.name}):</span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-medium bg-white/90 dark:bg-black/25 p-3 rounded-xl border border-black/10 dark:border-gray-700 whitespace-pre-line">
                  {selectedPackage.description}
                </p>
              </div>
            )}

            {/* 3. Guarantees & Features Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px] font-bold text-gray-700 dark:text-gray-300">
              <div className="p-2 bg-white/70 dark:bg-black/20 rounded-lg border border-black/10 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Garansi Penuh</span>
              </div>
              <div className="p-2 bg-white/70 dark:bg-black/20 rounded-lg border border-black/10 dark:border-gray-700 flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                <span className="truncate">Legal & Aman</span>
              </div>
              <div className="p-2 bg-white/70 dark:bg-black/20 rounded-lg border border-black/10 dark:border-gray-700 flex items-center gap-1.5 shadow-sm col-span-2 sm:col-span-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">Proses Cepat via WA</span>
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
                Pembelian dinonaktifkan (sedang maintenance)
              </span>
            ) : maxAllowedQty > 0 ? (
              <span className="text-[10px] text-brand-blue dark:text-cyan-400 font-extrabold block mt-0.5">
                Maksimal {maxAllowedQty} unit
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button 
              type="button" 
              onClick={() => setQuantity(prev => (prev > 1 ? prev - 1 : 1))}
              disabled={isOutOfStock || isSelectedPkgMaintenance || quantity <= 1}
              aria-label="Kurangi Jumlah"
              className={`w-8 h-8 rounded-lg border-2 border-black dark:border-gray-700 font-black text-sm flex items-center justify-center transition-all ${
                quantity <= 1 || isOutOfStock || isSelectedPkgMaintenance
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-gray-300 dark:border-gray-800 shadow-none cursor-not-allowed' 
                  : 'bg-white dark:bg-[#1E2333] text-black dark:text-white hover:bg-gray-100 shadow-[2px_2px_0px_#000] cursor-pointer neo-btn'
              }`}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <div className="w-10 h-8 bg-white dark:bg-[#1E2333] border-2 border-black dark:border-gray-700 font-black text-sm flex items-center justify-center shadow-[2px_2px_0px_#000] rounded-lg">
              {quantity}
            </div>

            <button 
              type="button" 
              onClick={() => setQuantity(prev => (prev < maxAllowedQty ? prev + 1 : prev))}
              disabled={isOutOfStock || isSelectedPkgMaintenance || quantity >= maxAllowedQty}
              aria-label="Tambah Jumlah"
              title={quantity >= maxAllowedQty ? `Maksimal pembelian adalah ${maxAllowedQty} unit` : 'Tambah jumlah'}
              className={`w-8 h-8 rounded-lg border-2 font-black text-sm flex items-center justify-center transition-all ${
                isOutOfStock || isSelectedPkgMaintenance || quantity >= maxAllowedQty
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 border-gray-400 shadow-none cursor-not-allowed'
                  : 'bg-brand-blue text-white hover:bg-blue-700 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000] cursor-pointer neo-btn'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Total Price Strip */}
        <div className={`p-3.5 border-2 rounded-xl flex justify-between items-center transition-all ${
          isOutOfStock || isSelectedPkgMaintenance
            ? 'opacity-50 bg-gray-100 dark:bg-gray-800 border-gray-400 shadow-none'
            : 'bg-brand-blue-soft/40 dark:bg-brand-blue/10 border-2 border-black dark:border-gray-700 shadow-[2px_2px_0px_#000]'
        }`}>
          <div className="space-y-0.5">
            <span className="font-black text-xs uppercase tracking-wide text-gray-700 dark:text-gray-300 block">
              Total Pembayaran
            </span>
            {quantity > 1 && !isOutOfStock && !isSelectedPkgMaintenance && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-semibold">
                {quantity}x paket @ Rp {selectedPackage.price.toLocaleString('id-ID')}
              </span>
            )}
          </div>
          <span className={`text-xl sm:text-2xl font-black ${
            isOutOfStock || isSelectedPkgMaintenance ? 'text-gray-500' : 'text-brand-blue'
          }`}>
            Rp {totalPrice.toLocaleString('id-ID')}
          </span>
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
              <Wrench className="w-4 h-4 text-amber-900 dark:text-amber-200" />
              <span>PRODUK SEDANG MAINTENANCE</span>
            </>
          ) : (
            <>
              <QrCode className="w-4 h-4" />
              <span>BAYAR DENGAN QRIS SEKARANG</span>
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
