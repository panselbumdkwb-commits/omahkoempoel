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
import { getSalesReportAction } from "./actions";
import type { SalesReport } from "@/services/reportService";
import { formatJakartaDateTime } from "@/lib/timezone";
import { extractInclusiveTax } from "@/lib/tax";

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

function toCSV(report: SalesReport): string {
  const lines: string[] = [];
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
  initialStart,
  initialEnd,
}: {
  initialReport: SalesReport;
  initialStart: string;
  initialEnd: string;
}) {
  const [report, setReport] = useState<SalesReport>(initialReport);
  const [period, setPeriod] = useState<"today" | "week" | "month" | "custom">("today");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isPending, startTransition] = useTransition();
  const [printSection, setPrintSection] = useState<
    "all" | "summary" | "payment" | "transactions" | "products"
  >("all");

  const PRINT_SECTION_LABEL: Record<typeof printSection, string> = {
    all: "Laporan Lengkap",
    summary: "Ringkasan Penjualan",
    payment: "Rekap Metode Pembayaran",
    transactions: "Daftar Transaksi Pembayaran",
    products: "Produk Terlaris & Kurang Laku",
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
      const data = await getSalesReportAction(start.toISOString(), end.toISOString());
      setReport(data);
    });
  }

  function loadCustom() {
    if (!customStart || !customEnd) return;
    setPeriod("custom");
    startTransition(async () => {
      const data = await getSalesReportAction(
        new Date(customStart).toISOString(),
        new Date(new Date(customEnd).getTime() + 24 * 60 * 60 * 1000).toISOString()
      );
      setReport(data);
    });
  }

  function exportCSV() {
    const blob = new Blob([toCSV(report)], { type: "text/csv;charset=utf-8;" });
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
        <h2 className="font-heading text-2xl text-primary">Laporan Penjualan</h2>
        <div className="flex gap-2 items-center">
          <select
            value={printSection}
            onChange={(e) => setPrintSection(e.target.value as typeof printSection)}
            className="border border-border rounded-md px-2 py-2 text-sm bg-background dark:bg-background-dark"
            title="Pilih jenis laporan yang akan dicetak"
          >
            {Object.entries(PRINT_SECTION_LABEL).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <button onClick={exportCSV} className="px-3 py-2 rounded-md border border-border text-sm">
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-md bg-primary text-white text-sm font-semibold"
          >
            🖨️ Cetak Laporan
          </button>
        </div>
      </div>

      {/* PERIOD SELECTOR */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {(["today", "week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => loadPeriod(p)}
            className={`px-4 py-2 rounded-full text-sm font-semibold border ${
              period === p ? "bg-primary text-white border-primary" : "border-border"
            }`}
          >
            {p === "today" ? "Hari Ini" : p === "week" ? "Minggu Ini" : "Bulan Ini"}
          </button>
        ))}
        <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="border border-border rounded-md px-2 text-sm" />
        <span className="self-center text-sm">s/d</span>
        <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="border border-border rounded-md px-2 text-sm" />
        <button onClick={loadCustom} className="px-4 py-2 rounded-full text-sm font-semibold border border-border">
          Terapkan
        </button>
      </div>

      {isPending && <p className="text-sm text-text-muted">Memuat...</p>}

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print:hidden">
        <StatCard label="Revenue" value={formatRupiah(report.revenue)} />
        <StatCard label="Jumlah Order" value={String(report.ordersCount)} />
        <StatCard label="Order Terbayar" value={String(report.paidOrdersCount)} />
        <StatCard label="Rata-rata Order" value={formatRupiah(report.averageOrderValue)} />
      </div>

      {/* TREND CHART */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h3 className="font-heading text-lg text-primary mb-4">Tren Revenue Harian</h3>
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
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h3 className="font-heading text-lg text-primary mb-4">Rekap per Metode Pembayaran</h3>
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
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface dark:bg-surface-dark p-4">
      <p className="text-text-muted text-xs mb-1">{label}</p>
      <p className="font-heading text-xl text-primary">{value}</p>
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
    <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
      <h3 className="font-heading text-lg text-primary mb-3">{title}</h3>
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
