"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createPurchaseAction,
  deletePurchaseAction,
  listPurchasesAction,
  createAssetAction,
  toggleAssetActiveAction,
  acknowledgePurchaseAction,
} from "./actions";

type PurchaseCategory = "bahan_baku" | "peralatan_perlengkapan" | "rutin_lainnya";
const CATEGORY_LABEL: Record<PurchaseCategory, string> = {
  bahan_baku: "Bahan Baku",
  peralatan_perlengkapan: "Peralatan & Perlengkapan",
  rutin_lainnya: "Belanja Rutin Lainnya",
};

type Purchase = {
  id: string;
  purchase_date: string;
  item_name: string;
  category: PurchaseCategory;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
  supplier: string | null;
  notes: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
};

type AssetCategory = "equipment" | "furniture" | "vehicle" | "building" | "other";
type Asset = {
  id: string;
  name: string;
  category: AssetCategory;
  acquisition_date: string;
  acquisition_cost: number;
  residual_value: number;
  useful_life_months: number;
  expense_type: "operational" | "non_operational";
  is_active: boolean;
  notes: string | null;
};

const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  equipment: "Peralatan",
  furniture: "Meja/Kursi/Furnitur",
  vehicle: "Kendaraan",
  building: "Bangunan/Renovasi",
  other: "Lainnya",
};

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function isoWeekLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const key = monday.toISOString().slice(0, 10);
  const fmt = (x: Date) => x.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return { key, label: `${fmt(monday)} – ${fmt(sunday)}` };
}

