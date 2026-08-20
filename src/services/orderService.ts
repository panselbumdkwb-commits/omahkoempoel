import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getJakartaTodayRange } from "@/lib/timezone";

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

/**
 * Daftar order yang masih perlu diproses kasir (belum CLOSED) — dari
 * kanal manapun (digital menu publik, kasir manual, dll). Ini adalah
 * data utama yang ditampilkan di halaman /pos sebagai "Order Masuk".
 */
export async function listOpenOrders() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, status, grand_total, customer_name, created_at, tables(number)"
    )
    .neq("status", "CLOSED")
    .neq("status", "VOID")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Gagal memuat daftar order: ${error.message}`);
  return data ?? [];
}

/**
 * Riwayat transaksi yang sudah dibayar/ditutup (PAID atau CLOSED),
 * untuk direkap di akun KASIR — sebelumnya order langsung "hilang"
 * dari tampilan begitu ditutup karena listOpenOrders() mengecualikan
 * status ini. Default rentang: hari ini (shift berjalan), berdasarkan
 * jam lokal Asia/Jakarta.
 */
export async function listClosedOrders(params?: { from?: string; to?: string }) {
  const supabase = createSupabaseServerClient();

  // PENTING: jangan pakai `new Date().setHours(0,0,0,0)` — di server Vercel
  // itu berpatokan pada jam SERVER (default UTC), bukan WIB, sehingga batas
  // "hari ini" bisa meleset sampai 7 jam dari hari sebenarnya di Kota Batu.
  const { startUTC, endUTC } = getJakartaTodayRange();
  const from = params?.from ?? startUTC.toISOString();
  const to = params?.to ?? endUTC.toISOString();

  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, status, grand_total, customer_name, created_at, tables(number)"
    )
    .in("status", ["PAID", "CLOSED"])
    .gte("created_at", from)
    .lte("created_at", to)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat riwayat transaksi: ${error.message}`);
  return data ?? [];
}

/** Detail lengkap 1 order (item, modifier, meja, kasir yang menutup/
 * memproses pembayaran) untuk ditampilkan saat kasir membuka sebuah
 * order dari daftar order masuk, dan untuk dicetak di nota. */
export async function getOrderDetail(orderId: string) {
  const supabase = createSupabaseServerClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_type, status, subtotal, grand_total, customer_name, table_id, created_at, closed_by, notes, tables(number)"
    )
    .eq("id", orderId)
    .single();
  if (orderError) throw new Error(`Order tidak ditemukan: ${orderError.message}`);

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, quantity, unit_price, notes, products(name, station), order_item_modifiers(name, price_adjustment)")
    .eq("order_id", orderId);
  if (itemsError) throw new Error(`Gagal memuat item order: ${itemsError.message}`);

  // Query terpisah (bukan embed relasi PostgREST) supaya tidak bergantung
  // pada tebakan nama FK constraint — orders punya 2 relasi ke profiles
  // (created_by & closed_by) yang bisa ambigu kalau di-embed langsung.
  let cashierName: string | null = null;
  if (order.closed_by) {
    const { data: cashierProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", order.closed_by)
      .single();
    cashierName = cashierProfile?.full_name ?? null;
  }

  return { order, items: items ?? [], cashierName };
}

/** Nama staf yang sedang login (dipakai untuk label "Kasir" di nota saat
 * order belum dibayar/ditutup, jadi belum ada closed_by). */
export async function getCurrentStaffName(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  return data?.full_name ?? null;
}

/** Kasir melengkapi meja & tipe order untuk pesanan yang masuk tanpa
 * data ini dari pelanggan (mis. order dari menu digital publik). */
export async function updateOrderTableAndType(
  orderId: string,
  tableId: string | null,
  orderType: "dine_in" | "take_away"
) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ table_id: orderType === "dine_in" ? tableId : null, order_type: orderType })
    .eq("id", orderId);
  if (error) throw new Error(`Gagal menyimpan meja/tipe order: ${error.message}`);
}


export async function updateCustomerName(orderId: string, customerName: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ customer_name: customerName })
    .eq("id", orderId);
  if (error) throw new Error(`Gagal menyimpan nama pelanggan: ${error.message}`);
}


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
