"use client";

import { useState, useTransition } from "react";
import {
  createCategoryAction,
  createProductAction,
  updateProductAction,
  toggleProductStatusAction,
} from "./actions";

type Category = { id: string; name: string; sort_order: number };
type Product = {
  id: string;
  category_id: string | null;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  status: string;
};

export default function MenuManagerClient({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAction(action: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await action();
        setMessage(successMsg);
        setEditingId(null);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {message && (
        <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-3 text-sm">
          {message}
        </div>
      )}

      {/* CATEGORIES */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h2 className="font-heading text-xl text-primary mb-4">Kategori</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.id} className="px-3 py-1.5 rounded-full bg-background dark:bg-background-dark border border-border text-sm">
              {c.name}
            </li>
          ))}
        </ul>
        <form
          action={(fd) => handleAction(() => createCategoryAction(fd), "Kategori ditambahkan.")}
          className="flex gap-2"
        >
          <input
            name="name"
            placeholder="Nama kategori baru"
            required
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          />
          <input type="hidden" name="sortOrder" value={categories.length + 1} />
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-white px-4 rounded-md font-semibold disabled:opacity-50"
          >
            Tambah
          </button>
        </form>
      </section>

      {/* PRODUCTS */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h2 className="font-heading text-xl text-primary mb-4">Produk / Menu</h2>

        <div className="divide-y divide-border">
          {products.map((p) => (
            <div key={p.id} className="py-3">
              {editingId === p.id ? (
                <form
                  action={(fd) => handleAction(() => updateProductAction(fd), `${p.name} diperbarui.`)}
                  className="grid grid-cols-2 gap-2"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    name="name"
                    defaultValue={p.name}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
                  />
                  <textarea
                    name="description"
                    defaultValue={p.description ?? ""}
                    placeholder="Deskripsi"
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
                  />
                  <input
                    name="price"
                    type="number"
                    min={0}
                    defaultValue={p.price}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                  />
                  <select
                    name="categoryId"
                    defaultValue={p.category_id ?? ""}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-success text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-md border border-border"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {p.name}{" "}
                      <span className="text-xs text-text-muted">({p.sku})</span>
                      {p.status === "inactive" && (
                        <span className="ml-2 text-xs text-danger">Nonaktif</span>
                      )}
                    </p>
                    <p className="text-text-muted text-sm">Rp {p.price.toLocaleString("id-ID")}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingId(p.id)}
                      className="text-sm px-3 py-1.5 rounded-md border border-border"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        handleAction(
                          () => toggleProductStatusAction(p.id, p.status),
                          `${p.name} sekarang ${p.status === "active" ? "nonaktif" : "aktif"}.`
                        )
                      }
                      className="text-sm px-3 py-1.5 rounded-md border border-border"
                    >
                      {p.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <h3 className="font-heading text-lg text-primary mt-6 mb-3">Tambah Produk Baru</h3>
        <form
          action={(fd) => handleAction(() => createProductAction(fd), "Produk ditambahkan.")}
          className="grid grid-cols-2 gap-2"
        >
          <select name="categoryId" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2">
            <option value="">Pilih kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="sku" placeholder="SKU (mis. MKN-004)" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input name="name" placeholder="Nama produk" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <textarea name="description" placeholder="Deskripsi (opsional)" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2" />
          <input name="price" type="number" min={0} placeholder="Harga" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2" />
          <button type="submit" disabled={isPending} className="bg-primary text-white py-2 rounded-md font-semibold col-span-2 disabled:opacity-50">
            Tambah Produk
          </button>
        </form>
      </section>
    </div>
  );
}
