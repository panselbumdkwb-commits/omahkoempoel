"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createInventoryItemAction,
  recordStockMovementAction,
  updateInventoryItemAction,
  deleteInventoryItemAction,
} from "./actions";

type InventoryCategory = "bahan_baku" | "peralatan" | "perlengkapan";
const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  bahan_baku: "Bahan Baku",
  peralatan: "Peralatan",
  perlengkapan: "Perlengkapan",
};

type Item = {
  id: string;
  category: InventoryCategory;
  name: string;
  unit: string;
  current_stock: number;
  par_stock: number;
  alert_threshold_percent: number;
  is_active: boolean;
  notes: string | null;
  alert_level: number;
  is_low_stock: boolean;
};

export default function InventoryClient({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [movementFormFor, setMovementFormFor] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const lowStockCount = useMemo(() => items.filter((i) => i.is_active && i.is_low_stock).length, [items]);
  const grouped = useMemo(() => {
    const byCategory: Record<InventoryCategory, Item[]> = { bahan_baku: [], peralatan: [], perlengkapan: [] };
    for (const it of items) byCategory[it.category].push(it);
    return byCategory;
  }, [items]);

  function refresh() {
    // Server actions me-revalidatePath halaman ini — refresh manual
    // paling sederhana & konsisten adalah reload window supaya semua
    // angka current_stock (hasil trigger di database) ikut ter-update.
    window.location.reload();
  }

  function submitNewItem(fd: FormData) {
    startTransition(async () => {
      try {
        await createInventoryItemAction(fd);
        setMessage("Item persediaan ditambahkan.");
        setShowAddForm(false);
        refresh();
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function submitMovement(fd: FormData) {
    startTransition(async () => {
      try {
        await recordStockMovementAction(fd);
        setMessage("Mutasi stok tercatat.");
        setMovementFormFor(null);
        refresh();
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function toggleActive(item: Item) {
    startTransition(async () => {
      await updateInventoryItemAction(item.id, !item.is_active);
      refresh();
    });
  }

  function removeItem(id: string) {
    if (!confirm("Hapus item persediaan ini beserta seluruh riwayat mutasinya?")) return;
    startTransition(async () => {
      try {
        await deleteInventoryItemAction(id);
        refresh();
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Manajemen Persediaan</p>
          <h2 className="font-heading text-2xl sm:text-3xl text-primary">📦 Bahan Baku, Peralatan &amp; Perlengkapan</h2>
        </div>
        <div className="flex items-center gap-2">
          {lowStockCount > 0 && (
            <span className="badge-modern bg-danger/15 text-danger">⚠ {lowStockCount} item stok menipis</span>
          )}
          <button onClick={() => setShowAddForm((s) => !s)} className="btn-primary-modern">
            {showAddForm ? "Tutup" : "+ Tambah Item"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-xl bg-surface dark:bg-surface-dark border border-border p-3 text-sm animate-float-in">
          {message}
        </div>
      )}

      {showAddForm && (
        <section className="card-modern p-5">
          <h3 className="section-title-modern mb-3">➕ Tambah Item Persediaan</h3>
          <form action={submitNewItem} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select name="category" defaultValue="bahan_baku" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark">
              {(Object.keys(CATEGORY_LABEL) as InventoryCategory[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <input type="text" name="name" placeholder="Nama item" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2 sm:col-span-1" />
            <input type="text" name="unit" placeholder="Satuan (kg/pcs/liter)" defaultValue="pcs" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="number" step="0.01" min={0} name="parStock" placeholder="Stok normal (par stock)" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="number" step="0.01" min={0} name="initialStock" placeholder="Stok awal (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="number" step="1" min={1} max={100} name="alertThresholdPercent" placeholder="Ambang notifikasi %" defaultValue={10} className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
            <input type="text" name="notes" placeholder="Catatan (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2" />
            <button type="submit" disabled={isPending} className="btn-primary-modern col-span-2 sm:col-span-1">
              Simpan
            </button>
          </form>
        </section>
      )}

      {(Object.keys(CATEGORY_LABEL) as InventoryCategory[]).map((cat) => (
        <section key={cat} className="card-modern p-5">
          <h3 className="section-title-modern mb-3">{CATEGORY_LABEL[cat]}</h3>
          {grouped[cat].length === 0 ? (
            <p className="text-sm text-text-muted">Belum ada item.</p>
          ) : (
            <div className="space-y-2">
              {grouped[cat].map((item) => (
                <div key={item.id} className={`border rounded-xl p-3 ${item.is_low_stock ? "border-danger/50 bg-danger/5" : "border-border"} ${!item.is_active ? "opacity-50" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm">
                        {item.name}{" "}
                        {item.is_low_stock && <span className="badge-modern bg-danger/15 text-danger text-[10px] ml-1">Stok Menipis</span>}
                        {!item.is_active && <span className="badge-modern bg-border text-text-muted text-[10px] ml-1">Nonaktif</span>}
                      </p>
                      <p className="text-xs text-text-muted">
                        Stok: <span className="font-semibold text-text">{item.current_stock} {item.unit}</span>
                        {" · "}Normal: {item.par_stock} {item.unit}
                        {" · "}{item.par_stock > 0 ? `${item.alert_level.toFixed(0)}%` : "-"}
                        {" · "}Ambang: {item.alert_threshold_percent}%
                      </p>
                      {item.notes && <p className="text-xs text-text-muted italic">{item.notes}</p>}
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setMovementFormFor(movementFormFor === item.id ? null : item.id)} className="font-semibold text-accent hover:underline">
                        Catat Mutasi
                      </button>
                      <button onClick={() => toggleActive(item)} className="font-semibold text-text-muted hover:underline">
                        {item.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      <button onClick={() => removeItem(item.id)} className="font-semibold text-danger hover:underline">
                        Hapus
                      </button>
                    </div>
                  </div>

                  {movementFormFor === item.id && (
                    <form action={submitMovement} className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input type="hidden" name="inventoryItemId" value={item.id} />
                      <select name="movementType" defaultValue="in" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark">
                        <option value="in">Stok Masuk</option>
                        <option value="out">Stok Keluar</option>
                        <option value="adjustment">Penyesuaian (stok opname)</option>
                      </select>
                      <input type="number" step="0.01" name="quantity" placeholder="Jumlah" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark" />
                      <input type="text" name="note" placeholder="Catatan (opsional)" className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2 sm:col-span-1" />
                      <button type="submit" disabled={isPending} className="btn-primary-modern">
                        Simpan Mutasi
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
