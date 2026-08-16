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
  lines.push("Breakdown Pembayaran");
  lines.push("Metode,Jumlah");
  report.paymentBreakdown.forEach((p) => lines.push(`${p.name},${p.amount}`));
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
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [isPending, startTransition] = useTransition();

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
      <div className="flex flex-wrap justify-between items-center gap-3 print:hidden">
        <h2 className="font-heading text-2xl text-primary">Laporan Penjualan</h2>
        <div className="flex gap-2">
          <button onClick={exportCSV} className="px-3 py-2 rounded-md border border-border text-sm">
            Export CSV
          </button>
          <button onClick={() => window.print()} className="px-3 py-2 rounded-md border border-border text-sm">
            Print
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={formatRupiah(report.revenue)} />
        <StatCard label="Jumlah Order" value={String(report.ordersCount)} />
        <StatCard label="Order Terbayar" value={String(report.paidOrdersCount)} />
        <StatCard label="Rata-rata Order" value={formatRupiah(report.averageOrderValue)} />
      </div>

      {/* TREND CHART */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
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
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h3 className="font-heading text-lg text-primary mb-4">Breakdown Pembayaran</h3>
        {report.paymentBreakdown.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada pembayaran pada periode ini.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {report.paymentBreakdown.map((p) => (
                <tr key={p.name} className="border-b border-border">
                  <td className="py-2">{p.name}</td>
                  <td className="py-2 text-right font-semibold">{formatRupiah(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* TOP / BOTTOM PRODUCTS */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ProductTable title="Produk Terlaris" products={report.topProducts} />
        <ProductTable title="Produk Kurang Laku" products={report.bottomProducts} />
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
