export interface InvoiceAccount {
  title: string;
  packageBadge: string;
  emailOrUsername: string;
  passwordOrCode: string;
}

export interface InvoiceData {
  id: string;
  productName: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  discount: number;
  discountLabel?: string;
  uniqueCode: number;
  total: number;
  status: 'LUNAS' | 'DIPROSES' | 'MENUNGGU' | 'KADALUARSA';
  date: string;
  accounts: InvoiceAccount[];
  isDeliveryPending?: boolean;
  supplierInvoice?: string;
  warningNotice?: string;
  failureReason?: string;
  isLocked?: boolean;
  isVerified?: boolean;
  customerPhone?: string;
}

export const DEFAULT_INVOICES: InvoiceData[] = [
  {
    id: "#20260309165713URQE",
    productName: "Capcut Pro 1 Bulan Promo",
    qty: 1,
    unitPrice: 6000,
    subtotal: 6000,
    discount: 300,
    discountLabel: "Diskon (Promo)",
    uniqueCode: 25,
    total: 5725,
    status: "LUNAS",
    date: "09 Mar 2026, 16:57",
    accounts: [],
    isLocked: true,
    warningNotice: "Invoice contoh. Kredensial akun asli akan muncul secara instan setelah pesanan Anda terverifikasi."
  },
  {
    id: "ORD-892147",
    productName: "Canva Pro 3 Bulan Invite",
    qty: 1,
    unitPrice: 5000,
    subtotal: 5000,
    discount: 0,
    uniqueCode: 47,
    total: 5047,
    status: "LUNAS",
    date: "09 Mar 2026, 14:15",
    accounts: [],
    isLocked: true,
    warningNotice: "Invoice contoh. Kredensial akun asli akan muncul secara instan setelah pesanan Anda terverifikasi."
  },
  {
    id: "ORD-761230",
    productName: "CC Pro 1 Bulan Private",
    qty: 1,
    unitPrice: 40000,
    subtotal: 40000,
    discount: 2000,
    discountLabel: "Diskon Promo",
    uniqueCode: 30,
    total: 38030,
    status: "LUNAS",
    date: "08 Mar 2026, 11:20",
    accounts: [],
    isLocked: true,
    warningNotice: "Invoice contoh. Kredensial akun asli akan muncul secara instan setelah pesanan Anda terverifikasi."
  }
];

