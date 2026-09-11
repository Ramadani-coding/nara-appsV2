import { useState, useEffect, useCallback } from 'react';
import { fetchPremkuBalance, type PremkuBalanceData } from './api';

export function usePremkuBalance() {
  const [balanceData, setBalanceData] = useState<PremkuBalanceData>(() => {
    // 1. Cek query parameter di browser (?saldo=... atau ?mock_saldo=...)
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlSaldo = urlParams.get('saldo') || urlParams.get('mock_saldo');
        if (urlSaldo) {
          const parsed = parseInt(urlSaldo, 10);
          if (!isNaN(parsed)) return { saldo: parsed, cached: true };
        }
      } catch {}
    }

    // 2. Cek localStorage
    try {
      const cached = localStorage.getItem('nara_premku_saldo');
      if (cached !== null) {
        const val = parseInt(cached, 10);
        if (!isNaN(val)) return { saldo: val, cached: true };
      }
    } catch {}

    // 3. Default fallback saldo aktual Premku
    return { saldo: 167, cached: true };
  });

  const [loading, setLoading] = useState(true);

  const refreshBalance = useCallback(async () => {
    // Jangan override jika URL sengaja memakai mock saldo query param
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSaldo = urlParams.get('saldo') || urlParams.get('mock_saldo');
      if (urlSaldo) {
        const parsed = parseInt(urlSaldo, 10);
        if (!isNaN(parsed)) {
          setBalanceData({ saldo: parsed, cached: true });
          setLoading(false);
          return;
        }
      }
    }

    try {
      const data = await fetchPremkuBalance();
      setBalanceData(data);
    } catch (err) {
      console.warn('Gagal memuat saldo premku:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBalance();

    const timer = setInterval(() => {
      refreshBalance();
    }, 60000);

    return () => clearInterval(timer);
  }, [refreshBalance]);

  const saldo = balanceData.saldo;

  /**
   * Menentukan apakah suatu paket masuk kategori "Maintenance"
   * karena saldo akun Premku tidak mencukupi untuk membeli produk modal dari supplier (saldo < modalPrice)
   */
  const isMaintenance = useCallback((modalPrice: number): boolean => {
    if (modalPrice <= 0) return false;
    return saldo < modalPrice;
  }, [saldo]);

  /**
   * Menghitung kuantitas maksimum yang diizinkan untuk dipesan
   * Dibatasi oleh stok ketersediaan dan saldo modal yang tersedia di akun Premku
   */
  const getMaxAllowedQty = useCallback((modalPrice: number, stockCount: number): number => {
    if (modalPrice <= 0) return Math.max(0, stockCount);
    if (saldo < modalPrice) return 0;
    const maxByBalance = Math.floor(saldo / modalPrice);
    return Math.max(0, Math.min(stockCount, maxByBalance));
  }, [saldo]);

  return {
    saldo,
    loading,
    refreshBalance,
    isMaintenance,
    getMaxAllowedQty,
  };
}
