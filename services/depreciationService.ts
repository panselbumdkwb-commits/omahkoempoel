import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type AssetCategory = "equipment" | "furniture" | "vehicle" | "building" | "other";
export type AssetExpenseType = "operational" | "non_operational";

export type FixedAsset = {
  id: string;
  name: string;
  category: AssetCategory;
  acquisition_date: string; // YYYY-MM-DD
  acquisition_cost: number;
  residual_value: number;
  useful_life_months: number;
  expense_type: AssetExpenseType;
  is_active: boolean;
  notes: string | null;
};

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  equipment: "Peralatan",
  furniture: "Meja/Kursi/Furnitur",
  vehicle: "Kendaraan",
  building: "Bangunan/Renovasi",
  other: "Lainnya",
};

export async function listAssets() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fixed_assets")
    .select("id, name, category, acquisition_date, acquisition_cost, residual_value, useful_life_months, expense_type, is_active, notes")
    .order("acquisition_date", { ascending: false });
  if (error) throw new Error(`Gagal memuat data aset: ${error.message}`);
  return (data ?? []) as FixedAsset[];
}

export async function createAsset(input: {
  name: string;
  category: AssetCategory;
  acquisitionDate: string;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeMonths: number;
  expenseType?: AssetExpenseType;
  notes?: string | null;
}) {
  if (!input.name.trim()) throw new Error("Nama aset wajib diisi.");
  if (!input.acquisitionDate) throw new Error("Tanggal perolehan wajib diisi.");
  if (input.acquisitionCost < 0) throw new Error("Harga perolehan tidak boleh negatif.");
  if (input.residualValue < 0) throw new Error("Nilai residu tidak boleh negatif.");
  if (input.residualValue > input.acquisitionCost) throw new Error("Nilai residu tidak boleh lebih besar dari harga perolehan.");
  if (input.usefulLifeMonths <= 0) throw new Error("Umur manfaat harus lebih dari 0 bulan.");

  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase.from("fixed_assets").insert({
    business_id: business.id,
    name: input.name.trim(),
    category: input.category,
    acquisition_date: input.acquisitionDate,
    acquisition_cost: input.acquisitionCost,
    residual_value: input.residualValue,
    useful_life_months: input.usefulLifeMonths,
    expense_type: input.expenseType ?? "operational",
    notes: input.notes?.trim() || null,
  });
  if (error) throw new Error(`Gagal menambah aset: ${error.message}`);
}

export async function toggleAssetActive(id: string, isActive: boolean) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("fixed_assets")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Gagal mengubah status aset: ${error.message}`);
}

/** Penyusutan bulanan metode garis lurus (straight-line):
 * (Harga Perolehan − Nilai Residu) / Umur Manfaat (bulan).
 * Metode ini standar & paling umum dipakai UMKM karena sederhana,
 * konsisten, dan mudah diaudit (nilai penyusutan sama tiap bulan
 * sepanjang umur manfaat aset). */
export function monthlyDepreciation(asset: FixedAsset): number {
  const depreciable = Math.max(0, Number(asset.acquisition_cost) - Number(asset.residual_value));
  return depreciable / asset.useful_life_months;
}

function monthDiff(fromISO: string, toYearMonth: string): number {
  const from = new Date(`${fromISO}T00:00:00`);
  const [ty, tm] = toYearMonth.split("-").map(Number);
  return (ty - from.getUTCFullYear()) * 12 + (tm - 1 - from.getUTCMonth());
}

/** Apakah aset masih dalam masa penyusutan pada bulan kalender
 * tertentu (YYYY-MM) — dihitung dari bulan perolehan sampai
 * (bulan perolehan + umur manfaat − 1). */
export function isDepreciableInMonth(asset: FixedAsset, periodMonth: string): boolean {
  const diff = monthDiff(asset.acquisition_date, periodMonth);
  return diff >= 0 && diff < asset.useful_life_months;
}

export type DepreciationRow = {
  name: string;
  category: AssetCategory;
  expense_type: AssetExpenseType;
  amount: number;
};

/** Total Biaya Penyusutan untuk 1 periode. Mengikuti pola perhitungan
 * biaya operasional variabel lain di aplikasi ini (lihat
 * operationalExpenseService & PHASE_FINANCE_HR.md): dihitung per
 * BULAN KALENDER dari tanggal mulai periode — akurat untuk periode 1
 * bulan (kasus paling umum di Laporan). */
export async function computeDepreciationForPeriod(periodStartDate: string): Promise<{ breakdown: DepreciationRow[]; total: number }> {
  const periodMonth = periodStartDate.slice(0, 7);
  const assets = await listAssets();
  const breakdown = assets
    .filter((a) => a.is_active && isDepreciableInMonth(a, periodMonth))
    .map((a) => ({
      name: a.name,
      category: a.category,
      expense_type: a.expense_type,
      amount: Math.round(monthlyDepreciation(a)),
    }));
  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return { breakdown, total };
}
