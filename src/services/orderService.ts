import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type CreateOrderInput = {
  businessId: string;
  orderType: "dine_in" | "take_away" | "reservation";
  tableId?: string | null;
  notes?: string;
};

export type AddOrderItemInput = {
  orderId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  notes?: string;
  modifiers?: { modifierId: string; name: string; priceAdjustment: number }[];
};

/**
 * Membuat order baru dalam status NEW.
 * Nomor order dihasilkan server-side lewat fn_next_order_number(),
 * bukan digenerate di client, untuk menghindari duplikasi/manipulasi.
 */
export async function createOrder(input: CreateOrderInput) {
  const supabase = createSupabaseServerClient();

  const { data: orderNumber, error: numberError } = await supabase.rpc(
    "fn_next_order_number",
    { p_business_id: input.businessId }
  );
  if (numberError) throw new Error(`Gagal membuat nomor order: ${numberError.message}`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("orders")
    .insert({
      business_id: input.businessId,
      order_number: orderNumber,
      order_type: input.orderType,
      table_id: input.tableId ?? null,
      notes: input.notes ?? null,
      status: "NEW",
      created_by: user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal membuat order: ${error.message}`);
  return data;
}

/** Menambah item ke order yang masih berjalan (belum CLOSED). */
export async function addOrderItem(input: AddOrderItemInput) {
  const supabase = createSupabaseServerClient();

  const { data: item, error } = await supabase
    .from("order_items")
    .insert({
      order_id: input.orderId,
      product_id: input.productId,
      variant_id: input.variantId ?? null,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      notes: input.notes ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Gagal menambah item: ${error.message}`);

  if (input.modifiers && input.modifiers.length > 0) {
    const { error: modError } = await supabase.from("order_item_modifiers").insert(
      input.modifiers.map((m) => ({
        order_item_id: item.id,
        modifier_id: m.modifierId,
        name: m.name,
        price_adjustment: m.priceAdjustment,
      }))
    );
    if (modError) throw new Error(`Gagal menambah modifier: ${modError.message}`);
  }

  await recalculateOrderTotals(input.orderId);
  return item;
}

/**
 * Hitung ulang subtotal & grand_total order berdasarkan order_items
 * yang ada. Dipanggil setiap kali item berubah. Diskon/pajak/service
 * charge diterapkan di sini dengan nilai 0 untuk sekarang — Phase Tax
 * akan menghubungkan ke tabel `taxes`/`tax_rules` sesuai konfigurasi,
 * bukan tarif hardcode.
 */
async function recalculateOrderTotals(orderId: string) {
  const supabase = createSupabaseServerClient();

  const { data: items, error } = await supabase
    .from("order_items")
    .select("quantity, unit_price, order_item_modifiers(price_adjustment)")
    .eq("order_id", orderId);

  if (error) throw new Error(`Gagal menghitung total: ${error.message}`);

  const subtotal = (items ?? []).reduce((sum, item: any) => {
    const modifiersTotal = (item.order_item_modifiers ?? []).reduce(
      (mSum: number, m: any) => mSum + Number(m.price_adjustment),
      0
    );
    return sum + item.quantity * (Number(item.unit_price) + modifiersTotal);
  }, 0);

  // NOTE: discount/tax/service_charge belum dihitung otomatis di sini —
  // akan diisi dari system_settings/tax_rules pada iterasi berikutnya.
  const { error: updateError } = await supabase
    .from("orders")
    .update({ subtotal, grand_total: subtotal })
    .eq("id", orderId);

  if (updateError) throw new Error(`Gagal update total order: ${updateError.message}`);
}

/** Update status order (NEW -> CONFIRMED -> PROCESSING -> READY -> SERVED). */
export async function updateOrderStatus(
  orderId: string,
  status: "CONFIRMED" | "PROCESSING" | "READY" | "SERVED"
) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw new Error(`Gagal update status order: ${error.message}`);
}

/**
 * Menutup order (CLOSED). Hanya boleh dilakukan setelah status PAID
 * (divalidasi lewat pemanggil / paymentService). Setelah CLOSED, trigger
 * database (fn_block_closed_order_update) akan menolak UPDATE lebih
 * lanjut ke baris ini — sesuai prinsip Financial Integrity.
 */
export async function closeOrder(orderId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (fetchError) throw new Error(`Order tidak ditemukan: ${fetchError.message}`);
  if (order.status !== "PAID") {
    throw new Error("Order hanya dapat ditutup setelah status PAID.");
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "CLOSED", closed_by: user?.id ?? null, closed_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) throw new Error(`Gagal menutup order: ${error.message}`);
}
