"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getOrderDetailAction,
  updateCustomerNameAction,
  updateOrderTableAction,
  processPaymentAction,
  closeOrderAction,
  sendToKitchenAction,
  listClosedOrdersAction,
} from "./actions";
import PosClient from "./PosClient";

type OpenOrder = {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  grand_total: number;
  customer_name: string | null;
  created_at: string;
  tables: { number: string } | { number: string }[] | null;
};

type PaymentMethod = { id: string; code: string; name: string };
type Product = any;
type TableRow = { id: string; number: string; status: string };

const STATUS_LABEL: Record<string, string> = {
  NEW: "Baru",
  CONFIRMED: "Dikonfirmasi",
  PROCESSING: "Diproses Dapur",
  READY: "Siap Disajikan",
  SERVED: "Sudah Disajikan",
  PAID: "Sudah Bayar",
  CLOSED: "Selesai",
};

function tableLabel(order: OpenOrder) {
  if (order.order_type === "take_away") return "Take Away";
  const t = order.tables;
  if (!t) return "-";
  const number = Array.isArray(t) ? t[0]?.number : t.number;
  return number ? `Meja ${number}` : "-";
}

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default function OrderQueueClient({
  initialOrders,
  businessId,
  products,
  tables,
  paymentMethods,
}: {
  initialOrders: OpenOrder[];
  businessId: string;
  products: Product[];
  tables: TableRow[];
  paymentMethods: PaymentMethod[];
}) {
  const [orders] = useState<OpenOrder[]>(initialOrders);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [activeTab, setActiveTab] = useState<"masuk" | "riwayat">("masuk");
  const [closedOrders, setClosedOrders] = useState<OpenOrder[] | null>(null);
  const [loadingClosed, setLoadingClosed] = useState(false);

  useEffect(() => {
    if (activeTab === "riwayat" && closedOrders === null) {
      setLoadingClosed(true);
      listClosedOrdersAction()
        .then((data) => setClosedOrders(data as OpenOrder[]))
        .finally(() => setLoadingClosed(false));
    }
  }, [activeTab, closedOrders]);

  if (showNewOrder) {
    return (
      <div>
        <div className="p-3">
          <button
            onClick={() => setShowNewOrder(false)}
            className="text-sm text-primary font-semibold"
          >
            ← Kembali ke Order Masuk
          </button>
        </div>
        <PosClient
          businessId={businessId}
          products={products}
          tables={tables}
          paymentMethods={paymentMethods}
        />
      </div>
    );
  }

  const listToShow = activeTab === "masuk" ? orders : closedOrders ?? [];

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-heading text-xl text-primary">
          {activeTab === "masuk" ? "Order Masuk" : "Riwayat Transaksi (Hari Ini)"}
        </h2>
        {activeTab === "masuk" && (
          <button
            onClick={() => setShowNewOrder(true)}
            className="bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold"
          >
            + Buat Order Baru
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab("masuk")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            activeTab === "masuk" ? "border-primary text-primary" : "border-transparent text-text-muted"
          }`}
        >
          Order Masuk
        </button>
        <button
          onClick={() => setActiveTab("riwayat")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
            activeTab === "riwayat" ? "border-primary text-primary" : "border-transparent text-text-muted"
          }`}
        >
          Riwayat Transaksi
        </button>
      </div>

      {activeTab === "riwayat" && loadingClosed && (
        <p className="text-text-muted text-sm py-6 text-center">Memuat riwayat transaksi...</p>
      )}

      {activeTab === "masuk" && orders.length === 0 && (
        <p className="text-text-muted text-sm py-10 text-center">
          Belum ada order masuk. Order dari pelanggan (lewat menu digital) akan otomatis muncul di sini.
        </p>
      )}

      {activeTab === "riwayat" && !loadingClosed && (closedOrders ?? []).length === 0 && (
        <p className="text-text-muted text-sm py-10 text-center">
          Belum ada transaksi yang selesai dibayar hari ini.
        </p>
      )}

      <div className="space-y-3">
        {listToShow.map((order) => (
          <button
            key={order.id}
            onClick={() => setSelectedOrderId(order.id)}
            className="w-full text-left rounded-md border border-border bg-surface dark:bg-surface-dark p-4 flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">
                {order.order_number} · {tableLabel(order)}
              </p>
              <p className="text-sm text-text-muted">
                {order.customer_name || "Nama pelanggan belum diisi"} ·{" "}
                {STATUS_LABEL[order.status] ?? order.status}
              </p>
            </div>
            <p className="font-semibold text-primary">{formatRupiah(order.grand_total)}</p>
          </button>
        ))}
      </div>

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          paymentMethods={paymentMethods}
          tables={tables}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}

