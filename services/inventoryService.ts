import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type InventoryCategory = "bahan_baku" | "peralatan" | "perlengkapan";

export const INVENTORY_CATEGORY_LABEL: Record<InventoryCategory, string> = {
  bahan_baku: "Bahan Baku",
  peralatan: "Peralatan",
  perlengkapan: "Perlengkapan",
};

export type InventoryItem = {
  id: string;
  category: InventoryCategory;
  name: string;
  unit: string;
  current_stock: number;
  par_stock: number;
  alert_threshold_percent: number;
  is_active: boolean;
  notes: string | null;
};

export type InventoryItemWithAlert = InventoryItem & {
  alert_level: number; // current_stock sebagai % dari par_stock (0 kalau par_stock = 0)
  is_low_stock: boolean;
};

function withAlert(item: InventoryItem): InventoryItemWithAlert {
  const alert_level = item.par_stock > 0 ? (item.current_stock / item.par_stock) * 100 : 0;
  const is_low_stock = item.par_stock > 0 && alert_level <= item.alert_threshold_percent;
  return { ...item, alert_level, is_low_stock };
}

export async function listInventoryItems(): Promise<InventoryItemWithAlert[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, category, name, unit, current_stock, par_stock, alert_threshold_percent, is_active, notes")
    .order("category")
    .order("name");
  if (error) throw new Error(`Gagal memuat data persediaan: ${error.message}`);
  return ((data ?? []) as InventoryItem[]).map(withAlert);
}

export async function listLowStockItems(): Promise<InventoryItemWithAlert[]> {
  const items = await listInventoryItems();
  return items.filter((i) => i.is_active && i.is_low_stock);
}

export async function createInventoryItem(input: {
  category: InventoryCategory;
  name: string;
  unit: string;
  parStock: number;
  alertThresholdPercent?: number;
  initialStock?: number;
  notes?: string | null;
}) {
  if (!input.name.trim()) throw new Error("Nama item wajib diisi.");
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      business_id: business.id,
      category: input.category,
      name: input.name.trim(),
      unit: input.unit.trim() || "pcs",
      par_stock: input.parStock,
      alert_threshold_percent: input.alertThresholdPercent ?? 10,
      current_stock: 0,
      notes: input.notes?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Gagal menambah item persediaan: ${error.message}`);

  const initial = input.initialStock ?? 0;
  if (initial > 0 && data) {
    await recordStockMovement({
      inventoryItemId: data.id,
      movementType: "in",
      quantity: initial,
      note: "Stok awal saat item ditambahkan",
    });
  }
}

export async function updateInventoryItem(
  id: string,
  input: { parStock?: number; alertThresholdPercent?: number; unit?: string; notes?: string | null; isActive?: boolean }
) {
  const supabase = createSupabaseServerClient();
  const patch: Record<string, unknown> = {};
  if (input.parStock !== undefined) patch.par_stock = input.parStock;
  if (input.alertThresholdPercent !== undefined) patch.alert_threshold_percent = input.alertThresholdPercent;
  if (input.unit !== undefined) patch.unit = input.unit;
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null;
  if (input.isActive !== undefined) patch.is_active = input.isActive;

  const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
  if (error) throw new Error(`Gagal memperbarui item persediaan: ${error.message}`);
}

export async function deleteInventoryItem(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus item persediaan: ${error.message}`);
}

export async function recordStockMovement(input: {
  inventoryItemId: string;
  movementType: "in" | "out" | "adjustment";
  quantity: number; // selalu kirim angka positif; arah ditentukan movementType
  note?: string | null;
  relatedPurchaseId?: string | null;
}) {
  if (input.quantity === 0) throw new Error("Jumlah mutasi tidak boleh 0.");
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedQuantity =
    input.movementType === "out" ? -Math.abs(input.quantity) : input.movementType === "in" ? Math.abs(input.quantity) : input.quantity;

  const { error } = await supabase.from("inventory_stock_movements").insert({
    business_id: business.id,
    inventory_item_id: input.inventoryItemId,
    movement_type: input.movementType,
    quantity: signedQuantity,
    note: input.note?.trim() || null,
    related_purchase_id: input.relatedPurchaseId ?? null,
    created_by: user?.id ?? null,
  });
  if (error) throw new Error(`Gagal mencatat mutasi stok: ${error.message}`);
}

export async function listStockMovements(inventoryItemId: string, limit = 30) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_stock_movements")
    .select("id, movement_type, quantity, note, created_at")
    .eq("inventory_item_id", inventoryItemId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal memuat riwayat mutasi stok: ${error.message}`);
  return data ?? [];
}
