import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type ExpenseCategory = "utility" | "social" | "other";
export type ExpenseCalcType = "fixed" | "percent_of_revenue" | "variable_manual";

export type OperationalExpense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  calc_type: ExpenseCalcType;
  value: number;
  is_active: boolean;
};

export async function listExpenses() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_expenses")
    .select("id, name, category, calc_type, value, is_active")
    .order("sort_order");
  if (error) throw new Error(`Gagal memuat biaya operasional: ${error.message}`);
  return (data ?? []) as OperationalExpense[];
}

/** Catatan nominal aktual bulan tertentu untuk biaya `variable_manual`
 * (mis. Listrik/Air) — dikembalikan sebagai map expense_id -> amount
 * supaya gampang dipakai untuk prefill form di UI. */
export async function listExpenseEntriesForMonth(periodMonth: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("operational_expense_entries")
    .select("expense_id, amount")
    .eq("period_month", periodMonth);
  if (error) throw new Error(`Gagal memuat catatan biaya bulan ini: ${error.message}`);
  const map: Record<string, number> = {};
  for (const row of data ?? []) map[row.expense_id] = Number(row.amount);
  return map;
}

/** Catat/ubah nominal aktual 1 biaya variable_manual untuk 1 bulan
 * kalender (mis. tagihan Listrik Agustus 2026 = Rp620.000). Upsert
 * berdasarkan (expense_id, period_month) — mencatat ulang bulan yang
 * sama akan menimpa angka sebelumnya, bukan menambah baris baru. */
export async function recordExpenseEntry(expenseId: string, periodMonth: string, amount: number) {
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) throw new Error("Format bulan tidak valid (harus YYYY-MM).");
  if (amount < 0) throw new Error("Nominal tidak boleh negatif.");
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase.from("operational_expense_entries").upsert(
    {
      business_id: business.id,
      expense_id: expenseId,
      period_month: periodMonth,
      amount,
      updated_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    },
    { onConflict: "expense_id,period_month" }
  );
  if (error) throw new Error(`Gagal mencatat biaya: ${error.message}`);
}

export async function createExpense(input: {
  name: string;
  category: ExpenseCategory;
  calcType: ExpenseCalcType;
  value: number;
}) {
  if (!input.name.trim()) throw new Error("Nama biaya wajib diisi.");
  if (input.value < 0) throw new Error("Nilai tidak boleh negatif.");
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase.from("operational_expenses").insert({
    business_id: business.id,
    name: input.name.trim(),
    category: input.category,
    calc_type: input.calcType,
    value: input.value,
  });
  if (error) throw new Error(`Gagal menambah biaya operasional: ${error.message}`);
}

export async function updateExpenseValue(id: string, value: number) {
  if (value < 0) throw new Error("Nilai tidak boleh negatif.");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("operational_expenses").update({ value, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`Gagal memperbarui biaya operasional: ${error.message}`);
}

export async function toggleExpenseActive(id: string, isActive: boolean) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("operational_expenses").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(`Gagal mengubah status biaya operasional: ${error.message}`);
}

/**
 * Total biaya operasional untuk 1 periode (biasanya 1 bulan): item
 * `fixed` dijumlah langsung, item `percent_of_revenue` (mis. Cadangan
 * Kebutuhan Sosial 0.5%) dihitung dari omset penjualan periode
 * tersebut lewat reportService.getSalesReport — pola yang sama dengan
 * komponen "Bonus Kinerja (Omset)" di payrollService. Item
 * `variable_manual` (Listrik/Air) diambil dari catatan aktual bulan
 * kalender yang beririsan dengan periodStart (operational_expense_entries)
 * — kalau belum pernah dicatat, amount = 0 dan recorded = false supaya
 * UI bisa menampilkan "belum dicatat" alih-alih angka yang menyesatkan.
 */
export async function computeMonthlyExpenseTotal(periodStart: string, periodEnd: string) {
  const expenses = (await listExpenses()).filter((e) => e.is_active);
  const periodMonth = periodStart.slice(0, 7); // 'YYYY-MM-DD' -> 'YYYY-MM'

  const needsRevenue = expenses.some((e) => e.calc_type === "percent_of_revenue");
  let revenue = 0;
  if (needsRevenue) {
    const { getSalesReport } = await import("@/services/reportService");
    const endExclusive = new Date(`${periodEnd}T00:00:00`);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const report = await getSalesReport(new Date(`${periodStart}T00:00:00`).toISOString(), endExclusive.toISOString());
    revenue = report.revenue;
  }

  const needsEntries = expenses.some((e) => e.calc_type === "variable_manual");
  const entriesMap = needsEntries ? await listExpenseEntriesForMonth(periodMonth) : {};

  const breakdown = expenses.map((e) => {
    if (e.calc_type === "fixed") {
      return { name: e.name, category: e.category, calc_type: e.calc_type, value: e.value, amount: Number(e.value), recorded: true };
    }
    if (e.calc_type === "percent_of_revenue") {
      const amount = Math.round((revenue * Number(e.value)) / 100);
      return { name: e.name, category: e.category, calc_type: e.calc_type, value: e.value, amount, recorded: true };
    }
    // variable_manual
    const recorded = Object.prototype.hasOwnProperty.call(entriesMap, e.id);
    return {
      name: e.name,
      category: e.category,
      calc_type: e.calc_type,
      value: e.value,
      amount: entriesMap[e.id] ?? 0,
      recorded,
    };
  });

  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
  return { breakdown, total, revenue, periodMonth };
}
