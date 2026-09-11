import { Sparkles, ShoppingBag, PhoneCall, QrCode, CheckCircle2 } from 'lucide-react';

export function CaraOrderSection() {
  const steps = [
    {
      step: '01',
      icon: ShoppingBag,
      title: 'Pilih Produk & Paket',
      desc: 'Pilih layanan digital premium yang kamu perlukan, tentukan durasi serta tipe akun (Privat/Invite/Sharing).'
    },
    {
      step: '02',
      icon: PhoneCall,
      title: 'Masukkan Nomor WhatsApp',
      desc: 'Cukup masukkan nomor WhatsApp aktif Anda. Akun dan kode akses akan dikirimkan otomatis ke nomor ini.'
    },
    {
      step: '03',
      icon: QrCode,
      title: 'Bayar Instan via QRIS',
      desc: 'Scan kode QRIS menggunakan GoPay, OVO, Dana, ShopeePay, BCA, atau m-Banking apapun tanpa biaya tersembunyi.'
    },
    {
      step: '04',
      icon: CheckCircle2,
      title: 'Akun Langsung Aktif',
      desc: 'Sistem webhook kami memproses transaksi otomatis dalam hitungan detik. Detail akun langsung aktif dan bisa digunakan.'
    }
  ];

  return (
    <section id="cara-order" className="scroll-mt-24 space-y-6 pt-10 border-t-2 border-black">
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-yellow text-black border-2 border-black rounded-md shadow-[2px_2px_0px_#000]">
          <Sparkles className="w-3.5 h-3.5 text-black" />
          <span className="text-xs font-black uppercase tracking-wider">
            PANDUAN PEMESANAN
          </span>
        </div>

        <h2 className="text-3xl sm:text-4xl font-black text-black tracking-tight">
          Cara Order Cepat & Otomatis
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 font-medium">
          Dapatkan akses akun digital premium kamu hanya dalam 4 langkah sederhana.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {steps.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div 
              key={idx}
              className="bg-white border-2 border-black p-5 space-y-3 shadow-[4px_4px_0px_#000] relative rounded-xl"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black text-brand-blue tracking-wider font-mono">
                  {item.step}
                </span>
                <div className="w-10 h-10 bg-[#FAF8F5] border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center">
                  <Icon className="w-5 h-5 text-black" />
                </div>
              </div>

              <h3 className="font-black text-base text-black">
                {item.title}
              </h3>
              <p className="text-xs text-gray-600 font-medium leading-relaxed">
                {item.desc}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
