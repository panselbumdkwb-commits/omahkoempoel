"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createOrderAction,
  addOrderItemAction,
  processPaymentAction,
  closeOrderAction,
} from "./actions";

type Product = {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  categories: { name: string } | null;
};
type TableRow = { id: string; number: string; status: string };
type PaymentMethod = { id: string; code: string; name: string };

type CartLine = { product: Product; quantity: number };

export default function PosClient({
  businessId,
  products,
  tables,
  paymentMethods,
}: {
  businessId: string;
  products: Product[];
  tables: TableRow[];
  paymentMethods: PaymentMethod[];
}) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [tableId, setTableId] = useState<string>("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(paymentMethods[0]?.id ?? "");
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [cart]
  );

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function submitOrder() {
    if (cart.length === 0) {
      setStatus("Keranjang masih kosong.");
      return;
    }
    startTransition(async () => {
      try {
        setStatus("Membuat order...");
        const order = await createOrderAction({
          businessId,
          orderType: tableId ? "dine_in" : "take_away",
          tableId: tableId || null,
        });
        for (const line of cart) {
          await addOrderItemAction({
            orderId: order.id,
            productId: line.product.id,
            quantity: line.quantity,
            unitPrice: line.product.price,
          });
        }
        setOrderId(order.id);
        setOrderNumber(order.order_number);
        setStatus(`Order ${order.order_number} berhasil dibuat. Silakan proses pembayaran.`);
      } catch (err: any) {
        setStatus(`Gagal: ${err.message}`);
      }
    });
  }

  function payAndClose() {
    if (!orderId) return;
    startTransition(async () => {
      try {
        setStatus("Memproses pembayaran...");
        const result = await processPaymentAction({
          orderId,
          paymentMethodId,
          amount: total,
        });
        if (result.remaining > 0) {
          setStatus(`Pembayaran sebagian tercatat. Sisa: Rp ${result.remaining.toLocaleString("id-ID")}`);
          return;
        }
        await closeOrderAction(orderId);
        setStatus(`Order ${orderNumber} PAID & CLOSED. Nota siap dicetak.`);
        setCart([]);
        setOrderId(null);
        setOrderNumber(null);
      } catch (err: any) {
        setStatus(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-background dark:bg-background-dark">
      {/* Product grid */}
      <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => addToCart(p)}
            className="rounded-md border border-border bg-surface dark:bg-surface-dark dark:border-border p-3 text-left hover:border-primary transition"
          >
            <div className="text-xs text-text-muted">{p.categories?.name ?? "-"}</div>
            <div className="font-semibold">{p.name}</div>
            <div className="text-primary font-semibold">Rp {p.price.toLocaleString("id-ID")}</div>
          </button>
        ))}
      </div>

      {/* Cart / checkout panel */}
      <div className="rounded-md border border-border bg-surface dark:bg-surface-dark dark:border-border p-4 flex flex-col gap-3">
        <h2 className="font-heading text-xl text-primary">Order</h2>

        <select
          className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          value={tableId}
          onChange={(e) => setTableId(e.target.value)}
          disabled={!!orderId}
        >
          <option value="">Take Away</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Meja {t.number} ({t.status})
            </option>
          ))}
        </select>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {cart.length === 0 && <p className="text-text-muted text-sm py-4">Belum ada item.</p>}
          {cart.map((line) => (
            <div key={line.product.id} className="flex justify-between items-center py-2">
              <div>
                <div className="font-medium">{line.product.name}</div>
                <div className="text-sm text-text-muted">
                  Rp {line.product.price.toLocaleString("id-ID")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeQty(line.product.id, -1)}
                  className="w-7 h-7 rounded-full border border-border"
                  disabled={!!orderId}
                >
                  −
                </button>
                <span>{line.quantity}</span>
                <button
                  onClick={() => changeQty(line.product.id, 1)}
                  className="w-7 h-7 rounded-full border border-border"
                  disabled={!!orderId}
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-3 flex justify-between font-semibold">
          <span>Total</span>
          <span>Rp {total.toLocaleString("id-ID")}</span>
        </div>

        {!orderId ? (
          <button
            onClick={submitOrder}
            disabled={isPending || cart.length === 0}
            className="bg-primary text-white rounded-md py-3 font-semibold disabled:opacity-50"
          >
            Buat Order
          </button>
        ) : (
          <>
            <select
              className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
            >
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
            <button
              onClick={payAndClose}
              disabled={isPending}
              className="bg-success text-white rounded-md py-3 font-semibold disabled:opacity-50"
            >
              Bayar & Tutup Order
            </button>
          </>
        )}

        {status && <p className="text-sm text-text-muted">{status}</p>}
      </div>
    </div>
  );
}
