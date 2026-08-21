import { getTodayStats } from "@/services/dashboardService";
import { requireAdminOrOwner } from "@/lib/auth";
import { listLowStockItems, INVENTORY_CATEGORY_LABEL } from "@/services/inventoryService";

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default async function DashboardPage() {
  const role = await requireAdminOrOwner();
  const [stats, lowStockItems] = await Promise.all([getTodayStats(), listLowStockItems()]);
  const maxPayment = Math.max(1, ...stats.paymentBreakdown.map((p) => p.amount));
  const maxProduct = Math.max(1, ...stats.topProducts.map((p) => p.quantity));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Ringkasan</p>
          <h2 className="font-heading text-2xl sm:text-3xl text-primary">Hari Ini 👋</h2>
        </div>
        {role === "CAPTAIN" && (
          <span className="badge-modern bg-accent/15 text-accent">
            Mode Captain — lihat semua data, buka Kasir untuk transaksi
          </span>
        )}
      </div>

      {/* TODAY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Revenue" value={formatRupiah(stats.revenueToday)} accent="primary" />
        <StatCard label="Orders" value={String(stats.ordersToday)} accent="secondary" />
        <StatCard label="Order Terbayar" value={String(stats.paidOrdersToday)} accent="success" />
        <StatCard label="Rata-rata Order" value={formatRupiah(stats.averageOrderValue)} accent="accent" />
      </div>

      {/* PAYMENT BREAKDOWN */}
      <section className="card-modern p-5">
        <h3 className="section-title-modern mb-4">💳 Breakdown Pembayaran</h3>
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
                    className="h-full rounded-full bg-gradient-to-r from-primary to-[#d98a46] transition-all duration-500"
                    style={{ width: `${(p.amount / maxPayment) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* TOP PRODUCTS */}
      <section className="card-modern p-5">
        <h3 className="section-title-modern mb-4">🔥 Produk Terlaris Hari Ini</h3>
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
                    className="h-full rounded-full bg-gradient-to-r from-secondary to-daun transition-all duration-500"
                    style={{ width: `${(p.quantity / maxProduct) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ALERT STOK MENIPIS */}
      {lowStockItems.length > 0 && (
        <section className="card-modern p-5 border border-danger/40">
          <h3 className="section-title-modern mb-3 text-danger">⚠ Persediaan Mencapai Ambang Notifikasi</h3>
          <div className="space-y-2">
            {lowStockItems.map((item) => (
              <div key={item.id} className="flex justify-between items-center text-sm border-b border-border/60 pb-1.5">
                <span>
                  {item.name}{" "}
                  <span className="text-text-muted text-xs">({INVENTORY_CATEGORY_LABEL[item.category]})</span>
                </span>
                <span className="font-semibold text-danger">
                  {item.current_stock} {item.unit} ({item.alert_level.toFixed(0)}% dari stok normal)
                </span>
              </div>
            ))}
          </div>
          <a href="/admin/inventory" className="inline-block mt-3 text-xs font-semibold text-accent hover:underline">
            Kelola Persediaan →
          </a>
        </section>
      )}

      <p className="text-xs text-text-muted">
        Catatan: modul Alert (cash variance, reservasi pending) akan aktif setelah modul Cash
        Management dan Reservation dibangun di fase berikutnya.
      </p>
    </div>
  );
}

const ACCENT_CLASS: Record<string, string> = {
  primary: "text-primary",
  secondary: "text-secondary dark:text-secondary-dark",
  success: "text-success",
  accent: "text-accent",
};

function StatCard({ label, value, accent = "primary" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="stat-card-modern">
      <p className="text-text-muted text-xs font-medium">{label}</p>
      <p className={`font-heading text-xl sm:text-2xl ${ACCENT_CLASS[accent] ?? "text-primary"}`}>{value}</p>
    </div>
  );
}
