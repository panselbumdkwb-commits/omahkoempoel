import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getJakartaTodayRange } from "@/lib/timezone";

export type TodayStats = {
  revenueToday: number;
  ordersToday: number;
  paidOrdersToday: number;
  averageOrderValue: number;
  paymentBreakdown: { name: string; amount: number }[];
  topProducts: { name: string; quantity: number }[];
};

/**
 * Mengambil ringkasan bisnis hari ini untuk Dashboard Owner (Bagian 37 & 63
 * master prompt). Catatan implementasi: agregasi (SUM/GROUP BY) dilakukan
 * di JavaScript setelah fetch baris mentah, karena PostgREST tidak
 * mendukung GROUP BY langsung lewat query builder. Ini cukup untuk volume
 * transaksi harian sebuah cafe; kalau data membesar signifikan, agregasi
 * ini sebaiknya dipindah ke SQL view/RPC di fase Finance mendatang.
 */
export async function getTodayStats(): Promise<TodayStats> {
  const supabase = createSupabaseServerClient();
  const { startUTC, endUTC } = getJakartaTodayRange();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, grand_total, created_at")
    .gte("created_at", startUTC.toISOString())
    .lt("created_at", endUTC.toISOString());
  if (ordersError) throw new Error(`Gagal memuat order hari ini: ${ordersError.message}`);

  const paidStatuses = new Set(["PAID", "CLOSED"]);
  const paidOrders = (orders ?? []).filter((o) => paidStatuses.has(o.status));
  const revenueToday = paidOrders.reduce((sum, o) => sum + Number(o.grand_total), 0);
  const ordersToday = (orders ?? []).length;
  const paidOrdersToday = paidOrders.length;
  const averageOrderValue = paidOrdersToday > 0 ? revenueToday / paidOrdersToday : 0;

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("amount, status, paid_at, payment_methods(name)")
    .eq("status", "COMPLETED")
    .gte("paid_at", startUTC.toISOString())
    .lt("paid_at", endUTC.toISOString());
  if (paymentsError) throw new Error(`Gagal memuat pembayaran hari ini: ${paymentsError.message}`);

  const paymentMap = new Map<string, number>();
  for (const p of payments ?? []) {
    const name = (p as any).payment_methods?.name ?? "Lainnya";
    paymentMap.set(name, (paymentMap.get(name) ?? 0) + Number(p.amount));
  }
  const paymentBreakdown = Array.from(paymentMap.entries()).map(([name, amount]) => ({
    name,
    amount,
  }));

  const orderIds = (orders ?? []).map((o) => o.id);
  let topProducts: { name: string; quantity: number }[] = [];

  if (orderIds.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("quantity, products(name)")
      .in("order_id", orderIds);
    if (itemsError) throw new Error(`Gagal memuat item order: ${itemsError.message}`);

    const productMap = new Map<string, number>();
    for (const item of items ?? []) {
      const name = (item as any).products?.name ?? "Produk tidak dikenal";
      productMap.set(name, (productMap.get(name) ?? 0) + item.quantity);
    }
    topProducts = Array.from(productMap.entries())
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }

  return { revenueToday, ordersToday, paidOrdersToday, averageOrderValue, paymentBreakdown, topProducts };
}
