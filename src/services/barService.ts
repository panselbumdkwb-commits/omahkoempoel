import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type BarOrder = {
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

/** Papan pesanan untuk Bar: sama seperti kitchenService.listKitchenBoard(),
 * tapi khusus item dengan products.station = 'bar' (minuman). Order yang
 * murni berisi makanan (tanpa minuman) otomatis tidak muncul di sini.
 *
 * CATATAN DESAIN: status order (NEW/CONFIRMED/PROCESSING/READY/SERVED)
 * adalah 1 kolom bersama di tabel `orders`, dipakai bareng oleh Dapur,
 * Bar, dan Kasir — bukan status terpisah per item. Untuk order campuran
 * (ada makanan & minuman sekaligus), kedua tim (Dapur & Bar) sama-sama
 * bisa melihat & mengubah status order tersebut; koordinasikan siapa
 * yang menandai "Siap" terakhir. Kalau ke depan volume order campuran
 * banyak dan butuh status per station terpisah, perlu kolom status baru
 * di order_items (perubahan skema terpisah, belum dibuat di sini). */
export async function listBarBoard(): Promise<BarOrder[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, status, created_at, customer_name, tables(number), order_items!inner(id, quantity, notes, products!inner(name, station), order_item_modifiers(name))"
    )
    .in("status", ["NEW", "CONFIRMED", "PROCESSING", "READY"])
    .eq("order_items.products.station", "bar")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal memuat papan Bar: ${error.message}`);
  return (data ?? []) as unknown as BarOrder[];
}

export async function advanceOrderStatus(
  orderId: string,
  status: "CONFIRMED" | "PROCESSING" | "READY" | "SERVED"
) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(`Gagal mengubah status order: ${error.message}`);
}
