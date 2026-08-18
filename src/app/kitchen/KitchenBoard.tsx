"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import { advanceOrderStatusAction } from "./actions";
import type { KitchenOrder } from "@/services/kitchenService";
import DateTimeBadge from "@/components/DateTimeBadge";

function tableLabel(order: KitchenOrder) {
  if (order.order_type === "take_away") return "Take Away";
  const t = order.tables;
  if (!t) return "-";
  const number = Array.isArray(t) ? t[0]?.number : t.number;
  return number ? `Meja ${number}` : "-";
}

function productName(item: KitchenOrder["order_items"][number]) {
  const p = item.products;
  if (!p) return "-";
  return Array.isArray(p) ? p[0]?.name ?? "-" : p.name;
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "baru saja";
  return `${mins} menit lalu`;
}

export default function KitchenBoard({
  initialOrders,
  showDateTimeClock,
}: {
  initialOrders: KitchenOrder[];
  showDateTimeClock: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    const channel = supabase
      .channel("kds-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => router.refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => router.refresh())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const columns: { title: string; statuses: string[]; nextStatus: any; nextLabel: string }[] = [
    { title: "Baru", statuses: ["NEW", "CONFIRMED"], nextStatus: "PROCESSING", nextLabel: "Mulai Proses" },
    { title: "Diproses", statuses: ["PROCESSING"], nextStatus: "READY", nextLabel: "Tandai Siap" },
    { title: "Siap Disajikan", statuses: ["READY"], nextStatus: "SERVED", nextLabel: "Sudah Disajikan" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border px-4 py-3 flex justify-between items-center bg-surface dark:bg-surface-dark">
        <h1 className="font-heading text-xl text-primary">Omah Mburi — Dapur</h1>
        {showDateTimeClock && (
          <DateTimeBadge variant="compact" className="text-sm text-text-muted hidden sm:inline" />
        )}
        <button onClick={handleLogout} className="text-sm text-danger font-semibold">
          Logout
        </button>
      </header>

      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
        {columns.map((col) => {
          const orders = initialOrders.filter((o) => col.statuses.includes(o.status));
          return (
            <div key={col.title} className="bg-surface dark:bg-surface-dark rounded-md border border-border p-3">
              <h2 className="font-heading text-lg text-primary mb-3">
                {col.title} <span className="text-sm text-text-muted">({orders.length})</span>
              </h2>
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-md border border-border p-3 bg-background dark:bg-background-dark">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold">
                          {order.order_number} · {tableLabel(order)}
                        </p>
                        <p className="text-xs text-text-muted">
                          {order.customer_name || "Tanpa nama"} · {timeAgo(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <ul className="text-sm mb-3 space-y-1">
                      {order.order_items.map((item) => (
                        <li key={item.id}>
                          <span className="font-semibold">{item.quantity}x</span> {productName(item)}
                          {item.order_item_modifiers.length > 0 && (
                            <span className="text-xs text-text-muted">
                              {" "}
                              ({item.order_item_modifiers.map((m) => m.name).join(", ")})
                            </span>
                          )}
                          {item.notes && <span className="text-xs text-text-muted"> — {item.notes}</span>}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => advanceOrderStatusAction(order.id, col.nextStatus)}
                      className="w-full bg-primary text-white py-2 rounded-md text-sm font-semibold"
                    >
                      {col.nextLabel}
                    </button>
                  </div>
                ))}
                {orders.length === 0 && <p className="text-xs text-text-muted">Tidak ada order.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
