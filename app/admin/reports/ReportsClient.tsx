"use client";

import { useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { getSalesReportAction, getFinancialStatementAction } from "./actions";
import type { SalesReport, FinancialStatement } from "@/services/reportService";
import { formatJakartaDateTime } from "@/lib/timezone";
import { extractInclusiveTax } from "@/lib/tax";
import OperationalExpensesPanel from "./OperationalExpensesPanel";

type Expense = {
  id: string;
  name: string;
  category: "utility" | "social" | "other";
  calc_type: "fixed" | "percent_of_revenue" | "variable_manual";
  expense_type: "operational" | "non_operational";
  value: number;
  is_active: boolean;
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function jakartaRange(period: "today" | "week" | "month"): { start: Date; end: Date } {
  const now = new Date();
  const shifted = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  const d = shifted.getUTCDate();

  let startShiftedUTC: Date;
  if (period === "today") {
    startShiftedUTC = new Date(Date.UTC(y, m, d));
  } else if (period === "week") {
    const dow = shifted.getUTCDay() === 0 ? 7 : shifted.getUTCDay(); // Monday=1..Sunday=7
    startShiftedUTC = new Date(Date.UTC(y, m, d - (dow - 1)));
  } else {
    startShiftedUTC = new Date(Date.UTC(y, m, 1));
  }
  const start = new Date(startShiftedUTC.getTime() - JAKARTA_OFFSET_MS);
  const end = new Date();
  return { start, end };
}

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function toCSV(report: SalesReport, financials?: FinancialStatement): string {
  const lines: string[] = [];
  if (financials) {
    lines.push("Laporan Laba Rugi");
    lines.push(`Pendapatan,${financials.revenue}`);
    lines.push("Biaya Operasional");
    lines.push(`Belanja Bahan Baku (harian),${-financials.rawMaterialTotal}`);
    financials.operationalExpenses.forEach((e) => lines.push(`${e.name},${-e.amount}`));
    if (financials.depreciationOperationalTotal > 0) {
      lines.push(`Biaya Penyusutan Aset (operasional),${-financials.depreciationOperationalTotal}`);
    }
    lines.push(`Total Biaya Operasional,${-financials.operationalExpensesTotal}`);
    lines.push(`Laba Kotor,${financials.grossProfit}`);
    lines.push(`Total Gaji (Gross),${-financials.payrollCost}`);
    lines.push(`Laba Operasional,${financials.operatingProfit}`);
    lines.push("Biaya Non-Operasional");
    financials.nonOperationalExpenses.forEach((e) => lines.push(`${e.name},${-e.amount}`));
    if (financials.depreciationNonOperationalTotal > 0) {
      lines.push(`Biaya Penyusutan Aset (non-operasional),${-financials.depreciationNonOperationalTotal}`);
    }
    lines.push(`Total Biaya Non-Operasional,${-financials.nonOperationalExpensesTotal}`);
    lines.push(`Laba Bersih,${financials.netProfit}`);
    lines.push("");
  }
  lines.push("Ringkasan");
  lines.push(`Revenue,${report.revenue}`);
  lines.push(`Jumlah Order,${report.ordersCount}`);
  lines.push(`Order Terbayar,${report.paidOrdersCount}`);
  lines.push(`Rata-rata Order,${report.averageOrderValue}`);
  lines.push("");
  lines.push("Rekap per Metode Pembayaran");
  lines.push("Metode,Jumlah Transaksi,Total");
  report.paymentBreakdown.forEach((p) => lines.push(`${p.name},${p.count},${p.amount}`));
  lines.push("");
  lines.push("Daftar Transaksi Pembayaran");
  lines.push("Order,Metode,Waktu,Referensi,Jumlah");
  report.paymentTransactions.forEach((t) =>
    lines.push(`${t.orderNumber},${t.methodName},${t.paidAt},${t.referenceNo ?? ""},${t.amount}`)
  );
  lines.push("");
  lines.push("Produk Terlaris");
  lines.push("Nama,Qty,Revenue");
  report.topProducts.forEach((p) => lines.push(`${p.name},${p.quantity},${p.revenue}`));
  lines.push("");
  lines.push("Produk Kurang Laku");
  lines.push("Nama,Qty,Revenue");
  report.bottomProducts.forEach((p) => lines.push(`${p.name},${p.quantity},${p.revenue}`));
  return lines.join("\n");
}

export default function ReportsClient({
  initialReport,
  initialFinancials,
  initialStart,
  initialEnd,
  expenses,
}: {
  initialReport: SalesReport;
  initialFinancials: FinancialStatement;
  initialStart: string;
  initialEnd: string;
  expenses: Expense[];
}) {
  const [report, setReport] = useState<SalesReport>(initialReport);
  const [financials, setFinancials] = useState<FinancialStatement>(initialFinancials);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isPending, startTransition] = useTransition();
  const [printSection, setPrintSection] = useState<
    "all" | "summary" | "payment" | "transactions" | "products" | "labarugi"
  >("all");

  const PRINT_SECTION_LABEL: Record<typeof printSection, string> = {
    all: "Laporan Lengkap",
    summary: "Ringkasan Penjualan",
    payment: "Rekap Metode Pembayaran",
    transactions: "Daftar Transaksi Pembayaran",
    products: "Produk Terlaris & Kurang Laku",
    labarugi: "Laporan Laba Rugi",
  };

  const periodLabel =
    period === "today"
      ? "Hari Ini"
      : period === "week"
        ? "Minggu Ini"
        : period === "month"
          ? "Bulan Ini"
          : customStart && customEnd
            ? `${customStart} s/d ${customEnd}`
            : "Rentang Kustom";

  function loadPeriod(p: "today" | "week" | "month") {
    setPeriod(p);
    const { start, end } = jakartaRange(p);
    startTransition(async () => {
      const [salesData, financialData] = await Promise.all([
        getSalesReportAction(start.toISOString(), end.toISOString()),
        getFinancialStatementAction(start.toISOString(), end.toISOString()),
      ]);
      setReport(salesData);
      setFinancials(financialData);
    });
  }

  function loadCustom() {
    if (!customStart || !customEnd) return;
    setPeriod("custom");
    startTransition(async () => {
      const startISO = new Date(customStart).toISOString();
      const endISO = new Date(new Date(customEnd).getTime() + 24 * 60 * 60 * 1000).toISOString();
      const [salesData, financialData] = await Promise.all([
        getSalesReportAction(startISO, endISO),
        getFinancialStatementAction(startISO, endISO),
      ]);
      setReport(salesData);
      setFinancials(financialData);
    });
  }

  function exportCSV() {
    const blob = new Blob([toCSV(report, financials)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-penjualan-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 print:max-w-full">
      {/* CSS khusus saat mencetak laporan: A4, bukan 80mm thermal (beda dari
          nota/tiket dapur/slip gaji), karena ini dokumen laporan kantor. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body { background: white; }
        }
      `}</style>

      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Laporan Keuangan</p>
          <h2 className="font-heading text-2xl sm:text-3xl text-primary">Laporan Penjualan &amp; Laba Rugi</h2>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={printSection}
            onChange={(e) => setPrintSection(e.target.value as typeof printSection)}
            className="border border-border rounded-xl px-2 py-2.5 text-sm bg-background dark:bg-background-dark"
            title="Pilih jenis laporan yang akan dicetak"
          >
            {Object.entries(PRINT_SECTION_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button onClick={exportCSV} className="btn-ghost-modern">
            Export CSV
          </button>
          <button onClick={() => window.print()} className="btn-primary-modern">
            🖨️ Cetak Laporan
          </button>
        </div>
      </div>

      {/* PERIOD SELECTOR */}
      <div className="flex flex-wrap gap-2 items-center print:hidden">
        {(["today", "week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => loadPeriod(p)}
            className={`pill-nav-link border ${
              period === p ? "pill-nav-link-active border-primary" : "border-border pill-nav-link-inactive"
            }`}
          >
            {p === "today" ? "Hari Ini" : p === "week" ? "Minggu Ini" : "Bulan Ini"}
          </button>
        ))}
        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-border rounded-xl px-3 py-2 text-sm bg-surface dark:bg-surface-dark" />
        <span className="self-center text-sm text-text-muted">s/d</span>
        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-border rounded-xl px-3 py-2 text-sm bg-surface dark:bg-surface-dark" />
        <button onClick={loadCustom} className="pill-nav-link border border-border pill-nav-link-inactive">
          Terapkan
        </button>
      </div>

      {isPending && <p className="text-sm text-text-muted animate-pulse">Memuat data terbaru...</p>}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        <StatCard label="Revenue" value={formatRupiah(report.revenue)} accent="primary" />
        <StatCard label="Jumlah Order" value={String(report.ordersCount)} accent="secondary" />
        <StatCard label="Order Terbayar" value={String(report.paidOrdersCount)} accent="success" />
        <StatCard label="Rata-rata Order" value={formatRupiah(report.averageOrderValue)} accent="accent" />
      </div>

      {/* LAPORAN LABA RUGI (P&L) */}
      <section className="card-modern p-5 print:hidden">
        <div className="flex items-center justify-between mb-1">
          <h3 className="section-title-modern">📊 Laporan Laba Rugi</h3>
          <span className="badge-modern bg-background dark:bg-background-dark text-text-muted">{periodLabel}</span>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Pendapatan dikurangi biaya operasional (di luar gaji), biaya gaji pegawai, lalu biaya
          non-operasional — belum termasuk HPP bahan baku (menyusul di modul Inventory).
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          <PnlCard label="Laba Kotor" sub="Pendapatan − Biaya Operasional" value={financials.grossProfit} tone="neutral" />
          <PnlCard label="Laba Operasional" sub="Laba Kotor − Biaya Gaji" value={financials.operatingProfit} tone="neutral" />
          <PnlCard label="Laba Bersih" sub="Laba Operasional − Non-Operasional" value={financials.netProfit} tone="final" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <PnlRow label="Pendapatan (Penjualan)" value={financials.revenue} bold />
              <PnlSectionHeader label="Biaya Operasional" />
              <PnlRow
                label="Belanja Bahan Baku (harian)"
                value={-financials.rawMaterialTotal}
                indent
                note={financials.rawMaterialTotal === 0 ? "belum ada catatan di periode ini" : undefined}
              />
              {financials.operationalExpenses.length === 0 ? (
                <PnlEmptyRow note="belum ada biaya tetap/variabel lain" />
              ) : (
                financials.operationalExpenses.map((e) => (
                  <PnlRow key={e.name} label={e.name} value={-e.amount} indent note={!e.recorded ? "belum dicatat" : undefined} />
                ))
              )}
              {financials.depreciationOperationalTotal > 0 && (
                <PnlRow label="Biaya Penyusutan Aset (operasional)" value={-financials.depreciationOperationalTotal} indent />
              )}
              <PnlRow label="Total Biaya Operasional" value={-financials.operationalExpensesTotal} indent bold />
              <PnlRow label="Laba Kotor" value={financials.grossProfit} bold accentTotal />

              <PnlSectionHeader label={`Biaya Gaji Pegawai${financials.payrollPeriodsIncluded > 0 ? ` (${financials.payrollPeriodsIncluded} periode payroll)` : ""}`} />
              <PnlRow
                label="Total Gaji (Gross)"
                value={-financials.payrollCost}
                indent
                note={financials.payrollPeriodsIncluded === 0 ? "belum ada periode payroll dijalankan dalam rentang ini" : undefined}
              />
              <PnlRow label="Laba Operasional" value={financials.operatingProfit} bold accentTotal />

              <PnlSectionHeader label="Biaya Non-Operasional" />
              {financials.nonOperationalExpenses.length === 0 && financials.depreciationNonOperationalTotal === 0 ? (
                <PnlEmptyRow note="belum ada biaya diklasifikasikan non-operasional" />
              ) : (
                financials.nonOperationalExpenses.map((e) => (
                  <PnlRow key={e.name} label={e.name} value={-e.amount} indent note={!e.recorded ? "belum dicatat" : undefined} />
                ))
              )}
              {financials.depreciationNonOperationalTotal > 0 && (
                <PnlRow label="Biaya Penyusutan Aset (non-operasional)" value={-financials.depreciationNonOperationalTotal} indent />
              )}
              <PnlRow label="Total Biaya Non-Operasional" value={-financials.nonOperationalExpensesTotal} indent bold />

              <tr className="border-t-2 border-primary">
                <td className="py-3 font-heading text-base text-primary">Laba Bersih</td>
                <td className={`py-3 text-right font-heading text-base ${financials.netProfit >= 0 ? "text-success" : "text-danger"}`}>
                  {formatRupiah(financials.netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-text-muted mt-3">
          Kelola Belanja Bahan Baku &amp; Aset (Penyusutan) di{" "}
          <a href="/admin/purchases" className="text-primary underline">halaman Belanja Bahan Baku &amp; Aset</a>,
          dan klasifikasikan biaya tetap/variabel lain di{" "}
          <a href="/admin/payroll" className="text-primary underline">Payroll → Biaya Operasional</a>.
        </p>
      </section>

      {/* TREND CHART */}
      <section className="card-modern p-5 print:hidden">
        <h3 className="section-title-modern mb-4">📈 Tren Revenue Harian</h3>
        {report.dailyTrend.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada data pada periode ini.</p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={report.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatRupiah(v)} />
              <Bar dataKey="revenue" fill="#B5651D" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* PAYMENT BREAKDOWN */}
      <section className="card-modern p-5 print:hidden">
        <h3 className="section-title-modern mb-4">💳 Rekap per Metode Pembayaran</h3>
        {report.paymentBreakdown.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada pembayaran pada periode ini.</p>
        ) : (
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="text-text-muted text-left">
                <th className="pb-2">Metode</th>
                <th className="pb-2 text-right">Jumlah Transaksi</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.paymentBreakdown.map((p) => (
                <tr
                  key={p.name}
                  className={`border-t border-border cursor-pointer ${methodFilter === p.name ? "bg-background dark:bg-background-dark" : ""}`}
                  onClick={() => setMethodFilter(methodFilter === p.name ? "all" : p.name)}
                >
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right">{p.count}</td>
                  <td className="py-2 text-right font-semibold">{formatRupiah(p.amount)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-bold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right">{report.paymentBreakdown.reduce((s, p) => s + p.count, 0)}</td>
                <td className="py-2 text-right">
                  {formatRupiah(report.paymentBreakdown.reduce((s, p) => s + p.amount, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {report.paymentTransactions.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-2">
              <p className="text-sm font-semibold">
                Daftar Transaksi {methodFilter !== "all" && `— ${methodFilter}`}
              </p>
              {methodFilter !== "all" && (
                <button onClick={() => setMethodFilter("all")} className="text-xs text-primary">
                  Tampilkan semua
                </button>
              )}
            </div>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-muted text-left sticky top-0 bg-surface dark:bg-surface-dark">
                    <th className="pb-2">Order</th>
                    <th className="pb-2">Metode</th>
                    <th className="pb-2">Waktu</th>
                    <th className="pb-2">Referensi</th>
                    <th className="pb-2 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentTransactions
                    .filter((t) => methodFilter === "all" || t.methodName === methodFilter)
                    .map((t, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1.5">{t.orderNumber}</td>
                        <td className="py-1.5">{t.methodName}</td>
                        <td className="py-1.5">{formatJakartaDateTime(t.paidAt)}</td>
                        <td className="py-1.5">{t.referenceNo || "-"}</td>
                        <td className="py-1.5 text-right">{formatRupiah(t.amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* TOP / BOTTOM PRODUCTS */}
      <div className="grid sm:grid-cols-2 gap-4 print:hidden">
        <ProductTable title="Produk Terlaris" products={report.topProducts} />
        <ProductTable title="Produk Kurang Laku" products={report.bottomProducts} />
      </div>

      {/* ======================================================
          BLOK KHUSUS CETAK — hanya tampil saat print (hidden di
          layar). Format dokumen laporan polos: header bisnis,
          judul laporan sesuai pilihan Owner, tabel hitam-putih
          tanpa elemen dashboard (kartu warna, grafik, scroll).
          ====================================================== */}
      <div className="hidden print:block font-sans text-black bg-white">
        <div className="text-center mb-6 pb-3 border-b-2 border-black">
          <h1 className="text-xl font-bold">OMAH KOEMPOEL</h1>
          <p className="text-sm">Laporan {PRINT_SECTION_LABEL[printSection]}</p>
          <p className="text-xs mt-1">
            Periode: {periodLabel} &middot; Dicetak: {formatJakartaDateTime(new Date())}
          </p>
        </div>

        {(printSection === "all" || printSection === "summary") && (
          <section className="mb-6">
            <h2 className="font-bold text-sm mb-2 uppercase">Ringkasan Penjualan</h2>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-black">
                  <td className="py-1">Revenue (Termasuk Pajak)</td>
                  <td className="py-1 text-right font-semibold">{formatRupiah(report.revenue)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1">DPP (Sebelum Pajak)</td>
                  <td className="py-1 text-right">{formatRupiah(extractInclusiveTax(report.revenue).dpp)}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1">Pajak Daerah (PB1) 10%</td>
                  <td className="py-1 text-right">
                    {formatRupiah(extractInclusiveTax(report.revenue).taxAmount)}
                  </td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1">Jumlah Order</td>
                  <td className="py-1 text-right">{report.ordersCount}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1">Order Terbayar</td>
                  <td className="py-1 text-right">{report.paidOrdersCount}</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1">Rata-rata Order</td>
                  <td className="py-1 text-right">{formatRupiah(report.averageOrderValue)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {(printSection === "all" || printSection === "payment") && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="font-bold text-sm mb-2 uppercase">Rekap per Metode Pembayaran</h2>
            {report.paymentBreakdown.length === 0 ? (
              <p className="text-sm">Belum ada pembayaran pada periode ini.</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-black text-left">
                    <th className="py-1">Metode</th>
                    <th className="py-1 text-right">Jumlah Transaksi</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentBreakdown.map((p) => (
                    <tr key={p.name} className="border-b border-black">
                      <td className="py-1">{p.name}</td>
                      <td className="py-1 text-right">{p.count}</td>
                      <td className="py-1 text-right">{formatRupiah(p.amount)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-1">Total</td>
                    <td className="py-1 text-right">
                      {report.paymentBreakdown.reduce((s, p) => s + p.count, 0)}
                    </td>
                    <td className="py-1 text-right">
                      {formatRupiah(report.paymentBreakdown.reduce((s, p) => s + p.amount, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>
        )}

        {(printSection === "all" || printSection === "transactions") && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="font-bold text-sm mb-2 uppercase">Daftar Transaksi Pembayaran</h2>
            {report.paymentTransactions.length === 0 ? (
              <p className="text-sm">Belum ada transaksi pada periode ini.</p>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-black text-left">
                    <th className="py-1">Order</th>
                    <th className="py-1">Metode</th>
                    <th className="py-1">Waktu</th>
                    <th className="py-1">Referensi</th>
                    <th className="py-1 text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {report.paymentTransactions.map((t, i) => (
                    <tr key={i} className="border-b border-black">
                      <td className="py-1">{t.orderNumber}</td>
                      <td className="py-1">{t.methodName}</td>
                      <td className="py-1">{formatJakartaDateTime(t.paidAt)}</td>
                      <td className="py-1">{t.referenceNo || "-"}</td>
                      <td className="py-1 text-right">{formatRupiah(t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        {(printSection === "all" || printSection === "products") && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="font-bold text-sm mb-2 uppercase">Produk Terlaris</h2>
            <PrintProductTable products={report.topProducts} />
            <h2 className="font-bold text-sm mb-2 mt-4 uppercase">Produk Kurang Laku</h2>
            <PrintProductTable products={report.bottomProducts} />
          </section>
        )}

        {(printSection === "all" || printSection === "labarugi") && (
          <section className="mb-6 break-inside-avoid">
            <h2 className="font-bold text-sm mb-2 uppercase">Laporan Laba Rugi</h2>
            <table className="w-full text-sm border-collapse">
              <tbody>
                <tr className="border-b border-black font-semibold">
                  <td className="py-1">Pendapatan (Penjualan)</td>
                  <td className="py-1 text-right">{formatRupiah(financials.revenue)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="pt-2 pb-1 text-xs font-bold uppercase">Biaya Operasional</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1 pl-3">Belanja Bahan Baku (harian)</td>
                  <td className="py-1 text-right">{formatRupiah(-financials.rawMaterialTotal)}</td>
                </tr>
                {financials.operationalExpenses.map((e) => (
                  <tr key={e.name} className="border-b border-black">
                    <td className="py-1 pl-3">{e.name}</td>
                    <td className="py-1 text-right">{formatRupiah(-e.amount)}</td>
                  </tr>
                ))}
                {financials.depreciationOperationalTotal > 0 && (
                  <tr className="border-b border-black">
                    <td className="py-1 pl-3">Biaya Penyusutan Aset (operasional)</td>
                    <td className="py-1 text-right">{formatRupiah(-financials.depreciationOperationalTotal)}</td>
                  </tr>
                )}
                <tr className="border-b border-black font-semibold">
                  <td className="py-1 pl-3">Total Biaya Operasional</td>
                  <td className="py-1 text-right">{formatRupiah(-financials.operationalExpensesTotal)}</td>
                </tr>
                <tr className="border-b-2 border-black font-bold">
                  <td className="py-1">Laba Kotor</td>
                  <td className="py-1 text-right">{formatRupiah(financials.grossProfit)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="pt-2 pb-1 text-xs font-bold uppercase">Biaya Gaji Pegawai</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="py-1 pl-3">Total Gaji (Gross)</td>
                  <td className="py-1 text-right">{formatRupiah(-financials.payrollCost)}</td>
                </tr>
                <tr className="border-b-2 border-black font-bold">
                  <td className="py-1">Laba Operasional</td>
                  <td className="py-1 text-right">{formatRupiah(financials.operatingProfit)}</td>
                </tr>
                <tr>
                  <td colSpan={2} className="pt-2 pb-1 text-xs font-bold uppercase">Biaya Non-Operasional</td>
                </tr>
                {financials.nonOperationalExpenses.length === 0 && financials.depreciationNonOperationalTotal === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-1 pl-3 italic text-xs">Tidak ada</td>
                  </tr>
                ) : (
                  financials.nonOperationalExpenses.map((e) => (
                    <tr key={e.name} className="border-b border-black">
                      <td className="py-1 pl-3">{e.name}</td>
                      <td className="py-1 text-right">{formatRupiah(-e.amount)}</td>
                    </tr>
                  ))
                )}
                {financials.depreciationNonOperationalTotal > 0 && (
                  <tr className="border-b border-black">
                    <td className="py-1 pl-3">Biaya Penyusutan Aset (non-operasional)</td>
                    <td className="py-1 text-right">{formatRupiah(-financials.depreciationNonOperationalTotal)}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-black font-bold text-base">
                  <td className="py-2">LABA BERSIH</td>
                  <td className="py-2 text-right">{formatRupiah(financials.netProfit)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}
      </div>

      <OperationalExpensesPanel expenses={expenses} />
    </div>
  );
}



function ProductTable({
  title,
  products,
}: {
  title: string;
  products: { name: string; quantity: number; revenue: number }[];
}) {
  return (
    <section className="card-modern p-5">
      <h3 className="section-title-modern mb-3">{title}</h3>
      {products.length === 0 ? (
        <p className="text-sm text-text-muted">Belum ada data.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-left">
              <th className="pb-2">Produk</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.name} className="border-t border-border">
                <td className="py-2">{p.name}</td>
                <td className="py-2 text-right">{p.quantity}</td>
                <td className="py-2 text-right">{formatRupiah(p.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function PrintProductTable({
  products,
}: {
  products: { name: string; quantity: number; revenue: number }[];
}) {
  if (products.length === 0) return <p className="text-sm">Belum ada data.</p>;
  return (
    <table className="w-full text-xs border-collapse mb-2">
      <thead>
        <tr className="border-b-2 border-black text-left">
          <th className="py-1">Produk</th>
          <th className="py-1 text-right">Qty</th>
          <th className="py-1 text-right">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {products.map((p) => (
          <tr key={p.name} className="border-b border-black">
            <td className="py-1">{p.name}</td>
            <td className="py-1 text-right">{p.quantity}</td>
            <td className="py-1 text-right">{formatRupiah(p.revenue)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const STAT_ACCENT_CLASS: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary dark:text-secondary-dark",
  success: "text-success",
  accent: "text-accent",
};

function StatCard({ label, value, accent = "primary" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="stat-card-modern">
      <p className="text-text-muted text-xs font-medium">{label}</p>
      <p className={`font-heading text-xl ${STAT_ACCENT_CLASS[accent] ?? "text-primary"}`}>{value}</p>
    </div>
  );
}

function PnlCard({ label, sub, value, tone }: { label: string; sub: string; value: number; tone: "neutral" | "final" }) {
  const positive = value >= 0;
  return (
    <div className={`rounded-xl p-4 border ${tone === "final" ? "border-primary bg-primary/5" : "border-border bg-background dark:bg-background-dark"}`}>
      <p className="text-xs font-semibold text-text-muted mb-0.5">{label}</p>
      <p className={`font-heading text-lg ${positive ? "text-success" : "text-danger"}`}>{formatRupiah(value)}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>
    </div>
  );
}

function PnlSectionHeader({ label }: { label: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-text-muted">
        {label}
      </td>
    </tr>
  );
}

function PnlEmptyRow({ note }: { note?: string }) {
  return (
    <tr>
      <td colSpan={2} className="py-1.5 text-xs text-text-muted italic pl-4">
        {note ?? "belum ada data biaya"}
      </td>
    </tr>
  );
}

function PnlRow({
  label,
  value,
  bold,
  indent,
  note,
  accentTotal,
}: {
  label: string;
  value: number;
  bold?: boolean;
  indent?: boolean;
  note?: string;
  accentTotal?: boolean;
}) {
  return (
    <tr className={accentTotal ? "border-t border-border" : "border-b border-border/60"}>
      <td className={`py-1.5 ${indent ? "pl-4" : ""} ${bold ? "font-semibold" : ""}`}>
        {label}
        {note && <span className="ml-2 text-[11px] text-warning font-normal">({note})</span>}
      </td>
      <td className={`py-1.5 text-right ${bold ? "font-semibold" : ""} ${accentTotal ? (value >= 0 ? "text-success" : "text-danger") : ""}`}>
        {formatRupiah(value)}
      </td>
    </tr>
  );
}
