import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

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
