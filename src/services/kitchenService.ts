import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type KitchenOrder = {
  id: string;
  order_number: string;
  order_type: string;
  status: string;
  created_at: string;
  customer_name: string | null;
  tables: { number: string } | { number: string }[] | null;
  order_items: {
    id: string;
    quantity: number;
    notes: string | null;
    products: { name: string } | { name: string }[] | null;
    order_item_modifiers: { name: string }[];
  }[];
};

/** Papan pesanan untuk dapur: order dari status NEW s/d READY (sebelum
 * SERVED). Order yang sudah SERVED/PAID/CLOSED tidak lagi relevan untuk
 * dapur, jadi tidak ditampilkan di sini (tetap terlihat di /pos). */
export async function listKitchenBoard(): Promise<KitchenOrder[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, status, created_at, customer_name, tables(number), order_items(id, quantity, notes, products(name), order_item_modifiers(name))"
    )
    .in("status", ["NEW", "CONFIRMED", "PROCESSING", "READY"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal memuat papan dapur: ${error.message}`);
  return (data ?? []) as unknown as KitchenOrder[];
}

export async function advanceOrderStatus(
  orderId: string,
  status: "CONFIRMED" | "PROCESSING" | "READY" | "SERVED"
) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(`Gagal mengubah status order: ${error.message}`);
}