function OrderDetailModal({
  orderId,
  paymentMethods,
  tables,
  onClose,
}: {
  orderId: string;
  paymentMethods: PaymentMethod[];
  tables: TableRow[];
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof getOrderDetailAction>> | null>(
    null
  );
  const [customerName, setCustomerName] = useState("");
  const [tableId, setTableId] = useState("");
  const [orderType, setOrderType] = useState<"dine_in" | "take_away">("dine_in");
  const [paymentMethodId, setPaymentMethodId] = useState(paymentMethods[0]?.id ?? "");
  const [referenceNo, setReferenceNo] = useState("");
  const [status, setStatus] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getOrderDetailAction(orderId).then((d) => {
      setDetail(d);
      setCustomerName(d.order.customer_name ?? "");
      setTableId((d.order as any).table_id ?? "");
      setOrderType((d.order.order_type as "dine_in" | "take_away") ?? "dine_in");
    });
  }, [orderId]);

  function saveCustomerName() {
    startTransition(async () => {
      await updateCustomerNameAction(orderId, customerName);
      setStatus("Nama pelanggan tersimpan.");
    });
  }

  function saveTableAndType() {
    startTransition(async () => {
      await updateOrderTableAction(orderId, orderType === "dine_in" ? tableId || null : null, orderType);
      setStatus("Meja & tipe order tersimpan.");
    });
  }

  function payAndClose() {
    if (!detail) return;
    startTransition(async () => {
      try {
        setStatus("Memproses pembayaran...");
        const result = await processPaymentAction({
          orderId,
          paymentMethodId,
          amount: Number(detail.order.grand_total),
          referenceNo: referenceNo || undefined,
        });
        if (result.remaining > 0) {
          setStatus(`Pembayaran sebagian. Sisa: ${formatRupiah(result.remaining)}`);
          return;
        }
        await closeOrderAction(orderId);
        setStatus("Order lunas & ditutup. Silakan cetak/tunjukkan nota.");
        setTimeout(() => {
          onClose();
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        setStatus(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-black/50">
      <div className="w-full sm:max-w-md bg-surface dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 flex justify-between items-center border-b border-border">
          <h3 className="font-heading text-lg text-primary">
            {detail?.order.order_number ?? "Memuat..."}
          </h3>
          <button onClick={onClose} className="text-sm text-text-muted">
            Tutup
          </button>
        </div>

        {!detail ? (
          <p className="p-5 text-sm text-text-muted">Memuat detail order...</p>
        ) : (
          <>
            {(() => {
              const isClosed = ["PAID", "CLOSED"].includes(detail.order.status);
              return (
                <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {isClosed && (
                <p className="text-xs bg-background dark:bg-background-dark border border-border rounded-md p-2 text-text-muted">
                  Order ini sudah {STATUS_LABEL[detail.order.status] ?? detail.order.status} dan tidak
                  dapat diubah lagi — data di bawah bersifat lihat saja (rekap).
                </p>
              )}
              {detail.order.notes && (
                <p className="text-xs bg-batik-gold/20 border border-batik-gold/40 rounded-md p-2 text-wood-dark">
                  ℹ️ {detail.order.notes}
                </p>
              )}
              <p className="text-sm font-semibold">Data Pemesan</p>
              <div>
                <label className="text-xs block mb-1">Nama Pelanggan</label>
                <div className="flex gap-2">
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama pelanggan"
                    disabled={isClosed}
                    className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
                  />
                  <button
                    onClick={saveCustomerName}
                    disabled={isPending || isClosed}
                    className="px-3 rounded-md border border-border text-sm disabled:opacity-60"
                  >
                    Simpan
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs block mb-1">Tipe Order & Meja</label>
                <div className="flex gap-2">
                  <select
                    value={orderType}
                    onChange={(e) => setOrderType(e.target.value as "dine_in" | "take_away")}
                    disabled={isClosed}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm disabled:opacity-60"
                  >
                    <option value="dine_in">Dine In</option>
                    <option value="take_away">Take Away</option>
                  </select>
                  {orderType === "dine_in" && (
                    <select
                      value={tableId}
                      onChange={(e) => setTableId(e.target.value)}
                      disabled={isClosed}
                      className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm disabled:opacity-60"
                    >
                      <option value="">Pilih meja</option>
                      {tables.map((t) => (
                        <option key={t.id} value={t.id}>
                          Meja {t.number}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={saveTableAndType}
                    disabled={isPending || isClosed}
                    className="px-3 rounded-md border border-border text-sm disabled:opacity-60"
                  >
                    Simpan
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">
                  1. Verifikasi Item Pesanan <span className="text-xs text-text-muted font-normal">(cek kesesuaian dengan pelanggan)</span>
                </p>
                <div className="divide-y divide-border">
                  {detail.items.map((item: any) => (
                    <div key={item.id} className="py-2">
                      <div className="flex justify-between">
                        <span>
                          {item.quantity}x {item.products?.name}
                        </span>
                        <span>{formatRupiah(item.quantity * Number(item.unit_price))}</span>
                      </div>
                      {item.order_item_modifiers?.length > 0 && (
                        <p className="text-xs text-text-muted">
                          {item.order_item_modifiers.map((m: any) => m.name).join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-between font-semibold text-lg border-t border-border pt-3">
                <span>Total</span>
                <span>{formatRupiah(Number(detail.order.grand_total))}</span>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">2. Kirim ke Dapur / Cetak</p>
                <div className="flex flex-wrap gap-2">
                  {detail.order.status === "NEW" && (
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await sendToKitchenAction(orderId);
                          setStatus("Order dikirim ke dapur.");
                          setDetail({ ...detail, order: { ...detail.order, status: "CONFIRMED" } });
                        })
                      }
                      className="text-sm px-3 py-2 rounded-md bg-secondary text-white font-semibold"
                    >
                      🍳 Kirim ke Dapur
                    </button>
                  )}
                  <a
                    href={`/print/ticket/${orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm px-3 py-2 rounded-md border border-border"
                  >
                    Cetak Tiket Dapur
                  </a>
                  <a
                    href={`/print/receipt/${orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm px-3 py-2 rounded-md border border-border"
                  >
                    Cetak Nota
                  </a>
                </div>
              </div>
            </div>

            {!isClosed && (
              <div className="p-5 border-t border-border space-y-3">
                <p className="text-sm font-semibold">3. Pembayaran</p>
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                >
                  {paymentMethods.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name}
                    </option>
                  ))}
                </select>
                <input
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  placeholder="No. referensi (opsional, isi manual dari mesin QRIS/EDC)"
                  className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm"
                />
                <button
                  onClick={payAndClose}
                  disabled={isPending}
                  className="w-full bg-success text-white py-3 rounded-md font-semibold disabled:opacity-50"
                >
                  Bayar & Tutup Order
                </button>
                {status && <p className="text-sm text-text-muted">{status}</p>}
              </div>
            )}
              </>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