function recap(purchases: Purchase[], mode: "daily" | "weekly" | "monthly") {
  const map = new Map<string, { label: string; total: number; count: number }>();
  for (const p of purchases) {
    let key: string;
    let label: string;
    if (mode === "daily") {
      key = p.purchase_date;
      label = new Date(`${p.purchase_date}T00:00:00`).toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } else if (mode === "weekly") {
      const w = isoWeekLabel(p.purchase_date);
      key = w.key;
      label = w.label;
    } else {
      key = p.purchase_date.slice(0, 7);
      label = new Date(`${key}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }
    const cur = map.get(key) ?? { label, total: 0, count: 0 };
    cur.total += Number(p.amount);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([key, v]) => ({ key, ...v }));
}

export default function PurchasesClient({
  initialPurchases,
  assets,
  initialStart,
  initialEnd,
  role,
}: {
  initialPurchases: Purchase[];
  assets: Asset[];
  initialStart: string;
  initialEnd: string;
  role: string;
}) {
  // Captain sekarang bisa MENCATAT belanja (bahan baku, peralatan/
  // perlengkapan, & belanja rutin lain) — tapi mengubah/menghapus
  // catatan (termasuk milik orang lain) & mengelola Aset Tetap tetap
  // wewenang SUPER_ADMIN/OWNER, ditegakkan RLS (migration 0019).
  const isCaptain = role === "CAPTAIN";
  const canManage = !isCaptain; // ubah/hapus/acknowledge/kelola aset
  const [purchases, setPurchases] = useState(initialPurchases);
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [recapMode, setRecapMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const total = useMemo(() => purchases.reduce((s, p) => s + Number(p.amount), 0), [purchases]);
  const recapRows = useMemo(() => recap(purchases, recapMode), [purchases, recapMode]);

  function reload(newStart: string, newEnd: string) {
    setStart(newStart);
    setEnd(newEnd);
    startTransition(async () => {
      const data = await listPurchasesAction(newStart, newEnd);
      setPurchases(data as Purchase[]);
    });
  }

  function submitPurchase(fd: FormData) {
    startTransition(async () => {
      try {
        await createPurchaseAction(fd);
        setMessage("Belanja tersimpan.");
        const data = await listPurchasesAction(start, end);
        setPurchases(data as Purchase[]);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function acknowledgePurchase(id: string) {
    startTransition(async () => {
      try {
        await acknowledgePurchaseAction(id);
        const data = await listPurchasesAction(start, end);
        setPurchases(data as Purchase[]);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function removePurchase(id: string) {
    if (!confirm("Hapus catatan belanja ini?")) return;
    startTransition(async () => {
      await deletePurchaseAction(id);
      const data = await listPurchasesAction(start, end);
      setPurchases(data as Purchase[]);
    });
  }

  function submitAsset(fd: FormData) {
    startTransition(async () => {
      try {
        await createAssetAction(fd);
        setMessage("Aset tersimpan. Silakan refresh untuk lihat daftar terbaru.");
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Biaya Operasional</p>
          <h2 className="font-heading text-2xl sm:text-3xl text-primary">🛒 Belanja &amp; Aset</h2>
        </div>
        {isCaptain && (
          <span className="badge-modern bg-accent/15 text-accent">
            Captain: bisa mencatat belanja baru, tidak bisa ubah/hapus
          </span>
        )}
      </div>

      {message && (
        <div className="rounded-xl bg-surface dark:bg-surface-dark border border-border p-3 text-sm animate-float-in">
          {message}
        </div>
      )}

      {/* FORM TAMBAH BELANJA — Captain boleh mencatat (bahan baku,
          peralatan/perlengkapan, atau belanja rutin lain), catatannya
          akan tampil ke Admin/Owner untuk "diketahui". */}
      <section className="card-modern p-5">
        <h3 className="section-title-modern mb-3">➕ Catat Belanja</h3>
        <form action={submitPurchase} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select name="category" defaultValue="bahan_baku" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2 sm:col-span-1">
            {(Object.keys(CATEGORY_LABEL) as PurchaseCategory[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <input type="date" name="purchaseDate" defaultValue={new Date().toISOString().slice(0, 10)} required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
          <input type="text" name="itemName" placeholder="Nama item (mis. Sayur, Kopi, Blender)" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2 sm:col-span-2" />
          <input type="number" step="0.01" name="quantity" placeholder="Qty (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
          <input type="text" name="unit" placeholder="Satuan (kg/pcs/liter)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
          <input type="number" step="1" name="unitPrice" placeholder="Harga/satuan (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
          <input type="number" step="1" name="amount" placeholder="Total Nominal (Rp)" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
          <input type="text" name="supplier" placeholder="Supplier/Toko (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
          <input type="text" name="notes" placeholder="Catatan (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2" />
          <button type="submit" disabled={isPending} className="btn-primary-modern col-span-2 sm:col-span-1">
            Simpan
          </button>
        </form>
      </section>

      {/* FILTER RENTANG TANGGAL */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" value={start} onChange={(e) => reload(e.target.value, end)} className="border border-border rounded-xl px-3 py-2 text-sm bg-surface dark:bg-surface-dark" />
        <span className="text-sm text-text-muted">s/d</span>
        <input type="date" value={end} onChange={(e) => reload(start, e.target.value)} className="border border-border rounded-xl px-3 py-2 text-sm bg-surface dark:bg-surface-dark" />
        <span className="ml-auto badge-modern bg-primary/10 text-primary">Total: {formatRupiah(total)}</span>
      </div>

      {/* REKAP */}
      <section className="card-modern p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="section-title-modern">📅 Rekap Belanja</h3>
          <div className="flex gap-1.5">
            {(["daily", "weekly", "monthly"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setRecapMode(m)}
                className={`pill-nav-link border text-xs ${recapMode === m ? "pill-nav-link-active border-primary" : "border-border pill-nav-link-inactive"}`}
              >
                {m === "daily" ? "Harian" : m === "weekly" ? "Mingguan" : "Bulanan"}
              </button>
            ))}
          </div>
        </div>
        {recapRows.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada catatan belanja di rentang ini.</p>
        ) : (
          <div className="space-y-2">
            {recapRows.map((r) => (
              <div key={r.key} className="flex justify-between items-center text-sm border-b border-border/60 py-1.5">
                <span>
                  {r.label} <span className="text-text-muted text-xs">({r.count} catatan)</span>
                </span>
                <span className="font-semibold">{formatRupiah(r.total)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DAFTAR TRANSAKSI */}
      <section className="card-modern p-5 overflow-x-auto">
        <h3 className="section-title-modern mb-3">📋 Daftar Catatan Belanja</h3>
        {purchases.length === 0 ? (
          <p className="text-sm text-text-muted">Tidak ada data.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted border-b border-border">
                <th className="py-1.5 pr-2">Tanggal</th>
                <th className="py-1.5 pr-2">Kategori</th>
                <th className="py-1.5 pr-2">Item</th>
                <th className="py-1.5 pr-2">Qty</th>
                <th className="py-1.5 pr-2">Supplier</th>
                <th className="py-1.5 pr-2 text-right">Nominal</th>
                <th className="py-1.5 pr-2">Status</th>
                {canManage && <th className="py-1.5"></th>}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-border/60">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{p.purchase_date}</td>
                  <td className="py-1.5 pr-2 text-text-muted text-xs">{CATEGORY_LABEL[p.category] ?? p.category}</td>
                  <td className="py-1.5 pr-2">{p.item_name}</td>
                  <td className="py-1.5 pr-2 text-text-muted">{p.quantity ? `${p.quantity} ${p.unit ?? ""}` : "-"}</td>
                  <td className="py-1.5 pr-2 text-text-muted">{p.supplier ?? "-"}</td>
                  <td className="py-1.5 pr-2 text-right font-semibold">{formatRupiah(p.amount)}</td>
                  <td className="py-1.5 pr-2">
                    {p.acknowledged_at ? (
                      <span className="badge-modern bg-success/15 text-success text-[11px]">✓ Diketahui</span>
                    ) : canManage ? (
                      <button onClick={() => acknowledgePurchase(p.id)} className="text-xs font-semibold text-accent hover:underline">
                        Tandai Diketahui
                      </button>
                    ) : (
                      <span className="text-[11px] text-text-muted">Menunggu diketahui Admin/Owner</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="py-1.5 text-right">
                      <button onClick={() => removePurchase(p.id)} className="text-danger text-xs font-semibold hover:underline">
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ASET & PENYUSUTAN */}
      <section className="card-modern p-5">
        <h3 className="section-title-modern mb-1">🏷️ Aset Tetap &amp; Biaya Penyusutan</h3>
        <p className="text-xs text-text-muted mb-4">
          Dihitung metode garis lurus (straight-line): (Harga Perolehan − Nilai Residu) ÷ Umur
          Manfaat (bulan) — dibebankan rata tiap bulan, standar akuntansi paling umum untuk UMKM.
        </p>

        {canManage && (
          <form action={submitAsset} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
            <input type="text" name="name" placeholder="Nama aset (mis. Mesin Espresso)" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2" />
            <select name="category" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark">
              {Object.entries(ASSET_CATEGORY_LABEL).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input type="date" name="acquisitionDate" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="number" step="1" name="acquisitionCost" placeholder="Harga Perolehan (Rp)" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="number" step="1" name="residualValue" placeholder="Nilai Residu (Rp, opsional)" defaultValue={0} className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="number" step="1" name="usefulLifeMonths" placeholder="Umur Manfaat (bulan)" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <select name="expenseType" defaultValue="operational" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark">
              <option value="operational">Klasifikasi: Operasional</option>
              <option value="non_operational">Klasifikasi: Non-Operasional</option>
            </select>
            <input type="text" name="notes" placeholder="Catatan (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2" />
            <button type="submit" disabled={isPending} className="btn-primary-modern col-span-2 sm:col-span-1">
              Tambah Aset
            </button>
          </form>
        )}

        {assets.length === 0 ? (
          <p className="text-sm text-text-muted">Belum ada aset dicatat.</p>
        ) : (
          <div className="divide-y divide-border">
            {assets.map((a) => {
              const depreciable = Math.max(0, Number(a.acquisition_cost) - Number(a.residual_value));
              const monthly = depreciable / a.useful_life_months;
              return (
                <div key={a.id} className="py-2.5 flex flex-wrap justify-between items-center gap-2 text-sm">
                  <div>
                    <span className="font-semibold">{a.name}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      ({ASSET_CATEGORY_LABEL[a.category]} · {a.acquisition_date} · {a.useful_life_months} bulan)
                    </span>
                    {!a.is_active && <span className="ml-2 text-xs text-danger">(nonaktif)</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge-modern bg-background dark:bg-background-dark text-text-muted">
                      Penyusutan: {formatRupiah(monthly)}/bulan
                    </span>
                    <span className={`badge-modern ${a.expense_type === "operational" ? "bg-secondary/10 text-secondary dark:text-secondary-dark" : "bg-warning/10 text-warning"}`}>
                      {a.expense_type === "operational" ? "Operasional" : "Non-Operasional"}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => startTransition(() => toggleAssetActiveAction(a.id, !a.is_active))}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {a.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
