import { useState } from 'react';
import { HelpCircle, ChevronDown, ShieldCheck, Zap, CreditCard, Lock, RefreshCw } from 'lucide-react';

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Apakah ada garansi jika akun mengalami kendala?',
      a: 'Ya, seluruh produk bergaransi penuh sesuai masa durasi langganan yang Anda beli. Jika terjadi kendala login atau pembaruan akun, silakan hubungi Customer Service WhatsApp kami dengan melampirkan ID Invoice untuk penggantian instan.',
      icon: ShieldCheck
    },
    {
      q: 'Berapa lama proses pengiriman produk setelah pembayaran?',
      a: 'Sistem bekerja otomatis 24 jam nonstop via verifikasi sistem pembayaran instan. Rata-rata pesanan terverifikasi dan detail akun digital langsung diterbitkan dalam waktu 5 hingga 60 detik.',
      icon: Zap
    },
    {
      q: 'Metode pembayaran apa saja yang didukung?',
      a: 'Kami menerima QRIS nasional yang kompatibel dengan seluruh e-wallet (GoPay, OVO, Dana, LinkAja, ShopeePay) serta seluruh aplikasi Mobile Banking (BCA, Mandiri, BRI, BNI, Jago, Seabank, dll).',
      icon: CreditCard
    },
    {
      q: 'Apakah akun digital yang dijual aman dan legal?',
      a: 'Tentu. Semua akun dan invite link bersumber dari metode legal (reseller resmi & subscription resmi). Kami menjamin privasi dan keamanan akun selama Anda mematuhi syarat penggunaan.',
      icon: Lock
    },
    {
      q: 'Bagaimana cara melihat kembali akun yang sudah saya beli?',
      a: 'Cukup gunakan kotak "Cek Pesanan / Lacak Invoice" yang ada di bagian atas halaman beranda, lalu masukkan nomor invoice pesanan Anda. Halaman detail pesanan dan kredensial akun akan langsung terbuka.',
      icon: RefreshCw
    }
  ];

  return (
    <section id="faq" className="scroll-mt-24 space-y-6 pt-10 border-t-2 border-black">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-pink-soft text-brand-pink border-2 border-black rounded-md shadow-[2px_2px_0px_#000]">
          <HelpCircle className="w-3.5 h-3.5" />
          <span className="text-xs font-black uppercase tracking-wider">
            PERTANYAAN POPULER
          </span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
          Frequently Asked Questions (FAQ)
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 font-medium">
          Jawaban lengkap seputar garansi, proses transaksi, dan ketentuan layanan Nara Premium.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3 pt-2">
        {faqs.map((item, idx) => {
          const isOpen = openIndex === idx;
          const Icon = item.icon;

          return (
            <div 
              key={idx}
              className="bg-white border-2 border-black shadow-[3px_3px_0px_#000] rounded-xl overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : idx)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-4 hover:bg-[#FAF8F5] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#FAF8F5] border-2 border-black rounded flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                    <Icon className="w-4 h-4 text-brand-blue" />
                  </div>
                  <h3 className="font-extrabold text-sm sm:text-base text-black">
                    {item.q}
                  </h3>
                </div>

                <div className={`w-7 h-7 bg-white border-2 border-black rounded-md flex items-center justify-center transition-transform shrink-0 ${isOpen ? 'rotate-180 bg-brand-yellow' : ''}`}>
                  <ChevronDown className="w-4 h-4 text-black" />
                </div>
              </button>

              {isOpen && (
                <div className="p-4 sm:p-5 pt-0 border-t border-dashed border-gray-200 bg-[#FAF8F5]/50 text-xs sm:text-sm text-gray-700 font-medium leading-relaxed">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
