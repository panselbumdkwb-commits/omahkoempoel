import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type PublicOrderItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
  notes?: string;
  modifierIds?: string[];
};

export type SubmitPublicOrderInput = {
  orderType: "dine_in" | "take_away";
  tableId?: string | null;
  items: PublicOrderItemInput[];
};

/**
 * Menerima order dari konsumen TANPA login (mode tablet/touchscreen di
 * cafe atau QR meja). Ini SATU-SATUNYA jalur yang boleh memakai
 * supabaseAdmin (service role) untuk menulis ke tabel orders, dan hanya
 * karena fungsi ini melakukan validasi ketat sendiri di server:
 *
 * - product_id harus benar-benar ada, aktif, dan milik business ini.
 * - Harga & price_adjustment modifier SELALU diambil ulang dari database,
 *   TIDAK PERNAH dipercaya dari input konsumen (mencegah manipulasi harga
 *   lewat request langsung ke API).
 * - quantity dibatasi wajar (1-50 per item) untuk mencegah abuse.
 *
 * created_by dibiarkan null (order dari konsumen, bukan staf) — tetap
 * tercatat lengkap di audit_logs lewat trigger, hanya actor_id-nya null.
 */
export async function submitPublicOrder(input: SubmitPublicOrderInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error("Keranjang tidak boleh kosong.");
  }
  for (const item of input.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) {
      throw new Error("Jumlah item tidak valid.");
    }
  }

  const { data: business, error: businessError } = await supabaseAdmin
    .from("business")
    .select("id")
    .limit(1)
    .single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  if (input.orderType === "dine_in") {
    if (!input.tableId) throw new Error("Nomor meja wajib dipilih untuk Dine In.");
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, status")
      .eq("id", input.tableId)
      .eq("business_id", business.id)
      .single();
    if (tableError || !table) throw new Error("Meja tidak ditemukan.");
  }

  const { data: orderNumber, error: numberError } = await supabaseAdmin.rpc(
    "fn_next_order_number",
    { p_business_id: business.id }
  );
  if (numberError) throw new Error(`Gagal membuat nomor order: ${numberError.message}`);

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      business_id: business.id,
      order_number: orderNumber,
      order_type: input.orderType,
      table_id: input.orderType === "dine_in" ? input.tableId : null,
      status: "NEW",
      created_by: null,
    })
    .select()
    .single();
  if (orderError) throw new Error(`Gagal membuat order: ${orderError.message}`);

  let subtotal = 0;

  for (const item of input.items) {
    const { data: product, error: productError } = await supabaseAdmin
      .from("products")
      .select("id, price, status")
      .eq("id", item.productId)
      .eq("business_id", business.id)
      .single();
    if (productError || !product || product.status !== "active") {
      throw new Error("Salah satu produk di keranjang tidak tersedia lagi.");
    }

    let unitPrice = Number(product.price);

    if (item.variantId) {
      const { data: variant, error: variantError } = await supabaseAdmin
        .from("product_variants")
        .select("price_adjustment")
        .eq("id", item.variantId)
        .eq("product_id", item.productId)
        .single();
      if (variantError || !variant) throw new Error("Varian produk tidak valid.");
      unitPrice += Number(variant.price_adjustment);
    }

    const { data: orderItem, error: itemError } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: order.id,
        product_id: item.productId,
        variant_id: item.variantId ?? null,
        quantity: item.quantity,
        unit_price: unitPrice,
        notes: item.notes ?? null,
      })
      .select()
      .single();
    if (itemError) throw new Error(`Gagal menambah item: ${itemError.message}`);

    let modifiersTotal = 0;

    if (item.modifierIds && item.modifierIds.length > 0) {
      const { data: modifiers, error: modError } = await supabaseAdmin
        .from("product_modifiers")
        .select("id, name, price_adjustment")
        .in("id", item.modifierIds)
        .eq("product_id", item.productId);
      if (modError) throw new Error(`Gagal memuat modifier: ${modError.message}`);

      if (modifiers && modifiers.length > 0) {
        const { error: insertModError } = await supabaseAdmin.from("order_item_modifiers").insert(
          modifiers.map((m) => ({
            order_item_id: orderItem.id,
            modifier_id: m.id,
            name: m.name,
            price_adjustment: m.price_adjustment,
          }))
        );
        if (insertModError) throw new Error(`Gagal menyimpan modifier: ${insertModError.message}`);
        modifiersTotal = modifiers.reduce((sum, m) => sum + Number(m.price_adjustment), 0);
      }
    }

    subtotal += item.quantity * (unitPrice + modifiersTotal);
  }

  const { error: totalError } = await supabaseAdmin
    .from("orders")
    .update({ subtotal, grand_total: subtotal })
    .eq("id", order.id);
  if (totalError) throw new Error(`Gagal update total order: ${totalError.message}`);

  return { orderId: order.id, orderNumber: order.order_number, grandTotal: subtotal };
}
