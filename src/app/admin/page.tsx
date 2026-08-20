import { getTodayStats } from "@/services/dashboardService";
import { requireAdminOrOwner } from "@/lib/auth";

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default async function DashboardPage() {
  await requireAdminOrOwner();
  const stats = await getTodayStats();
  const maxPayment = Math.max(1, ...stats.paymentBreakdown.map((p) => p.amount));
  const maxProduct = Math.max(1, ...stats.topProducts.map((p) => p.quantity));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h2 className="font-heading text-2xl text-primary">Ringkasan Hari Ini</h2>

      {/* TODAY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={formatRupiah(stats.revenueToday)} />
        <StatCard label="Orders" value={String(stats.ordersToday)} />
        <StatCard label="Order Terbayar" value={String(stats.paidOrdersToday)} />
        <StatCard label="Rata-rata Order" value={formatRupiah(stats.averageOrderValue)} />
      </div>

      {/* PAYMENT BREAKDOWN */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h3 className="font-heading text-lg text-primary mb-4">Breakdown Pembayaran</h3>
        {stats.paymentBreakdown.length === 0 ? (
          <p className="text-text-muted text-sm">Belum ada pembayaran tercatat hari ini.</p>
        ) : (
          <div className="space-y-3">
            {stats.paymentBreakdown.map((p) => (
              <div key={p.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{p.name}</span>
                  <span className="font-semibold">{formatRupiah(p.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-background dark:bg-background-dark overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(p.amount / maxPayment) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TOP PRODUCTS */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h3 className="font-heading text-lg text-primary mb-4">Produk Terlaris Hari Ini</h3>
        {stats.topProducts.length === 0 ? (
          <p className="text-text-muted text-sm">Belum ada item terjual hari ini.</p>
        ) : (
          <div className="space-y-3">
            {stats.topProducts.map((p, i) => (
              <div key={p.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>
                    {i + 1}. {p.name}
                  </span>
                  <span className="font-semibold">{p.quantity} terjual</span>
                </div>
                <div className="h-2 rounded-full bg-background dark:bg-background-dark overflow-hidden">
                  <div
                    className="h-full bg-secondary"
                    style={{ width: `${(p.quantity / maxProduct) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-xs text-text-muted">
        Catatan: modul Alert (stok menipis, cash variance, reservasi pending) akan aktif setelah
        modul Inventory, Cash Management, dan Reservation dibangun di fase berikutnya.
      </p>
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
