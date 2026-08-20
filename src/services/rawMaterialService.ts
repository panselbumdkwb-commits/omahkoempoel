import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type RawMaterialPurchase = {
  id: string;
  purchase_date: string; // YYYY-MM-DD
  item_name: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number;
  supplier: string | null;
  notes: string | null;
};

export async function listPurchases(startDate: string, endDate: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("raw_material_purchases")
    .select("id, purchase_date, item_name, quantity, unit, unit_price, amount, supplier, notes")
    .gte("purchase_date", startDate)
    .lte("purchase_date", endDate)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat belanja bahan baku: ${error.message}`);
  return (data ?? []) as RawMaterialPurchase[];
}

export async function createPurchase(input: {
  purchaseDate: string;
  itemName: string;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount: number;
  supplier?: string | null;
  notes?: string | null;
}) {
  if (!input.itemName.trim()) throw new Error("Nama bahan/item wajib diisi.");
  if (!input.purchaseDate) throw new Error("Tanggal belanja wajib diisi.");
  if (input.amount < 0) throw new Error("Nominal tidak boleh negatif.");

  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase.from("raw_material_purchases").insert({
    business_id: business.id,
    purchase_date: input.purchaseDate,
    item_name: input.itemName.trim(),
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    unit_price: input.unitPrice ?? null,
    amount: input.amount,
    supplier: input.supplier?.trim() || null,
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Gagal mencatat belanja bahan baku: ${error.message}`);
}

export async function deletePurchase(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("raw_material_purchases").delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus catatan belanja: ${error.message}`);
}

/** Total belanja bahan baku untuk 1 rentang tanggal (dipakai Laporan
 * Laba Rugi — dihitung presisi per hari, tidak ada pembulatan bulan
 * seperti biaya operasional 'variable_manual' lainnya). */
export async function getPurchaseTotal(startDate: string, endDate: string) {
  const rows = await listPurchases(startDate, endDate);
  return rows.reduce((sum, r) => sum + Number(r.amount), 0);
}

export type RecapRow = { bucket: string; label: string; total: number; count: number };

/** Rekap Harian — 1 baris per tanggal dalam rentang. */
export function recapDaily(rows: RawMaterialPurchase[]): RecapRow[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const cur = map.get(r.purchase_date) ?? { total: 0, count: 0 };
    cur.total += Number(r.amount);
    cur.count += 1;
    map.set(r.purchase_date, cur);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, v]) => ({
      bucket: date,
      label: new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }),
      total: v.total,
      count: v.count,
    }));
}

function isoWeekKey(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = (d.getUTCDay() + 6) % 7; // Senin = 0
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { key: monday.toISOString().slice(0, 10), monday, sunday };
}

/** Rekap Mingguan — dikelompokkan Senin–Minggu. */
export function recapWeekly(rows: RawMaterialPurchase[]): RecapRow[] {
  const map = new Map<string, { total: number; count: number; monday: Date; sunday: Date }>();
  for (const r of rows) {
    const { key, monday, sunday } = isoWeekKey(r.purchase_date);
    const cur = map.get(key) ?? { total: 0, count: 0, monday, sunday };
    cur.total += Number(r.amount);
    cur.count += 1;
    map.set(key, cur);
  }
  const fmt = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, v]) => ({
      bucket: key,
      label: `${fmt(v.monday)} – ${fmt(v.sunday)}`,
      total: v.total,
      count: v.count,
    }));
}

/** Rekap Bulanan — dikelompokkan per bulan kalender (YYYY-MM). */
export function recapMonthly(rows: RawMaterialPurchase[]): RecapRow[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    const key = r.purchase_date.slice(0, 7);
    const cur = map.get(key) ?? { total: 0, count: 0 };
    cur.total += Number(r.amount);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([key, v]) => ({
      bucket: key,
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
      total: v.total,
      count: v.count,
    }));
}
