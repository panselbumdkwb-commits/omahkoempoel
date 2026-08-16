import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PayrollComponent = {
  id: string;
  name: string;
  component_type: "earning" | "deduction";
  calc_type: "fixed" | "percent_of_basic";
  value: number;
  cap_base: number | null;
  is_active: boolean;
};

export async function listComponents() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payroll_components")
    .select("id, name, component_type, calc_type, value, cap_base, is_active")
    .order("sort_order");
  if (error) throw new Error(`Gagal memuat komponen payroll: ${error.message}`);
  return (data ?? []) as PayrollComponent[];
}

export async function createComponent(input: {
  name: string;
  componentType: "earning" | "deduction";
  calcType: "fixed" | "percent_of_basic";
  value: number;
  capBase?: number | null;
}) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase.from("payroll_components").insert({
    business_id: business.id,
    name: input.name,
    component_type: input.componentType,
    calc_type: input.calcType,
    value: input.value,
    cap_base: input.capBase ?? null,
  });
  if (error) throw new Error(`Gagal menambah komponen: ${error.message}`);
}

export async function toggleComponentActive(id: string, isActive: boolean) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("payroll_components").update({ is_active: isActive }).eq("id", id);
  if (error) throw new Error(`Gagal mengubah status komponen: ${error.message}`);
}

function computeComponentAmount(component: PayrollComponent, basicSalary: number) {
  if (component.calc_type === "fixed") return Number(component.value);
  const base = component.cap_base ? Math.min(basicSalary, Number(component.cap_base)) : basicSalary;
  return Math.round((base * Number(component.value)) / 100);
}

/**
 * Menjalankan payroll untuk satu periode: menghitung gaji SETIAP
 * pegawai aktif berdasarkan basic_salary + komponen yang aktif
 * (earning/deduction) — formula sepenuhnya data-driven, bukan
 * hardcode, sesuai Master Prompt Bagian 34.
 */
export async function runPayroll(periodStart: string, periodEnd: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { data: period, error: periodError } = await supabase
    .from("payroll_periods")
    .insert({ business_id: business.id, period_start: periodStart, period_end: periodEnd, created_by: user?.id ?? null })
    .select()
    .single();
  if (periodError) throw new Error(`Gagal membuat periode payroll: ${periodError.message}`);

  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select("id, basic_salary")
    .eq("status", "active");
  if (empError) throw new Error(`Gagal memuat pegawai aktif: ${empError.message}`);

  const components = await listComponents();
  const activeComponents = components.filter((c) => c.is_active);

  for (const emp of employees ?? []) {
    const basicSalary = Number(emp.basic_salary);
    const earnings = activeComponents
      .filter((c) => c.component_type === "earning")
      .map((c) => ({ name: c.name, amount: computeComponentAmount(c, basicSalary) }));
    const deductions = activeComponents
      .filter((c) => c.component_type === "deduction")
      .map((c) => ({ name: c.name, amount: computeComponentAmount(c, basicSalary) }));

    const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
    const totalDeduction = deductions.reduce((s, d) => s + d.amount, 0);
    const grossSalary = basicSalary + totalEarnings;
    const netSalary = grossSalary - totalDeduction;

    const { error: itemError } = await supabase.from("payroll_items").insert({
      business_id: business.id,
      payroll_period_id: period.id,
      employee_id: emp.id,
      basic_salary: basicSalary,
      earnings_breakdown: earnings,
      deductions_breakdown: deductions,
      gross_salary: grossSalary,
      total_deduction: totalDeduction,
      net_salary: netSalary,
    });
    if (itemError) throw new Error(`Gagal menghitung payroll pegawai: ${itemError.message}`);
  }

  return period;
}

export async function listPayrollPeriods() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payroll_periods")
    .select("id, period_start, period_end, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat periode payroll: ${error.message}`);
  return data ?? [];
}

export async function listPayrollItems(periodId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payroll_items")
    .select(
      "id, basic_salary, earnings_breakdown, deductions_breakdown, gross_salary, total_deduction, net_salary, status, employees(full_name, employee_code)"
    )
    .eq("payroll_period_id", periodId);
  if (error) throw new Error(`Gagal memuat slip gaji: ${error.message}`);
  return data ?? [];
}

export async function approvePayrollPeriod(periodId: string) {
  const supabase = createSupabaseServerClient();
  const { error: e1 } = await supabase.from("payroll_periods").update({ status: "APPROVED" }).eq("id", periodId);
  if (e1) throw new Error(`Gagal approve periode: ${e1.message}`);
  const { error: e2 } = await supabase
    .from("payroll_items")
    .update({ status: "APPROVED" })
    .eq("payroll_period_id", periodId);
  if (e2) throw new Error(`Gagal approve item payroll: ${e2.message}`);
}