export function findInvoice(query: string): InvoiceData | null {
  const cleanQuery = query.trim().replace(/^#/, '').toLowerCase();
  if (!cleanQuery) return null;

  // 1. Hanya periksa default demo invoices statis
  const found = DEFAULT_INVOICES.find(inv => {
    const cleanId = inv.id.replace(/^#/, '').toLowerCase();
    return cleanId === cleanQuery || inv.id.toLowerCase() === query.trim().toLowerCase();
  });

  if (found) return found;

  // Seluruh pesanan dinamis (seperti ORD-...) harus diverifikasi live ke backend via findInvoiceAsync
  // agar kredensial akun tidak pernah bocor sebelum proses otentikasi selesai
  return null;
}

export function getAllInvoices(): InvoiceData[] {
  const dynamicInvoices: InvoiceData[] = [];
  try {
    const stored = localStorage.getItem('nara_orders');
    if (stored) {
      const orders = JSON.parse(stored);
      orders.forEach((matched: any) => {
        const idFormatted = (matched.id || '').startsWith('#') 
          ? matched.id 
          : `#${matched.id || 'ORD-999999'}`;
        if (!DEFAULT_INVOICES.some(d => d.id.toLowerCase() === idFormatted.toLowerCase())) {
          const qtyCount = matched.qty || 1;

          dynamicInvoices.push({
            id: idFormatted,
            productName: matched.product || 'Produk Digital Premium',
            qty: qtyCount,
            unitPrice: Math.round((matched.total || 10000) / qtyCount),
            subtotal: matched.total || 10000,
            discount: 0,
            uniqueCode: matched.uniqueCode || 18,
            total: matched.total || 10000,
            status: (matched.status === 'completed' || matched.status === 'LUNAS') ? 'LUNAS' : 'MENUNGGU',
            date: matched.date || 'Hari Ini',
            accounts: [],
            isLocked: true,
            warningNotice: "Buka detail invoice untuk memverifikasi dan melihat kredensial akun Anda."
          });
        }
      });
    }
  } catch (e) {
    console.error("Error reading nara_orders from localStorage", e);
  }

  return [...dynamicInvoices, ...DEFAULT_INVOICES];
}

export interface FindInvoiceOptions {
  skipToken?: boolean;
  customToken?: string;
}

/**
 * Mencari invoice secara asinkron dengan memprioritaskan database backend live
 */
export async function findInvoiceAsync(query: string, options?: FindInvoiceOptions): Promise<InvoiceData | null> {
  const cleanQuery = query.trim().replace(/^#/, '');
  if (!cleanQuery) return null;

  try {
    const { getBackendOrder } = await import('./api');
    const backendOrder = await getBackendOrder(cleanQuery, options);
    if (backendOrder) {
      const firstItem = backendOrder.items[0];
      const qtyCount = firstItem?.quantity || 1;
      const unitPrice = firstItem?.price || Math.round(backendOrder.totalAmount / qtyCount);

      const accounts: InvoiceAccount[] = [];
      let isDeliveryPending = false;
      let supplierInvoice: string | undefined = undefined;

      if (backendOrder.deliveries && backendOrder.deliveries.length > 0) {
        backendOrder.deliveries.forEach((del) => {
          // 1. Coba parse jika content adalah JSON accounts dari Premku
          let parsed: any = null;
          try {
            parsed = typeof del.content === 'string' ? JSON.parse(del.content) : del.content;
          } catch {}

          if (parsed && typeof parsed === 'object') {
            if (parsed.invoice) supplierInvoice = parsed.invoice;

            let parsedPremkuAccounts: any[] | null = null;
            if (Array.isArray(parsed.accounts) && parsed.accounts.length > 0) {
              parsedPremkuAccounts = parsed.accounts;
            } else if (Array.isArray(parsed) && parsed.length > 0) {
              parsedPremkuAccounts = parsed;
            }

            if (parsedPremkuAccounts && parsedPremkuAccounts.length > 0) {
              parsedPremkuAccounts.forEach((acc: any) => {
                accounts.push({
                  title: `AKUN #${accounts.length + 1}`,
                  packageBadge: (acc.product_type || del.productName || firstItem?.productName || 'PREMIUM').toUpperCase(),
                  emailOrUsername: acc.username || acc.email || '-',
                  passwordOrCode: acc.password || acc.token || acc.link || acc.code || '-',
                });
              });
              return;
            }

            // Jika ada invoice tapi accounts masih kosong atau status processing
            if (parsed.invoice && (!parsedPremkuAccounts || parsedPremkuAccounts.length === 0)) {
              isDeliveryPending = true;
              return;
            }
          }

          // 2. Coba parse pola teks jika berisi baris username/email dan password/akses
          if (typeof del.content === 'string') {
            const invMatch = del.content.match(/API-[0-9a-zA-Z-]+/);
            if (invMatch) supplierInvoice = invMatch[0];

            const lines = del.content.split('\n');
            let parsedUser = '';
            let parsedPass = '';
            for (const line of lines) {
              if (/^(username|email|user):\s*(.*)$/i.test(line)) {
                parsedUser = line.replace(/^(username|email|user):\s*/i, '').trim();
              } else if (/^(password|pass|kredensial|akses):\s*(.*)$/i.test(line)) {
                parsedPass = line.replace(/^(password|pass|kredensial|akses):\s*/i, '').trim();
              }
            }

            if (parsedUser || parsedPass) {
              accounts.push({
                title: `AKUN #${accounts.length + 1}`,
                packageBadge: del.productName.toUpperCase(),
                emailOrUsername: parsedUser || '-',
                passwordOrCode: parsedPass || '-',
              });
              return;
            }

            // Jika teksnya menandakan akun sedang diproses atau ada invoice provider
            if (invMatch || del.status === 'processing' || /sedang diproses|memproses|Nomor Invoice Provider/i.test(del.content)) {
              isDeliveryPending = true;
              return;
            }

            // Plain text manual
            if (del.content.trim()) {
              accounts.push({
                title: `AKUN #${accounts.length + 1}`,
                packageBadge: del.productName.toUpperCase(),
                emailOrUsername: '-',
                passwordOrCode: del.content,
              });
            }
          }
        });
      }

      // Jika belum ada akun riil sama sekali padahal order lunas / diproses, set pending
      if (accounts.length === 0 && (backendOrder.status === 'processing' || backendOrder.status === 'paid' || backendOrder.status === 'completed')) {
        isDeliveryPending = true;
      }

      let invoiceStatus: 'LUNAS' | 'DIPROSES' | 'MENUNGGU' | 'KADALUARSA' = 'MENUNGGU';
      let failureReason: string | undefined = undefined;

      const latestPayment = backendOrder.payments && backendOrder.payments.length > 0
        ? backendOrder.payments[backendOrder.payments.length - 1]
        : null;
      const rawCb = latestPayment?.rawCallback;

      // 1. Cek apakah status order adalah failed
      if (backendOrder.status === 'failed') {
        invoiceStatus = 'KADALUARSA';
        failureReason = 'Batas waktu pembayaran telah habis (Expired) atau transaksi dibatalkan.';
      } 
      // 2. Cek apakah status payment adalah expire atau cancel
      else if (latestPayment?.status === 'expire' || rawCb?.transaction_status === 'expire') {
        invoiceStatus = 'KADALUARSA';
        failureReason = 'Batas waktu pembayaran QRIS di Midtrans telah habis (Expired).';
      } 
      else if (latestPayment?.status === 'cancel' || rawCb?.transaction_status === 'cancel') {
        invoiceStatus = 'KADALUARSA';
        failureReason = 'Transaksi QRIS telah dibatalkan.';
      }
      // 3. Cek apakah waktu kadaluarsa Midtrans sudah terlewati padahal masih waiting_payment
      else if (backendOrder.status === 'waiting_payment') {
        const expiryStr = latestPayment?.expiryTime || rawCb?.expiry_time;
        if (expiryStr) {
          try {
            const iso = expiryStr.includes('T') ? expiryStr : expiryStr.trim().replace(' ', 'T') + '+07:00';
            const expTime = new Date(iso).getTime();
            if (!isNaN(expTime) && expTime < Date.now()) {
              invoiceStatus = 'KADALUARSA';
              failureReason = 'Batas waktu pembayaran resmi telah terlampaui.';
            } else {
              invoiceStatus = 'MENUNGGU';
            }
          } catch {
            invoiceStatus = 'MENUNGGU';
          }
        } else {
          invoiceStatus = 'MENUNGGU';
        }
      } 
      // 4. Status processing atau lunas
      else if (isDeliveryPending || backendOrder.status === 'processing') {
        invoiceStatus = 'DIPROSES';
      } else if (backendOrder.status === 'completed' || backendOrder.status === 'paid') {
        invoiceStatus = 'LUNAS';
      }

      const formattedDate = new Date(backendOrder.createdAt).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      let warningNotice = 'Simpan data akun ini dan jangan bagikan ke pihak lain.';
      if (invoiceStatus === 'KADALUARSA') {
        warningNotice = 'Pesanan ini telah kadaluarsa karena melewati batas waktu pembayaran. Kode QRIS sudah dinonaktifkan permanen.';
      } else if (invoiceStatus === 'MENUNGGU') {
        warningNotice = 'Pesanan ini belum dibayar. Selesaikan pembayaran QRIS Anda agar sistem dapat langsung memproses kredensial akun digital Anda.';
      } else if (isDeliveryPending) {
        warningNotice = 'Detail akun digital Anda sedang diproses secara otomatis oleh sistem. Halaman ini akan memuat akun Anda secara langsung begitu siap.';
      }

      const isLocked = Boolean(backendOrder.isLocked);
      const isVerified = Boolean(backendOrder.isVerified);

      return {
        id: `#${backendOrder.orderNumber}`,
        productName: firstItem?.productName || 'Produk Digital Premium',
        qty: qtyCount,
        unitPrice,
        subtotal: backendOrder.totalAmount,
        discount: 0,
        uniqueCode: 0,
        total: backendOrder.totalAmount,
        status: invoiceStatus,
        date: formattedDate,
        accounts: isLocked ? [] : accounts,
        isDeliveryPending: isLocked ? false : isDeliveryPending,
        supplierInvoice,
        warningNotice,
        failureReason,
        isLocked,
        isVerified,
        customerPhone: backendOrder.customerPhone,
      };
    }
  } catch (err) {
    console.warn('Gagal memuat invoice dari backend, fallback ke lokal:', err);
  }

  // Fallback ke pencarian lokal
  return findInvoice(query);
}

