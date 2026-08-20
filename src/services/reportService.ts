import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { computeMonthlyExpenseTotal } from "@/services/operationalExpenseService";

export type SalesReport = {
  revenue: number;
  ordersCount: number;
  paidOrdersCount: number;
  averageOrderValue: number;
  paymentBreakdown: { name: string; amount: number; count: number }[];
  dailyTrend: { date: string; revenue: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  bottomProducts: { name: string; quantity: number; revenue: number }[];
  paymentTransactions: {
    orderNumber: string;
    methodName: string;
    amount: number;
    referenceNo: string | null;
    paidAt: string;
  }[];
};

/**
 * Laporan penjualan untuk rentang tanggal bebas (harian/mingguan/
 * bulanan/custom tinggal beda startISO-endISO dari pemanggil).
 * Sama seperti dashboardService: agregasi dilakukan di JS dari baris
 * mentah — cukup untuk skala 1 cafe, dipindah ke SQL view kalau data
 * membesar signifikan.
 */
export async function getSalesReport(startISO: string, endISO: string): Promise<SalesReport> {
  const supabase = createSupabaseServerClient();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, grand_total, created_at")
    .gte("created_at", startISO)
    .lt("created_at", endISO);
  if (ordersError) throw new Error(`Gagal memuat order: ${ordersError.message}`);

  const paidStatuses = new Set(["PAID", "CLOSED"]);
  const paidOrders = (orders ?? []).filter((o) => paidStatuses.has(o.status));
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.grand_total), 0);
  const ordersCount = (orders ?? []).length;
  const paidOrdersCount = paidOrders.length;
  const averageOrderValue = paidOrdersCount > 0 ? revenue / paidOrdersCount : 0;

  // Daily trend (revenue per tanggal, dari order yang sudah dibayar)
  const trendMap = new Map<string, number>();
  for (const o of paidOrders) {
    const date = new Date(o.created_at).toISOString().slice(0, 10);
    trendMap.set(date, (trendMap.get(date) ?? 0) + Number(o.grand_total));
  }
  const dailyTrend = Array.from(trendMap.entries())
    .map(([date, revenue]) => ({ date, revenue }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, status, paid_at, reference_no, payment_methods(name), orders(order_number)")
    .eq("status", "COMPLETED")
    .gte("paid_at", startISO)
    .lt("paid_at", endISO)
    .order("paid_at", { ascending: false });
  if (paymentsError) throw new Error(`Gagal memuat pembayaran: ${paymentsError.message}`);

  const paymentMap = new Map<string, { amount: number; count: number }>();
  const paymentTransactions: SalesReport["paymentTransactions"] = [];
  for (const p of payments ?? []) {
    const methodName = (p as any).payment_methods?.name ?? "Lainnya";
    const orderNumber = (p as any).orders?.order_number ?? "-";
    const existing = paymentMap.get(methodName) ?? { amount: 0, count: 0 };
    existing.amount += Number(p.amount);
    existing.count += 1;
    paymentMap.set(methodName, existing);

    paymentTransactions.push({
      orderNumber,
      methodName,
      amount: Number(p.amount),
      referenceNo: p.reference_no,
      paidAt: p.paid_at,
    });
  }
  const paymentBreakdown = Array.from(paymentMap.entries()).map(([name, v]) => ({ name, ...v }));

  const orderIds = (orders ?? []).map((o) => o.id);
  let topProducts: SalesReport["topProducts"] = [];
  let bottomProducts: SalesReport["bottomProducts"] = [];

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("quantity, unit_price, products(name)")
      .in("order_id", orderIds);
    if (itemsError) throw new Error(`Gagal memuat item order: ${itemsError.message}`);

    const productMap = new Map<string, { quantity: number; revenue: number }>();
    for (const item of items ?? []) {
      const name = (item as any).products?.name ?? "Produk tidak dikenal";
      const existing = productMap.get(name) ?? { quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * Number(item.unit_price);
      productMap.set(name, existing);
    }
    const allProducts = Array.from(productMap.entries()).map(([name, v]) => ({ name, ...v }));
    topProducts = [...allProducts].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    bottomProducts = [...allProducts].sort((a, b) => a.quantity - b.quantity).slice(0, 5);
  }

  return { revenue, ordersCount, paidOrdersCount, averageOrderValue, paymentBreakdown, dailyTrend, topProducts, bottomProducts, paymentTransactions };
}

export type FinancialStatement = {
  revenue: number;
  operationalExpenses: { name: string; category: string; amount: number; recorded: boolean }[];
  operationalExpensesTotal: number;
  nonOperationalExpenses: { name: string; category: string; amount: number; recorded: boolean }[];
  nonOperationalExpensesTotal: number;
  payrollCost: number;
  payrollPeriodsIncluded: number;
  grossProfit: number; // revenue - biaya operasional inti (di luar gaji)
  operatingProfit: number; // grossProfit - gaji pegawai (masih termasuk operasional)
  netProfit: number; // operatingProfit - biaya non-operasional
};

/**
 * Laporan Laba Rugi (P&L) sederhana untuk 1 periode: Pendapatan −
 * Biaya Operasional (listrik/air/internet/kebersihan/dst, sesuai
 * klasifikasi Owner di halaman Payroll) − Biaya Gaji Pegawai (dari
 * payroll_periods yang jatuh SEPENUHNYA di dalam rentang periode) −
 * Biaya Non-Operasional = Laba Bersih.
 *
 * Catatan keterbatasan (lihat juga PHASE_FINANCE_HR.md bagian F):
 * belum ada modul Harga Pokok Penjualan (HPP/COGS) bahan baku —
 * begitu modul Inventory berjalan, "Laba Kotor" di bawah bisa
 * dikurangi HPP supaya lebih akurat secara akuntansi. Untuk sekarang,
 * "Laba Kotor" = Pendapatan − Biaya Operasional Non-Gaji, dan
 * perhitungan biaya operasional (fixed/percent/variable_manual)
 * memakai bulan kalender dari tanggal mulai periode — cukup akurat
 * untuk periode 1 bulan; untuk periode custom yang melintasi >1 bulan
 * kalender, angka biaya "fixed"/"variable_manual" mengikuti bulan
 * tanggal mulai (konsisten dengan payrollService & PayrollClient).
 */
export async function getFinancialStatement(startISO: string, endISO: string): Promise<FinancialStatement> {
  const startDate = startISO.slice(0, 10);
  const endDateExclusive = new Date(endISO);
  endDateExclusive.setUTCDate(endDateExclusive.getUTCDate() - 1);
  const endDate = endDateExclusive.toISOString().slice(0, 10);

  const [salesReport, expenseTotal] = await Promise.all([
    getSalesReport(startISO, endISO),
    computeMonthlyExpenseTotal(startDate, endDate > startDate ? endDate : startDate),
  ]);

  const operationalExpenses = expenseTotal.breakdown
    .filter((b) => b.expense_type === "operational")
    .map((b) => ({ name: b.name, category: b.category, amount: b.amount, recorded: b.recorded }));
  const nonOperationalExpenses = expenseTotal.breakdown
    .filter((b) => b.expense_type === "non_operational")
    .map((b) => ({ name: b.name, category: b.category, amount: b.amount, recorded: b.recorded }));

  const supabase = createSupabaseServerClient();
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("id, period_start, period_end")
    .gte("period_start", startDate)
    .lte("period_end", endDate <= startDate ? startDate : endDate);

  let payrollCost = 0;
  let payrollPeriodsIncluded = 0;
  if (periods && periods.length > 0) {
    const periodIds = periods.map((p) => p.id);
    const { data: items } = await supabase.from("payroll_items").select("gross_salary").in("payroll_period_id", periodIds);
    payrollCost = (items ?? []).reduce((sum, it) => sum + Number(it.gross_salary), 0);
    payrollPeriodsIncluded = periods.length;
  }

  const operationalExpensesTotal = expenseTotal.operationalTotal;
  const nonOperationalExpensesTotal = expenseTotal.nonOperationalTotal;
  const grossProfit = salesReport.revenue - operationalExpensesTotal;
  const operatingProfit = grossProfit - payrollCost;
  const netProfit = operatingProfit - nonOperationalExpensesTotal;

  return {
    revenue: salesReport.revenue,
    operationalExpenses,
    operationalExpensesTotal,
    nonOperationalExpenses,
    nonOperationalExpensesTotal,
    payrollCost,
    payrollPeriodsIncluded,
    grossProfit,
    operatingProfit,
    netProfit,
  };
}
