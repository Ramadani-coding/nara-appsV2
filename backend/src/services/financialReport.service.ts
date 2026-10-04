import ExcelJS from "exceljs";
import { db } from "../db/index.js";
import { orders, products } from "../db/schema.js";
import { premiumkuService } from "./premiumku.service.js";
import { desc } from "drizzle-orm";

const MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

function formatMonthKeyLabel(key: string): string {
  if (key === "all") return "Semua Waktu (All-Time)";
  const parts = key.split("-");
  if (parts.length < 2) return key;
  const y = parts[0];
  const mIdx = parseInt(parts[1], 10) - 1;
  const mName = MONTH_NAMES_ID[mIdx] || parts[1];
  return `${mName} ${y}`;
}

function formatDateWIB(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";
  
  // Format WIB (UTC+7)
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const wib = new Date(utc + (3600000 * 7));
  
  const yyyy = wib.getFullYear();
  const mm = String(wib.getMonth() + 1).padStart(2, "0");
  const dd = String(wib.getDate()).padStart(2, "0");
  const hh = String(wib.getHours()).padStart(2, "0");
  const min = String(wib.getMinutes()).padStart(2, "0");
  const ss = String(wib.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss} WIB`;
}

// Styling Constants (Palette ARGB)
const THEME = {
  fontName: "Segoe UI",
  navyDark: "FF1E293B",      // Slate 800
  navyMedium: "FF334155",    // Slate 700
  blueSky: "FF0284C7",       // Sky 600
  blueSkySoft: "FFF0F9FF",   // Sky 50
  emeraldDark: "FF0F766E",   // Teal 700
  emeraldText: "FF065F46",   // Emerald 800
  emeraldSoft: "FFECFDF5",   // Emerald 50
  zebraRow: "FFF8FAFC",      // Slate 50
  totalRow: "FFF1F5F9",      // Slate 100
  borderColor: "FFCBD5E1",   // Slate 300
  borderLight: "FFE2E8F0",   // Slate 200
  textDark: "FF0F172A",      // Slate 900
  textMuted: "FF64748B",     // Slate 500
  textWhite: "FFFFFFFF",
};

export class FinancialReportService {
  /**
   * Menghasilkan workbook Excel lengkap dengan 3 lembar kerja (Sheets):
   * 1. Ringkasan Eksekutif (Termasuk Rata-rata Penjualan 1 Bulan & Harian)
   * 2. Analisis Profit Produk
   * 3. Rincian Transaksi
   */
  async generateFinancialReportExcel(requestedMonth?: string): Promise<{ buffer: Buffer; filename: string }> {
    // 1. Ambil data produk untuk kalkulasi HPP / unitCost
    const allProducts = await db.select().from(products);
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const emptyStockProducts = allProducts.filter(p => p.stockStatus === "empty" || p.stockCount === 0).length;

    const productMap = new Map<number, typeof products.$inferSelect>();
    for (const p of allProducts) {
      productMap.set(p.id, p);
    }

    // Helper kalkulasi HPP dan Profit
    const getCostAndProfit = (item: { productId: number | null; price: number; quantity: number; subtotal: number }) => {
      const prod = item.productId ? productMap.get(item.productId) : null;
      let unitCost = 0;
      if (prod) {
        if (prod.providerPrice && prod.providerPrice > 0) {
          unitCost = prod.providerPrice;
        } else if (prod.marginValue && prod.marginValue > 0) {
          unitCost = Math.max(0, item.price - prod.marginValue);
        }
      }
      const qty = item.quantity || 1;
      const totalCost = unitCost * qty;
      const profit = Math.max(0, item.subtotal - totalCost);
      return { unitCost, totalCost, profit };
    };

    // 2. Ambil seluruh pesanan beserta item, pembayaran, & pengiriman
    const allOrders = await db.query.orders.findMany({
      orderBy: [desc(orders.createdAt)],
      with: {
        items: true,
        payments: true,
        deliveries: true,
      },
    });

    // 3. Tentukan periode
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthNum = String(now.getMonth() + 1).padStart(2, "0");
    const currentMonthKey = `${currentYear}-${currentMonthNum}`;
    const selectedMonth = requestedMonth || currentMonthKey;
    const selectedMonthLabel = formatMonthKeyLabel(selectedMonth);

    // Hitung metrik All-Time, Periode, dan Bulanan
    const statusCounts: Record<string, number> = {
      waiting_payment: 0,
      paid: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    let allTimeRevenue = 0;
    let allTimeCost = 0;
    let allTimeProfit = 0;
    let allTimePaidOrdersCount = 0;

    let periodRevenue = 0;
    let periodCost = 0;
    let periodProfit = 0;
    let periodPaidOrdersCount = 0;

    // Koleksi bulan unik dari semua transaksi
    const monthKeysSet = new Set<string>();
    monthKeysSet.add(currentMonthKey);

    // Map untuk akumulasi per bulan
    const monthlyStatsMap = new Map<string, {
      monthKey: string;
      monthLabel: string;
      revenue: number;
      cost: number;
      profit: number;
      orders: number;
    }>();

    // Map untuk kalkulasi produk terjual di periode terpilih
    const productSalesMap = new Map<string, {
      productId: number;
      productName: string;
      totalQuantity: number;
      totalSales: number;
      totalCost: number;
      totalProfit: number;
    }>();

    // Daftar pesanan pada periode terpilih (untuk sheet transaksi)
    const periodOrdersList: Array<{
      order: typeof allOrders[0];
      orderRevenue: number;
      orderCost: number;
      orderProfit: number;
      itemsSummary: string;
      totalQuantity: number;
      paymentMethod: string;
    }> = [];

    for (const order of allOrders) {
      const st = order.status || "waiting_payment";
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const orderDate = order.paidAt ? new Date(order.paidAt) : new Date(order.createdAt);
      const oYear = orderDate.getFullYear();
      const oMonth = String(orderDate.getMonth() + 1).padStart(2, "0");
      const orderMonthKey = `${oYear}-${oMonth}`;
      monthKeysSet.add(orderMonthKey);

      const isPaidOrCompleted = st === "paid" || st === "completed";
      const matchesPeriod = selectedMonth === "all" || orderMonthKey === selectedMonth;

      // Hitung modal dan profit dari item-item order
      let orderCost = 0;
      let orderProfit = 0;
      let orderQty = 0;
      const itemSummaries: string[] = [];

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const { totalCost, profit } = getCostAndProfit(item);
          orderCost += totalCost;
          orderProfit += profit;
          orderQty += item.quantity || 1;
          itemSummaries.push(`${item.productName} (x${item.quantity || 1})`);

          // Jika pesanan valid dan cocok periode, akumulasi ke data produk
          if (isPaidOrCompleted && matchesPeriod) {
            const pKey = `${item.productId || 0}_${item.productName}`;
            const existing = productSalesMap.get(pKey) || {
              productId: item.productId || 0,
              productName: item.productName,
              totalQuantity: 0,
              totalSales: 0,
              totalCost: 0,
              totalProfit: 0,
            };
            existing.totalQuantity += item.quantity || 1;
            existing.totalSales += item.subtotal || 0;
            existing.totalCost += totalCost;
            existing.totalProfit += profit;
            productSalesMap.set(pKey, existing);
          }
        }
      }

      if (isPaidOrCompleted) {
        const orderAmount = order.totalAmount || 0;
        allTimeRevenue += orderAmount;
        allTimeCost += orderCost;
        allTimeProfit += orderProfit;
        allTimePaidOrdersCount += 1;

        // Akumulasi bulanan
        const mStats = monthlyStatsMap.get(orderMonthKey) || {
          monthKey: orderMonthKey,
          monthLabel: formatMonthKeyLabel(orderMonthKey),
          revenue: 0,
          cost: 0,
          profit: 0,
          orders: 0,
        };
        mStats.revenue += orderAmount;
        mStats.cost += orderCost;
        mStats.profit += orderProfit;
        mStats.orders += 1;
        monthlyStatsMap.set(orderMonthKey, mStats);

        if (matchesPeriod) {
          periodRevenue += orderAmount;
          periodCost += orderCost;
          periodProfit += orderProfit;
          periodPaidOrdersCount += 1;

          const paymentMethod = order.payments?.[0]?.paymentMethod || "QRIS";
          periodOrdersList.push({
            order,
            orderRevenue: orderAmount,
            orderCost,
            orderProfit,
            itemsSummary: itemSummaries.join(", ") || "Produk Digital",
            totalQuantity: orderQty || 1,
            paymentMethod: paymentMethod.toUpperCase(),
          });
        }
      }
    }

    // Pastikan bulan berjalan ada di map bulanan
    if (!monthlyStatsMap.has(currentMonthKey)) {
      monthlyStatsMap.set(currentMonthKey, {
        monthKey: currentMonthKey,
        monthLabel: formatMonthKeyLabel(currentMonthKey),
        revenue: 0,
        cost: 0,
        profit: 0,
        orders: 0,
      });
    }

    // Urutan historis bulanan secara descending (terbaru di atas)
    const sortedMonthlyStats = Array.from(monthlyStatsMap.values()).sort(
      (a, b) => b.monthKey.localeCompare(a.monthKey)
    );

    // KALKULASI RATA-RATA PENJUALAN DALAM 1 BULAN
    const totalRecordedMonths = Math.max(1, sortedMonthlyStats.length);
    const avgMonthlyRevenue = Math.round(allTimeRevenue / totalRecordedMonths);
    const avgMonthlyCost = Math.round(allTimeCost / totalRecordedMonths);
    const avgMonthlyProfit = Math.round(allTimeProfit / totalRecordedMonths);
    const avgMonthlyOrders = Math.round(allTimePaidOrdersCount / totalRecordedMonths);
    const avgMonthlyMargin = avgMonthlyRevenue > 0 ? (avgMonthlyProfit / avgMonthlyRevenue) * 100 : 0;

    // KALKULASI RATA-RATA PENJUALAN HARIAN
    let daysElapsed = 30;
    if (selectedMonth === "all") {
      daysElapsed = totalRecordedMonths * 30;
    } else {
      const parts = selectedMonth.split("-");
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const daysInMonth = new Date(y, m, 0).getDate();
        if (selectedMonth === currentMonthKey) {
          daysElapsed = Math.min(daysInMonth, now.getDate());
        } else {
          daysElapsed = daysInMonth;
        }
      }
    }
    daysElapsed = Math.max(1, daysElapsed);

    const avgDailyRevenue = Math.round(periodRevenue / daysElapsed);
    const avgDailyCost = Math.round(periodCost / daysElapsed);
    const avgDailyProfit = Math.round(periodProfit / daysElapsed);
    const avgDailyOrders = Number((periodPaidOrdersCount / daysElapsed).toFixed(1));

    const periodMarginPercentage = periodRevenue > 0 ? (periodProfit / periodRevenue) * 100 : 0;
    const avgOrderValue = periodPaidOrdersCount > 0 ? Math.round(periodRevenue / periodPaidOrdersCount) : 0;
    const avgProfitPerOrder = periodPaidOrdersCount > 0 ? Math.round(periodProfit / periodPaidOrdersCount) : 0;

    // Ambil saldo Premku
    let premkuSaldo = 0;
    try {
      const profile = await premiumkuService.getProfile();
      if (profile.success && profile.data) {
        premkuSaldo = profile.data.saldo;
      }
    } catch {
      premkuSaldo = 0;
    }

    // Urutkan produk berdasarkan total profit descending
    const productSalesList = Array.from(productSalesMap.values()).sort(
      (a, b) => b.totalProfit - a.totalProfit || b.totalQuantity - a.totalQuantity
    );

    // =========================================================================
    // BUAT WORKBOOK EXCEL DENGAN EXCELJS
    // =========================================================================
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Nara Digital Store System";
    workbook.lastModifiedBy = "Nara Admin";
    workbook.created = new Date();
    workbook.modified = new Date();

    const formattedExportDate = formatDateWIB(new Date());

    // -------------------------------------------------------------------------
    // SHEET 1: RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)
    // -------------------------------------------------------------------------
    const wsSummary = workbook.addWorksheet("Ringkasan Eksekutif", {
      views: [{ showGridLines: true }],
    });

    // Atur lebar kolom Sheet 1 (Cols A to G)
    wsSummary.columns = [
      { width: 4 },   // Col A (padding)
      { width: 34 },  // Col B (Label / Indikator / Bulan)
      { width: 24 },  // Col C (Nilai Realisasi / Omzet)
      { width: 22 },  // Col D (Satuan / Modal HPP)
      { width: 24 },  // Col E (Keterangan Analisis / Profit Bersih)
      { width: 18 },  // Col F (Status / Transaksi Lunas)
      { width: 16 },  // Col G (Catatan / Margin %)
    ];

    // Banner Header Toko
    wsSummary.mergeCells("B2:G2");
    const titleCell = wsSummary.getCell("B2");
    titleCell.value = "NARA DIGITAL STORE";
    titleCell.font = { name: THEME.fontName, size: 16, bold: true, color: { argb: THEME.textWhite } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyDark } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    wsSummary.getRow(2).height = 34;

    wsSummary.mergeCells("B3:G3");
    const subTitleCell = wsSummary.getCell("B3");
    subTitleCell.value = "LAPORAN KEUANGAN & PROFIT MARGIN";
    subTitleCell.font = { name: THEME.fontName, size: 12, bold: true, color: { argb: "FF38BDF8" } };
    subTitleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyDark } };
    subTitleCell.alignment = { vertical: "middle", horizontal: "center" };
    wsSummary.getRow(3).height = 24;

    wsSummary.mergeCells("B4:G4");
    const metaCell = wsSummary.getCell("B4");
    metaCell.value = `Periode: ${selectedMonthLabel}   |   Dicetak Pada: ${formattedExportDate}   |   Mata Uang: IDR (Rupiah)`;
    metaCell.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: "FFE2E8F0" } };
    metaCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyMedium } };
    metaCell.alignment = { vertical: "middle", horizontal: "center" };
    wsSummary.getRow(4).height = 22;

    // Helper styling border
    const applyBorder = (cell: ExcelJS.Cell, isTotal = false) => {
      cell.border = {
        top: { style: isTotal ? "thin" : "thin", color: { argb: isTotal ? THEME.navyDark : THEME.borderLight } },
        bottom: { style: isTotal ? "double" : "thin", color: { argb: isTotal ? THEME.navyDark : THEME.borderLight } },
        left: { style: "thin", color: { argb: THEME.borderLight } },
        right: { style: "thin", color: { argb: THEME.borderLight } },
      };
    };

    // =========================================================================
    // SECTION A: Indikator Utama Keuangan Periode Terpilih
    // =========================================================================
    let r = 6;
    wsSummary.getCell(`B${r}`).value = `A. INDIKATOR UTAMA KEUANGAN PERIODE (${selectedMonthLabel.toUpperCase()})`;
    wsSummary.getCell(`B${r}`).font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.textDark } };
    r++;

    const kpiHeaderRow = r;
    const kpiHeaders = ["Metrik / Indikator Keuangan", "Nilai Realisasi", "Satuan", "Keterangan Analisis", "Status Operasional", "Tipe"];
    ["B", "C", "D", "E", "F", "G"].forEach((col, idx) => {
      const cell = wsSummary.getCell(`${col}${kpiHeaderRow}`);
      cell.value = kpiHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.blueSky } };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : idx === 1 ? "right" : "center" };
      applyBorder(cell);
    });
    wsSummary.getRow(kpiHeaderRow).height = 24;
    r++;

    const kpiData = [
      {
        name: "Total Omzet Penjualan (Gross Revenue)",
        val: periodRevenue,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah (IDR)",
        desc: "Total pembayaran bruto dari seluruh pesanan lunas",
        status: "Omzet Kotor",
        type: "Omzet",
      },
      {
        name: "Estimasi Modal HPP Supplier (COGS)",
        val: periodCost,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah (IDR)",
        desc: "Total modal pengadaan produk digital ke supplier / Premku",
        status: "Beban Pokok",
        type: "Beban",
      },
      {
        name: "Total Profit Bersih (Net Profit Margin)",
        val: periodProfit,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah (IDR)",
        desc: "Keuntungan bersih murni (Omzet dikurangi HPP Supplier)",
        status: "Laba Murni",
        type: "Profit",
        highlight: true,
      },
      {
        name: "Rasio Net Profit Margin (%)",
        val: periodMarginPercentage / 100,
        fmt: "0.0%",
        unit: "Persentase",
        desc: "Persentase keuntungan bersih terhadap total omzet penjualan",
        status: `${periodMarginPercentage.toFixed(1)}% Margin`,
        type: "Rasio",
        highlight: true,
      },
      {
        name: "Total Transaksi Berhasil",
        val: periodPaidOrdersCount,
        fmt: `#,##0 "Pesanan"`,
        unit: "Transaksi",
        desc: "Pesanan berstatus lunas dan telah dikirim ke pelanggan",
        status: "Sukses Terverifikasi",
        type: "Volume",
      },
      {
        name: "Rata-rata Nilai Transaksi (AOV)",
        val: avgOrderValue,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Order",
        desc: "Rata-rata nominal belanja tiap transaksi pelanggan",
        status: "Average Order Value",
        type: "Rata-rata",
      },
      {
        name: "Rata-rata Profit Bersih per Transaksi",
        val: avgProfitPerOrder,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Order",
        desc: "Rata-rata laba bersih yang didapatkan dari tiap pesanan",
        status: "Profitabilitas Order",
        type: "Rata-rata",
      },
    ];

    kpiData.forEach((item, idx) => {
      const rowNum = r++;
      const isZebra = idx % 2 === 1;
      const bg = item.highlight ? THEME.emeraldSoft : isZebra ? THEME.zebraRow : "FFFFFFFF";

      const cB = wsSummary.getCell(`B${rowNum}`);
      cB.value = item.name;
      cB.font = { name: THEME.fontName, size: 9.5, bold: !!item.highlight, color: { argb: item.highlight ? THEME.emeraldText : THEME.textDark } };
      cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cB.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cB);

      const cC = wsSummary.getCell(`C${rowNum}`);
      cC.value = item.val;
      cC.numFmt = item.fmt;
      cC.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: item.highlight ? THEME.emeraldText : THEME.textDark } };
      cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cC.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cC);

      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = item.unit;
      cD.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cD.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cD);

      const cE = wsSummary.getCell(`E${rowNum}`);
      cE.value = item.desc;
      cE.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
      cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cE.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cE);

      const cF = wsSummary.getCell(`F${rowNum}`);
      cF.value = item.status;
      cF.font = { name: THEME.fontName, size: 9, bold: !!item.highlight, color: { argb: item.highlight ? THEME.emeraldText : THEME.blueSky } };
      cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cF.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cF);

      const cG = wsSummary.getCell(`G${rowNum}`);
      cG.value = item.type;
      cG.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cG.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cG);

      wsSummary.getRow(rowNum).height = 21;
    });

    r += 2;

    // =========================================================================
    // SECTION B: RATA-RATA PENJUALAN TOKO (STANDAR ACUAN 1 BULAN & HARIAN)
    // =========================================================================
    wsSummary.getCell(`B${r}`).value = `B. RATA-RATA PENJUALAN TOKO (STANDAR ACUAN 1 BULAN & HARIAN)`;
    wsSummary.getCell(`B${r}`).font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.textDark } };
    r++;

    const avgHeaderRow = r;
    const avgHeaders = ["Indikator Rata-Rata Penjualan", "Nilai Acuan Rata-Rata", "Satuan", "Keterangan Tolok Ukur (Benchmark)", "Frekuensi Waktu", "Status"];
    ["B", "C", "D", "E", "F", "G"].forEach((col, idx) => {
      const cell = wsSummary.getCell(`${col}${avgHeaderRow}`);
      cell.value = avgHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldDark } };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : idx === 1 ? "right" : "center" };
      applyBorder(cell);
    });
    wsSummary.getRow(avgHeaderRow).height = 24;
    r++;

    const avgData = [
      {
        name: "Rata-Rata Omzet Penjualan per Bulan",
        val: avgMonthlyRevenue,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Bulan",
        desc: `Rata-rata pendapatan kotor per bulan (Dihitung dari riwayat ${totalRecordedMonths} bulan aktif)`,
        freq: "Per 1 Bulan",
        status: "Benchmark Bulanan",
        highlight: true,
      },
      {
        name: "Rata-Rata Modal HPP per Bulan",
        val: avgMonthlyCost,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Bulan",
        desc: "Rata-rata beban pokok pembelian/pengadaan produk digital per bulan",
        freq: "Per 1 Bulan",
        status: "Beban Pokok",
      },
      {
        name: "Rata-Rata Profit Bersih per Bulan",
        val: avgMonthlyProfit,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Bulan",
        desc: "Keuntungan bersih murni rata-rata yang dihasilkan toko setiap 1 bulan",
        freq: "Per 1 Bulan",
        status: "Laba Murni Bulanan",
        highlight: true,
      },
      {
        name: "Rata-Rata Margin Keuntungan Bulanan",
        val: avgMonthlyMargin / 100,
        fmt: "0.0%",
        unit: "Persentase",
        desc: "Persentase margin keuntungan rata-rata per bulan",
        freq: "Per 1 Bulan",
        status: `${avgMonthlyMargin.toFixed(1)}% Rata-rata`,
        highlight: true,
      },
      {
        name: "Rata-Rata Jumlah Transaksi per Bulan",
        val: avgMonthlyOrders,
        fmt: `#,##0 "Pesanan"`,
        unit: "Pesanan / Bulan",
        desc: "Jumlah invoice lunas yang berhasil diselesaikan rata-rata tiap bulan",
        freq: "Per 1 Bulan",
        status: "Volume Bulanan",
      },
      {
        name: `Rata-Rata Omzet Penjualan per Hari (${selectedMonthLabel})`,
        val: avgDailyRevenue,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Hari",
        desc: `Rata-rata penjualan harian pada periode ini (${daysElapsed} hari tercatat)`,
        freq: "Per 1 Hari",
        status: "Run-rate Harian",
      },
      {
        name: `Rata-Rata Profit Bersih per Hari (${selectedMonthLabel})`,
        val: avgDailyProfit,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        unit: "Rupiah / Hari",
        desc: `Rata-rata laba bersih harian pada periode ini`,
        freq: "Per 1 Hari",
        status: "Laba Harian",
      },
    ];

    avgData.forEach((item, idx) => {
      const rowNum = r++;
      const isZebra = idx % 2 === 1;
      const bg = item.highlight ? THEME.emeraldSoft : isZebra ? THEME.zebraRow : "FFFFFFFF";

      const cB = wsSummary.getCell(`B${rowNum}`);
      cB.value = item.name;
      cB.font = { name: THEME.fontName, size: 9.5, bold: !!item.highlight, color: { argb: item.highlight ? THEME.emeraldText : THEME.textDark } };
      cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cB.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cB);

      const cC = wsSummary.getCell(`C${rowNum}`);
      cC.value = item.val;
      cC.numFmt = item.fmt;
      cC.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: item.highlight ? THEME.emeraldText : THEME.textDark } };
      cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cC.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cC);

      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = item.unit;
      cD.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cD.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cD);

      const cE = wsSummary.getCell(`E${rowNum}`);
      cE.value = item.desc;
      cE.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
      cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cE.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cE);

      const cF = wsSummary.getCell(`F${rowNum}`);
      cF.value = item.freq;
      cF.font = { name: THEME.fontName, size: 9, bold: true, color: { argb: THEME.emeraldDark } };
      cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cF.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cF);

      const cG = wsSummary.getCell(`G${rowNum}`);
      cG.value = item.status;
      cG.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cG.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cG);

      wsSummary.getRow(rowNum).height = 21;
    });

    r += 2;

    // =========================================================================
    // SECTION C: PERBANDINGAN PERIODE DENGAN AKUMULASI SEPANJANG MASA (ALL-TIME)
    // =========================================================================
    wsSummary.getCell(`B${r}`).value = `C. PERBANDINGAN PERIODE VS AKUMULASI SEPANJANG MASA (ALL-TIME)`;
    wsSummary.getCell(`B${r}`).font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.textDark } };
    r++;

    const compHeaderRow = r;
    const compHeaders = ["Indikator Performa", `Periode Terpilih (${selectedMonthLabel})`, "Akumulasi Sepanjang Masa (All-Time)", "Kontribusi Periode (%)", "Catatan Analisis", "Tipe"];
    ["B", "C", "D", "E", "F", "G"].forEach((col, idx) => {
      const cell = wsSummary.getCell(`${col}${compHeaderRow}`);
      cell.value = compHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyDark } };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : idx === 1 || idx === 2 || idx === 3 ? "right" : "center" };
      applyBorder(cell);
    });
    wsSummary.getRow(compHeaderRow).height = 24;
    r++;

    const compRows = [
      {
        name: "Omzet Penjualan (Gross)",
        period: periodRevenue,
        allTime: allTimeRevenue,
        ratio: allTimeRevenue > 0 ? periodRevenue / allTimeRevenue : 0,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        note: "Total bruto pembayaran",
        type: "Omzet",
      },
      {
        name: "Profit Bersih (Net Margin)",
        period: periodProfit,
        allTime: allTimeProfit,
        ratio: allTimeProfit > 0 ? periodProfit / allTimeProfit : 0,
        fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`,
        note: "Total laba murni",
        type: "Laba",
      },
      {
        name: "Transaksi Berhasil (Lunas)",
        period: periodPaidOrdersCount,
        allTime: allTimePaidOrdersCount,
        ratio: allTimePaidOrdersCount > 0 ? periodPaidOrdersCount / allTimePaidOrdersCount : 0,
        fmt: `#,##0 "Pesanan"`,
        note: "Pesanan selesai terkirim",
        type: "Pesanan",
      },
    ];

    compRows.forEach((row, idx) => {
      const rowNum = r++;
      const isZebra = idx % 2 === 1;
      const bg = isZebra ? THEME.zebraRow : "FFFFFFFF";

      const cB = wsSummary.getCell(`B${rowNum}`);
      cB.value = row.name;
      cB.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
      cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cB.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cB);

      const cC = wsSummary.getCell(`C${rowNum}`);
      cC.value = row.period;
      cC.numFmt = row.fmt;
      cC.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
      cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cC.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cC);

      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = row.allTime;
      cD.numFmt = row.fmt;
      cD.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
      cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cD.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cD);

      const cE = wsSummary.getCell(`E${rowNum}`);
      cE.value = row.ratio;
      cE.numFmt = "0.0%";
      cE.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.blueSky } };
      cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cE.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cE);

      const cF = wsSummary.getCell(`F${rowNum}`);
      cF.value = row.note;
      cF.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cF.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cF);

      const cG = wsSummary.getCell(`G${rowNum}`);
      cG.value = row.type;
      cG.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cG.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cG);

      wsSummary.getRow(rowNum).height = 21;
    });

    r += 2;

    // =========================================================================
    // SECTION D: REKAPITULASI HISTORIS KEUANGAN PER BULAN (MONTHLY BREAKDOWN)
    // Menampilkan performa tiap-tiap bulan dan baris RATA-RATA BULANAN
    // =========================================================================
    wsSummary.getCell(`B${r}`).value = `D. REKAPITULASI HISTORIS KEUANGAN PER BULAN & RATA-RATA BULANAN`;
    wsSummary.getCell(`B${r}`).font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.textDark } };
    r++;

    const mBreakHeaderRow = r;
    const mBreakHeaders = ["Bulan / Periode", "Total Omzet Penjualan", "Total Modal HPP", "Total Profit Bersih", "Transaksi Lunas", "Margin (%)"];
    ["B", "C", "D", "E", "F", "G"].forEach((col, idx) => {
      const cell = wsSummary.getCell(`${col}${mBreakHeaderRow}`);
      cell.value = mBreakHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyMedium } };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : "right" };
      applyBorder(cell);
    });
    wsSummary.getRow(mBreakHeaderRow).height = 24;
    r++;

    const firstMonthRow = r;
    sortedMonthlyStats.forEach((mItem, idx) => {
      const rowNum = r++;
      const isZebra = idx % 2 === 1;
      const bg = isZebra ? THEME.zebraRow : "FFFFFFFF";
      const marginPct = mItem.revenue > 0 ? mItem.profit / mItem.revenue : 0;

      const cB = wsSummary.getCell(`B${rowNum}`);
      cB.value = mItem.monthLabel;
      cB.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
      cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cB.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cB);

      const cC = wsSummary.getCell(`C${rowNum}`);
      cC.value = mItem.revenue;
      cC.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      cC.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
      cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cC.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cC);

      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = mItem.cost;
      cD.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      cD.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textMuted } };
      cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cD.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cD);

      const cE = wsSummary.getCell(`E${rowNum}`);
      cE.value = mItem.profit;
      cE.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      cE.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.emeraldText } };
      cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
      cE.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cE);

      const cF = wsSummary.getCell(`F${rowNum}`);
      cF.value = mItem.orders;
      cF.numFmt = `#,##0 "Order"`;
      cF.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
      cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cF.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cF);

      const cG = wsSummary.getCell(`G${rowNum}`);
      cG.value = marginPct;
      cG.numFmt = "0.0%";
      cG.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.emeraldText } };
      cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
      cG.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cG);

      wsSummary.getRow(rowNum).height = 21;
    });

    const lastMonthRow = r - 1;

    // BARIS RATA-RATA BULANAN (AVERAGE MONTHLY FORMULA)
    const avgMonthlyRow = r++;
    const aB = wsSummary.getCell(`B${avgMonthlyRow}`);
    aB.value = "RATA-RATA PENJUALAN BULANAN (AVERAGE)";
    aB.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    aB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    aB.alignment = { vertical: "middle", horizontal: "left" };
    applyBorder(aB, true);

    const aC = wsSummary.getCell(`C${avgMonthlyRow}`);
    aC.value = { formula: `AVERAGE(C${firstMonthRow}:C${lastMonthRow})`, result: avgMonthlyRevenue };
    aC.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
    aC.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    aC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    aC.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(aC, true);

    const aD = wsSummary.getCell(`D${avgMonthlyRow}`);
    aD.value = { formula: `AVERAGE(D${firstMonthRow}:D${lastMonthRow})`, result: avgMonthlyCost };
    aD.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
    aD.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    aD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    aD.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(aD, true);

    const aE = wsSummary.getCell(`E${avgMonthlyRow}`);
    aE.value = { formula: `AVERAGE(E${firstMonthRow}:E${lastMonthRow})`, result: avgMonthlyProfit };
    aE.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
    aE.font = { name: THEME.fontName, size: 10.5, bold: true, color: { argb: THEME.emeraldText } };
    aE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
    aE.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(aE, true);

    const aF = wsSummary.getCell(`F${avgMonthlyRow}`);
    aF.value = { formula: `AVERAGE(F${firstMonthRow}:F${lastMonthRow})`, result: avgMonthlyOrders };
    aF.numFmt = `#,##0 "Order"`;
    aF.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    aF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    aF.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(aF, true);

    const aG = wsSummary.getCell(`G${avgMonthlyRow}`);
    aG.value = { formula: `IF(C${avgMonthlyRow}>0, E${avgMonthlyRow}/C${avgMonthlyRow}, 0)`, result: avgMonthlyMargin / 100 };
    aG.numFmt = "0.0%";
    aG.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.emeraldText } };
    aG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
    aG.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(aG, true);

    wsSummary.getRow(avgMonthlyRow).height = 24;

    r += 2;

    // =========================================================================
    // SECTION E: REKAPITULASI STATUS SELURUH TRANSAKSI TOKO
    // =========================================================================
    wsSummary.getCell(`B${r}`).value = `E. REKAPITULASI STATUS SELURUH TRANSAKSI TOKO`;
    wsSummary.getCell(`B${r}`).font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.textDark } };
    r++;

    const statusHeaderRow = r;
    const statusHeaders = ["Status Pesanan", "Jumlah Pesanan", "Persentase (%)", "Keterangan Operasional", "Tindakan Sistem", "Kategori"];
    ["B", "C", "D", "E", "F", "G"].forEach((col, idx) => {
      const cell = wsSummary.getCell(`${col}${statusHeaderRow}`);
      cell.value = statusHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyMedium } };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 ? "left" : idx === 1 || idx === 2 ? "right" : "center" };
      applyBorder(cell);
    });
    wsSummary.getRow(statusHeaderRow).height = 24;
    r++;

    const totalOrdersCount = allOrders.length || 1;
    const statusList = [
      { key: "completed", label: "Selesai (Completed)", count: statusCounts.completed || 0, desc: "Pesanan sukses dan kredensial akun terkirim ke WhatsApp pemesan", action: "Selesai", cat: "Sukses" },
      { key: "processing", label: "Diproses (Processing)", count: statusCounts.processing || 0, desc: "Pembayaran terverifikasi, pesanan masuk antrean provider", action: "Auto-Dispatch", cat: "Antrean" },
      { key: "paid", label: "Lunas (Paid)", count: statusCounts.paid || 0, desc: "Pembayaran QRIS Midtrans berhasil diterima sistem", action: "Verifikasi Berhasil", cat: "Sukses" },
      { key: "waiting_payment", label: "Menunggu Pembayaran", count: statusCounts.waiting_payment || 0, desc: "Menunggu pembeli melakukan transfer / scan QRIS", action: "Monitor Expiry", cat: "Pending" },
      { key: "failed", label: "Gagal / Kedaluwarsa", count: statusCounts.failed || 0, desc: "Waktu pembayaran habis atau transaksi dibatalkan", action: "Arsip", cat: "Gagal" },
    ];

    statusList.forEach((st, idx) => {
      const rowNum = r++;
      const isZebra = idx % 2 === 1;
      const bg = isZebra ? THEME.zebraRow : "FFFFFFFF";

      const cB = wsSummary.getCell(`B${rowNum}`);
      cB.value = st.label;
      cB.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
      cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cB.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cB);

      const cC = wsSummary.getCell(`C${rowNum}`);
      cC.value = st.count;
      cC.numFmt = `#,##0 "Order"`;
      cC.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
      cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cC.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cC);

      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = st.count / totalOrdersCount;
      cD.numFmt = "0.0%";
      cD.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
      cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cD.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cD);

      const cE = wsSummary.getCell(`E${rowNum}`);
      cE.value = st.desc;
      cE.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
      cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cE.alignment = { vertical: "middle", horizontal: "left" };
      applyBorder(cE);

      const cF = wsSummary.getCell(`F${rowNum}`);
      cF.value = st.action;
      cF.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cF.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cF);

      const cG = wsSummary.getCell(`G${rowNum}`);
      cG.value = st.cat;
      cG.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
      cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cG.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(cG);

      wsSummary.getRow(rowNum).height = 21;
    });

    // Total Status Row
    const totalStatusRow = r++;
    const tB = wsSummary.getCell(`B${totalStatusRow}`);
    tB.value = "TOTAL KESELURUHAN PESANAN";
    tB.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    tB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    applyBorder(tB, true);

    const tC = wsSummary.getCell(`C${totalStatusRow}`);
    tC.value = allOrders.length;
    tC.numFmt = `#,##0 "Order"`;
    tC.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    tC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    tC.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(tC, true);

    const tD = wsSummary.getCell(`D${totalStatusRow}`);
    tD.value = 1.0;
    tD.numFmt = "0.0%";
    tD.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
    tD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    tD.alignment = { vertical: "middle", horizontal: "right" };
    applyBorder(tD, true);

    const tE = wsSummary.getCell(`E${totalStatusRow}`);
    tE.value = "Akumulasi seluruh transaksi di sistem database";
    tE.font = { name: THEME.fontName, size: 9, italic: true, color: { argb: THEME.textMuted } };
    tE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    applyBorder(tE, true);

    const tF = wsSummary.getCell(`F${totalStatusRow}`);
    tF.value = "Status Terkini";
    tF.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
    tF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    tF.alignment = { vertical: "middle", horizontal: "center" };
    applyBorder(tF, true);

    const tG = wsSummary.getCell(`G${totalStatusRow}`);
    tG.value = "100%";
    tG.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textMuted } };
    tG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
    tG.alignment = { vertical: "middle", horizontal: "center" };
    applyBorder(tG, true);

    wsSummary.getRow(totalStatusRow).height = 23;

    r += 2;

    // =========================================================================
    // SECTION F: Catatan Tambahan & Saldo Provider
    // =========================================================================
    wsSummary.getCell(`B${r}`).value = `F. STATUS KESIAPAN SISTEM & INTEGRASI PROVIDER`;
    wsSummary.getCell(`B${r}`).font = { name: THEME.fontName, size: 11, bold: true, color: { argb: THEME.textDark } };
    r++;

    const providerRows = [
      { param: "Saldo API Premiumku Saat Ini", val: premkuSaldo, fmt: `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`, note: premkuSaldo < 10000 ? "Perhatian: Saldo menipis, segera top up!" : "Saldo memadai untuk auto-order" },
      { param: "Total Produk di Katalog", val: allProducts.length, fmt: `#,##0 "Produk"`, note: "Jumlah seluruh SKU terdaftar" },
      { param: "Produk Aktif Siap Jual", val: activeProducts, fmt: `#,##0 "Produk"`, note: "Tampil di katalog frontend" },
      { param: "Produk Kehabisan Stok", val: emptyStockProducts, fmt: `#,##0 "Produk"`, note: "Stok habis / ditandai non-aktif" },
    ];

    providerRows.forEach((p, idx) => {
      const rowNum = r++;
      const isZebra = idx % 2 === 1;
      const bg = isZebra ? THEME.zebraRow : "FFFFFFFF";

      const cB = wsSummary.getCell(`B${rowNum}`);
      cB.value = p.param;
      cB.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
      cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      applyBorder(cB);

      const cC = wsSummary.getCell(`C${rowNum}`);
      cC.value = p.val;
      cC.numFmt = p.fmt;
      cC.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
      cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cC.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(cC);

      wsSummary.mergeCells(`D${rowNum}:G${rowNum}`);
      const cD = wsSummary.getCell(`D${rowNum}`);
      cD.value = p.note;
      cD.font = { name: THEME.fontName, size: 9, italic: true, color: { argb: THEME.textMuted } };
      cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      applyBorder(cD);
      applyBorder(wsSummary.getCell(`E${rowNum}`));
      applyBorder(wsSummary.getCell(`F${rowNum}`));
      applyBorder(wsSummary.getCell(`G${rowNum}`));

      wsSummary.getRow(rowNum).height = 20;
    });

    // -------------------------------------------------------------------------
    // SHEET 2: ANALISIS PROFIT PRODUK (PRODUCT PROFIT MARGIN)
    // -------------------------------------------------------------------------
    const wsProduct = workbook.addWorksheet("Profit per Produk", {
      views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
    });

    wsProduct.columns = [
      { key: "rank", width: 8 },         // Col A: Peringkat
      { key: "id", width: 12 },          // Col B: ID Produk
      { key: "name", width: 38 },        // Col C: Nama Produk
      { key: "qty", width: 15 },         // Col D: Qty Terjual
      { key: "avgPrice", width: 22 },    // Col E: Rata-rata Harga Jual
      { key: "sales", width: 25 },       // Col F: Total Omzet
      { key: "cost", width: 25 },        // Col G: Total Modal HPP
      { key: "profit", width: 25 },      // Col H: Profit Bersih
      { key: "margin", width: 18 },      // Col I: Margin Keuntungan (%)
      { key: "profitPerUnit", width: 22 } // Col J: Rata-rata Profit / Unit
    ];

    // Banner Header Sheet 2
    wsProduct.mergeCells("A2:J2");
    const pTitle = wsProduct.getCell("A2");
    pTitle.value = "ANALISIS PROFIT MARGIN & PERINGKAT PENJUALAN PRODUK";
    pTitle.font = { name: THEME.fontName, size: 14, bold: true, color: { argb: THEME.textWhite } };
    pTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyDark } };
    pTitle.alignment = { vertical: "middle", horizontal: "center" };
    wsProduct.getRow(2).height = 32;

    wsProduct.mergeCells("A3:J3");
    const pMeta = wsProduct.getCell("A3");
    pMeta.value = `Periode: ${selectedMonthLabel}   |   Diurutkan berdasarkan Profit Bersih & Kuantitas Terjual   |   Mata Uang: IDR (Rupiah)`;
    pMeta.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: "FFE2E8F0" } };
    pMeta.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyMedium } };
    pMeta.alignment = { vertical: "middle", horizontal: "center" };
    wsProduct.getRow(3).height = 22;

    // Header Tabel Sheet 2 (Row 5)
    const pHeaders = [
      "No (#)",
      "ID Produk",
      "Nama Produk / Layanan",
      "Unit Terjual",
      "Harga Rata-rata / Unit",
      "Total Omzet Penjualan",
      "Total Modal HPP",
      "Total Profit Bersih",
      "Net Margin (%)",
      "Rata-rata Profit / Unit"
    ];
    const pHeaderRow = 5;
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"].forEach((col, idx) => {
      const cell = wsProduct.getCell(`${col}${pHeaderRow}`);
      cell.value = pHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldDark } };
      cell.alignment = { vertical: "middle", horizontal: idx < 2 ? "center" : idx === 2 ? "left" : "right" };
      applyBorder(cell);
    });
    wsProduct.getRow(pHeaderRow).height = 26;

    let pR = 6;
    if (productSalesList.length === 0) {
      wsProduct.mergeCells(`A${pR}:J${pR}`);
      const emptyCell = wsProduct.getCell(`A${pR}`);
      emptyCell.value = `Belum ada transaksi penjualan yang lunas pada periode ${selectedMonthLabel}.`;
      emptyCell.font = { name: THEME.fontName, size: 10, italic: true, color: { argb: THEME.textMuted } };
      emptyCell.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(emptyCell);
      wsProduct.getRow(pR).height = 30;
      pR++;
    } else {
      productSalesList.forEach((prod, idx) => {
        const rowNum = pR++;
        const isZebra = idx % 2 === 1;
        const bg = isZebra ? THEME.zebraRow : "FFFFFFFF";

        const avgPrice = prod.totalQuantity > 0 ? Math.round(prod.totalSales / prod.totalQuantity) : 0;
        const avgProfitPerUnit = prod.totalQuantity > 0 ? Math.round(prod.totalProfit / prod.totalQuantity) : 0;
        const marginPct = prod.totalSales > 0 ? prod.totalProfit / prod.totalSales : 0;

        // Col A: Rank
        const cA = wsProduct.getCell(`A${rowNum}`);
        cA.value = idx + 1;
        cA.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
        cA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cA.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cA);

        // Col B: ID Produk
        const cB = wsProduct.getCell(`B${rowNum}`);
        cB.value = prod.productId ? `#${prod.productId}` : "-";
        cB.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textMuted } };
        cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cB.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cB);

        // Col C: Nama Produk
        const cC = wsProduct.getCell(`C${rowNum}`);
        cC.value = prod.productName;
        cC.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
        cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cC.alignment = { vertical: "middle", horizontal: "left" };
        applyBorder(cC);

        // Col D: Unit Terjual
        const cD = wsProduct.getCell(`D${rowNum}`);
        cD.value = prod.totalQuantity;
        cD.numFmt = `#,##0 "Unit"`;
        cD.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
        cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cD.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cD);

        // Col E: Rata-rata Harga Jual
        const cE = wsProduct.getCell(`E${rowNum}`);
        cE.value = avgPrice;
        cE.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cE.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
        cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cE.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cE);

        // Col F: Total Omzet
        const cF = wsProduct.getCell(`F${rowNum}`);
        cF.value = prod.totalSales;
        cF.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cF.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
        cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cF.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cF);

        // Col G: Total Modal HPP
        const cG = wsProduct.getCell(`G${rowNum}`);
        cG.value = prod.totalCost;
        cG.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cG.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textMuted } };
        cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cG.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cG);

        // Col H: Total Profit Bersih (Highlighted)
        const cH = wsProduct.getCell(`H${rowNum}`);
        cH.value = prod.totalProfit;
        cH.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cH.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.emeraldText } };
        cH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
        cH.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cH);

        // Col I: Margin Keuntungan (%)
        const cI = wsProduct.getCell(`I${rowNum}`);
        cI.value = marginPct;
        cI.numFmt = "0.0%";
        cI.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.emeraldText } };
        cI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
        cI.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cI);

        // Col J: Rata-rata Profit / Unit
        const cJ = wsProduct.getCell(`J${rowNum}`);
        cJ.value = avgProfitPerUnit;
        cJ.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cJ.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.emeraldText } };
        cJ.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cJ.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cJ);

        wsProduct.getRow(rowNum).height = 21;
      });

      // Total Row Sheet 2
      const lastDataRow = pR - 1;
      const totalRow = pR++;

      wsProduct.mergeCells(`A${totalRow}:C${totalRow}`);
      const tLabel = wsProduct.getCell(`A${totalRow}`);
      tLabel.value = "TOTAL AKUMULASI PRODUK TERJUAL";
      tLabel.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tLabel.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tLabel, true);
      applyBorder(wsProduct.getCell(`B${totalRow}`), true);
      applyBorder(wsProduct.getCell(`C${totalRow}`), true);

      // Sum Unit
      const tUnit = wsProduct.getCell(`D${totalRow}`);
      tUnit.value = { formula: `SUM(D6:D${lastDataRow})`, result: productSalesList.reduce((acc, p) => acc + p.totalQuantity, 0) };
      tUnit.numFmt = `#,##0 "Unit"`;
      tUnit.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tUnit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tUnit.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tUnit, true);

      // Blank for avg price
      const tAvgPrice = wsProduct.getCell(`E${totalRow}`);
      tAvgPrice.value = "-";
      tAvgPrice.font = { name: THEME.fontName, size: 10, color: { argb: THEME.textMuted } };
      tAvgPrice.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tAvgPrice.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(tAvgPrice, true);

      // Sum Omzet
      const tSales = wsProduct.getCell(`F${totalRow}`);
      tSales.value = { formula: `SUM(F6:F${lastDataRow})`, result: productSalesList.reduce((acc, p) => acc + p.totalSales, 0) };
      tSales.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      tSales.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tSales.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tSales.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tSales, true);

      // Sum HPP
      const tCost = wsProduct.getCell(`G${totalRow}`);
      tCost.value = { formula: `SUM(G6:G${lastDataRow})`, result: productSalesList.reduce((acc, p) => acc + p.totalCost, 0) };
      tCost.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      tCost.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tCost.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tCost.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tCost, true);

      // Sum Profit
      const tProfit = wsProduct.getCell(`H${totalRow}`);
      tProfit.value = { formula: `SUM(H6:H${lastDataRow})`, result: productSalesList.reduce((acc, p) => acc + p.totalProfit, 0) };
      tProfit.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      tProfit.font = { name: THEME.fontName, size: 10.5, bold: true, color: { argb: THEME.emeraldText } };
      tProfit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
      tProfit.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tProfit, true);

      // Weighted Margin Formula
      const tMargin = wsProduct.getCell(`I${totalRow}`);
      tMargin.value = { formula: `IF(F${totalRow}>0, H${totalRow}/F${totalRow}, 0)`, result: periodMarginPercentage / 100 };
      tMargin.numFmt = "0.0%";
      tMargin.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.emeraldText } };
      tMargin.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
      tMargin.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tMargin, true);

      // Blank for avg profit per unit
      const tAvgProfit = wsProduct.getCell(`J${totalRow}`);
      tAvgProfit.value = "-";
      tAvgProfit.font = { name: THEME.fontName, size: 10, color: { argb: THEME.textMuted } };
      tAvgProfit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tAvgProfit.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(tAvgProfit, true);

      wsProduct.getRow(totalRow).height = 24;

      // Aktifkan Filter Otomatis
      wsProduct.autoFilter = {
        from: `A5`,
        to: `J${lastDataRow}`,
      };
    }

    // -------------------------------------------------------------------------
    // SHEET 3: RINCIAN TRANSAKSI (DETAILED TRANSACTION JOURNAL)
    // -------------------------------------------------------------------------
    const wsOrders = workbook.addWorksheet("Rincian Transaksi", {
      views: [{ state: "frozen", ySplit: 5, showGridLines: true }],
    });

    wsOrders.columns = [
      { key: "no", width: 7 },           // Col A: No
      { key: "orderNumber", width: 22 }, // Col B: No. Invoice
      { key: "date", width: 23 },        // Col C: Tanggal & Waktu (WIB)
      { key: "phone", width: 18 },       // Col D: No. WhatsApp
      { key: "email", width: 25 },       // Col E: Email
      { key: "items", width: 38 },       // Col F: Rincian Produk & Qty
      { key: "qty", width: 12 },         // Col G: Total Unit
      { key: "payment", width: 15 },     // Col H: Metode Bayar
      { key: "status", width: 16 },      // Col I: Status
      { key: "sales", width: 24 },       // Col J: Omzet / Harga Jual
      { key: "cost", width: 24 },        // Col K: Modal HPP
      { key: "profit", width: 24 },      // Col L: Profit Bersih
      { key: "margin", width: 16 },      // Col M: % Margin
    ];

    // Banner Header Sheet 3
    wsOrders.mergeCells("A2:M2");
    const oTitle = wsOrders.getCell("A2");
    oTitle.value = "JURNAL RINCIAN TRANSAKSI PENJUALAN & PROFIT BERSIH";
    oTitle.font = { name: THEME.fontName, size: 14, bold: true, color: { argb: THEME.textWhite } };
    oTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyDark } };
    oTitle.alignment = { vertical: "middle", horizontal: "center" };
    wsOrders.getRow(2).height = 32;

    wsOrders.mergeCells("A3:M3");
    const oMeta = wsOrders.getCell("A3");
    oMeta.value = `Periode: ${selectedMonthLabel}   |   Mencakup Seluruh Transaksi Berhasil (Lunas & Selesai)   |   Mata Uang: IDR (Rupiah)`;
    oMeta.font = { name: THEME.fontName, size: 9.5, italic: true, color: { argb: "FFE2E8F0" } };
    oMeta.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyMedium } };
    oMeta.alignment = { vertical: "middle", horizontal: "center" };
    wsOrders.getRow(3).height = 22;

    // Header Tabel Sheet 3 (Row 5)
    const oHeaders = [
      "No",
      "No. Invoice",
      "Tanggal & Waktu (WIB)",
      "WhatsApp Pelanggan",
      "Email Pelanggan",
      "Rincian Produk / Layanan",
      "Total Qty",
      "Metode Bayar",
      "Status",
      "Omzet Penjualan",
      "Estimasi Modal HPP",
      "Profit Bersih (Margin)",
      "Net Margin (%)"
    ];
    const oHeaderRow = 5;
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"].forEach((col, idx) => {
      const cell = wsOrders.getCell(`${col}${oHeaderRow}`);
      cell.value = oHeaders[idx];
      cell.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textWhite } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.navyDark } };
      cell.alignment = { vertical: "middle", horizontal: idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 7 || idx === 8 ? "center" : idx === 4 || idx === 5 ? "left" : "right" };
      applyBorder(cell);
    });
    wsOrders.getRow(oHeaderRow).height = 26;

    let oR = 6;
    if (periodOrdersList.length === 0) {
      wsOrders.mergeCells(`A${oR}:M${oR}`);
      const emptyCell = wsOrders.getCell(`A${oR}`);
      emptyCell.value = `Belum ada riwayat pesanan lunas pada periode ${selectedMonthLabel}.`;
      emptyCell.font = { name: THEME.fontName, size: 10, italic: true, color: { argb: THEME.textMuted } };
      emptyCell.alignment = { vertical: "middle", horizontal: "center" };
      applyBorder(emptyCell);
      wsOrders.getRow(oR).height = 30;
      oR++;
    } else {
      periodOrdersList.forEach((item, idx) => {
        const rowNum = oR++;
        const isZebra = idx % 2 === 1;
        const bg = isZebra ? THEME.zebraRow : "FFFFFFFF";
        const orderDateStr = formatDateWIB(item.order.paidAt || item.order.createdAt);
        const marginPct = item.orderRevenue > 0 ? item.orderProfit / item.orderRevenue : 0;

        // Col A: No
        const cA = wsOrders.getCell(`A${rowNum}`);
        cA.value = idx + 1;
        cA.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
        cA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cA.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cA);

        // Col B: Invoice
        const cB = wsOrders.getCell(`B${rowNum}`);
        cB.value = item.order.orderNumber;
        cB.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.blueSky } };
        cB.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cB.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cB);

        // Col C: Date
        const cC = wsOrders.getCell(`C${rowNum}`);
        cC.value = orderDateStr;
        cC.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
        cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cC.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cC);

        // Col D: Phone
        const cD = wsOrders.getCell(`D${rowNum}`);
        cD.value = item.order.customerPhone || "-";
        cD.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
        cD.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cD.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cD);

        // Col E: Email
        const cE = wsOrders.getCell(`E${rowNum}`);
        cE.value = item.order.customerEmail || "-";
        cE.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
        cE.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cE.alignment = { vertical: "middle", horizontal: "left" };
        applyBorder(cE);

        // Col F: Items
        const cF = wsOrders.getCell(`F${rowNum}`);
        cF.value = item.itemsSummary;
        cF.font = { name: THEME.fontName, size: 9, color: { argb: THEME.textDark } };
        cF.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cF.alignment = { vertical: "middle", horizontal: "left" };
        applyBorder(cF);

        // Col G: Total Qty
        const cG = wsOrders.getCell(`G${rowNum}`);
        cG.value = item.totalQuantity;
        cG.numFmt = `#,##0`;
        cG.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textDark } };
        cG.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cG.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cG);

        // Col H: Payment Method
        const cH = wsOrders.getCell(`H${rowNum}`);
        cH.value = item.paymentMethod;
        cH.font = { name: THEME.fontName, size: 9, bold: true, color: { argb: THEME.textDark } };
        cH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cH.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cH);

        // Col I: Status
        const cI = wsOrders.getCell(`I${rowNum}`);
        cI.value = (item.order.status || "").toUpperCase();
        cI.font = { name: THEME.fontName, size: 9, bold: true, color: { argb: item.order.status === "completed" ? THEME.emeraldText : THEME.blueSky } };
        cI.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cI.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cI);

        // Col J: Omzet
        const cJ = wsOrders.getCell(`J${rowNum}`);
        cJ.value = item.orderRevenue;
        cJ.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cJ.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.textDark } };
        cJ.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cJ.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cJ);

        // Col K: HPP
        const cK = wsOrders.getCell(`K${rowNum}`);
        cK.value = item.orderCost;
        cK.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cK.font = { name: THEME.fontName, size: 9.5, color: { argb: THEME.textMuted } };
        cK.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cK.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cK);

        // Col L: Profit Bersih
        const cL = wsOrders.getCell(`L${rowNum}`);
        cL.value = item.orderProfit;
        cL.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
        cL.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.emeraldText } };
        cL.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
        cL.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cL);

        // Col M: Margin %
        const cM = wsOrders.getCell(`M${rowNum}`);
        cM.value = marginPct;
        cM.numFmt = "0.0%";
        cM.font = { name: THEME.fontName, size: 9.5, bold: true, color: { argb: THEME.emeraldText } };
        cM.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
        cM.alignment = { vertical: "middle", horizontal: "right" };
        applyBorder(cM);

        wsOrders.getRow(rowNum).height = 21;
      });

      // Total Row Sheet 3
      const lastOrderRow = oR - 1;
      const totalOrderRow = oR++;

      wsOrders.mergeCells(`A${totalOrderRow}:F${totalOrderRow}`);
      const tLabel = wsOrders.getCell(`A${totalOrderRow}`);
      tLabel.value = "TOTAL AKUMULASI TRANSAKSI";
      tLabel.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tLabel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tLabel.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tLabel, true);
      ["B", "C", "D", "E", "F"].forEach(c => applyBorder(wsOrders.getCell(`${c}${totalOrderRow}`), true));

      // Sum Qty
      const tQty = wsOrders.getCell(`G${totalOrderRow}`);
      tQty.value = { formula: `SUM(G6:G${lastOrderRow})`, result: periodOrdersList.reduce((acc, o) => acc + o.totalQuantity, 0) };
      tQty.numFmt = `#,##0`;
      tQty.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tQty.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tQty.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tQty, true);

      // Blank for payment & status
      ["H", "I"].forEach(col => {
        const cBlank = wsOrders.getCell(`${col}${totalOrderRow}`);
        cBlank.value = "-";
        cBlank.font = { name: THEME.fontName, size: 10, color: { argb: THEME.textMuted } };
        cBlank.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
        cBlank.alignment = { vertical: "middle", horizontal: "center" };
        applyBorder(cBlank, true);
      });

      // Sum Omzet
      const tSales = wsOrders.getCell(`J${totalOrderRow}`);
      tSales.value = { formula: `SUM(J6:J${lastOrderRow})`, result: periodRevenue };
      tSales.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      tSales.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tSales.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tSales.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tSales, true);

      // Sum HPP
      const tCost = wsOrders.getCell(`K${totalOrderRow}`);
      tCost.value = { formula: `SUM(K6:K${lastOrderRow})`, result: periodCost };
      tCost.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      tCost.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.textDark } };
      tCost.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.totalRow } };
      tCost.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tCost, true);

      // Sum Profit
      const tProfit = wsOrders.getCell(`L${totalOrderRow}`);
      tProfit.value = { formula: `SUM(L6:L${lastOrderRow})`, result: periodProfit };
      tProfit.numFmt = `_("Rp"* #,##0_);_("Rp"* (#,##0);_("Rp"* "-"_);_(@_)`;
      tProfit.font = { name: THEME.fontName, size: 10.5, bold: true, color: { argb: THEME.emeraldText } };
      tProfit.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
      tProfit.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tProfit, true);

      // Weighted Margin Formula
      const tMargin = wsOrders.getCell(`M${totalOrderRow}`);
      tMargin.value = { formula: `IF(J${totalOrderRow}>0, L${totalOrderRow}/J${totalOrderRow}, 0)`, result: periodMarginPercentage / 100 };
      tMargin.numFmt = "0.0%";
      tMargin.font = { name: THEME.fontName, size: 10, bold: true, color: { argb: THEME.emeraldText } };
      tMargin.fill = { type: "pattern", pattern: "solid", fgColor: { argb: THEME.emeraldSoft } };
      tMargin.alignment = { vertical: "middle", horizontal: "right" };
      applyBorder(tMargin, true);

      wsOrders.getRow(totalOrderRow).height = 24;

      // Aktifkan Filter Otomatis
      wsOrders.autoFilter = {
        from: `A5`,
        to: `M${lastOrderRow}`,
      };
    }

    // -------------------------------------------------------------------------
    // RENDER BUFFER EXCEL
    // -------------------------------------------------------------------------
    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const safeMonthStr = selectedMonth.replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `Laporan_Keuangan_NaraStore_${safeMonthStr}.xlsx`;

    return { buffer, filename };
  }
}

export const financialReportService = new FinancialReportService();
export default financialReportService;
