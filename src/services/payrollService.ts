import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type PayrollCalcType =
  | "fixed"
  | "percent_of_basic"
  | "per_day_present"
  | "deduction_per_leave_day"
  | "deduction_per_sick_day"
  | "deduction_per_late_block"
  | "revenue_bonus_share";

export type PayrollComponent = {
  id: string;
  name: string;
  component_type: "earning" | "deduction";
  calc_type: PayrollCalcType;
  value: number;
  cap_base: number | null;
  is_active: boolean;
};

/** Ringkasan absensi 1 pegawai dalam periode payroll, dipakai untuk
 * komponen per_day_present & deduction_per_* (lihat computeComponentAmount). */
type AttendanceSummary = {
  daysPresent: number; // status present ATAU late (tetap dianggap hadir/kerja)
  leaveDays: number; // status 'leave' (Ijin) — potongan Rp30.000/hari
  sickDays: number; // status 'sick' (Sakit) — potongan Rp20.000/hari
  lateMinutesTotal: number; // total menit terlambat, dipotong per akumulasi 60 menit
};

const EMPTY_ATTENDANCE: AttendanceSummary = { daysPresent: 0, leaveDays: 0, sickDays: 0, lateMinutesTotal: 0 };

/** Bonus (Rp) yang sama untuk setiap pegawai aktif pada 1 periode payroll,
 * dihitung SEKALI dari total omset bulan berjalan, bukan per pegawai —
 * lihat computeRevenueBonusPerEmployee(). */
type BonusContext = { bonusPerEmployee: number };

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
  calcType: PayrollCalcType;
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

function computeComponentAmount(
  component: PayrollComponent,
  basicSalary: number,
  attendance: AttendanceSummary,
  bonus: BonusContext
) {
  switch (component.calc_type) {
    case "fixed":
      return Number(component.value);
    case "percent_of_basic": {
      const base = component.cap_base ? Math.min(basicSalary, Number(component.cap_base)) : basicSalary;
      return Math.round((base * Number(component.value)) / 100);
    }
    case "per_day_present":
      // Kompensasi makan harian: Rp{value} x jumlah hari hadir/terlambat.
      return Math.round(Number(component.value) * attendance.daysPresent);
    case "deduction_per_leave_day":
      // Potongan Ijin: Rp{value}/hari.
      return Math.round(Number(component.value) * attendance.leaveDays);
    case "deduction_per_sick_day":
      // Potongan Sakit: Rp{value}/hari.
      return Math.round(Number(component.value) * attendance.sickDays);
    case "deduction_per_late_block":
      // Potongan keterlambatan: Rp{value} per akumulasi 60 menit.
      return Math.round(Number(component.value) * Math.floor(attendance.lateMinutesTotal / 60));
    case "revenue_bonus_share":
      // Bonus omset — nilai sudah dihitung sekali di computeRevenueBonusPerEmployee()
      // dan sama untuk seluruh pegawai aktif pada periode ini.
      return bonus.bonusPerEmployee;
    default:
      return 0;
  }
}

/**
 * Bonus = (Omset bulan berjalan − ambang omset) x persentase, dibagi rata
 * ke seluruh pegawai aktif, dengan jaminan minimum Rp200.000/orang/bulan
 * (kebijakan Owner — floor ini yang membuat komponen "Bonus Kinerja"
 * tetap earning meski omset di bawah ambang, bukan berarti pegawai tidak
 * dapat bonus sama sekali di bulan sepi).
 */
async function computeRevenueBonusPerEmployee(
  component: PayrollComponent,
  periodStart: string,
  periodEnd: string,
  activeEmployeeCount: number
): Promise<number> {
  const MINIMUM_BONUS_PER_EMPLOYEE = 200000;
  if (activeEmployeeCount === 0) return 0;

  const { getSalesReport } = await import("@/services/reportService");
  // getSalesReport pakai batas atas EKSKLUSIF (lt), jadi mundurkan periodEnd
  // satu hari + tambah waktu 23:59:59 supaya tanggal terakhir ikut terhitung.
  const endExclusive = new Date(`${periodEnd}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);
  const report = await getSalesReport(
    new Date(`${periodStart}T00:00:00`).toISOString(),
    endExclusive.toISOString()
  );

  const threshold = component.cap_base ? Number(component.cap_base) : 0;
  const sharePercent = Number(component.value) / 100;
  const pool = Math.max(0, report.revenue - threshold) * sharePercent;
  const perEmployee = Math.round(pool / activeEmployeeCount);
  return Math.max(MINIMUM_BONUS_PER_EMPLOYEE, perEmployee);
}

/** Ambil ringkasan absensi seluruh pegawai dalam 1 periode (dipakai
 * runPayroll) — satu query untuk semua pegawai, dikelompokkan di JS
 * (pola yang sama dipakai reportService untuk laporan penjualan). */
async function getAttendanceSummaryByEmployee(
  periodStart: string,
  periodEnd: string
): Promise<Map<string, AttendanceSummary>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("employee_id, status, late_minutes, attendance_date")
    .gte("attendance_date", periodStart)
    .lte("attendance_date", periodEnd);
  if (error) throw new Error(`Gagal memuat absensi untuk payroll: ${error.message}`);

  const map = new Map<string, AttendanceSummary>();
  for (const row of data ?? []) {
    const current = map.get(row.employee_id) ?? { ...EMPTY_ATTENDANCE };
    if (row.status === "present" || row.status === "late") current.daysPresent += 1;
    if (row.status === "leave") current.leaveDays += 1;
    if (row.status === "sick") current.sickDays += 1;
    if (row.status === "late") current.lateMinutesTotal += Number(row.late_minutes ?? 0);
    map.set(row.employee_id, current);
  }
  return map;
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
    .select("id, basic_salary, employment_type, daily_rate, position_id, employee_positions(default_basic_salary)")
    .eq("status", "active")
    .is("deleted_at", null);
  if (empError) throw new Error(`Gagal memuat pegawai aktif: ${empError.message}`);

  const components = await listComponents();
  const activeComponents = components.filter((c) => c.is_active);
  const activeEmployeeCount = (employees ?? []).length;

  // Komponen bonus omset dihitung SEKALI (bukan per pegawai) supaya
  // pembagiannya benar-benar rata ke seluruh pegawai aktif pada periode ini.
  const bonusComponent = activeComponents.find((c) => c.calc_type === "revenue_bonus_share");
  const bonusPerEmployee = bonusComponent
    ? await computeRevenueBonusPerEmployee(bonusComponent, periodStart, periodEnd, activeEmployeeCount)
    : 0;
  const bonusContext: BonusContext = { bonusPerEmployee };

  const attendanceByEmployee = await getAttendanceSummaryByEmployee(periodStart, periodEnd);

  for (const emp of employees ?? []) {
    const attendance = attendanceByEmployee.get(emp.id) ?? EMPTY_ATTENDANCE;

    // GAJI POKOK OTOMATIS SESUAI JABATAN: kalau pegawai punya jabatan
    // (position_id terisi), gaji pokok yang dipakai payroll SELALU ikut
    // employee_positions.default_basic_salary yang berlaku SAAT payroll
    // dijalankan (bukan angka lama yang tersimpan di employees.basic_salary
    // saat pegawai dibuat) — jadi kalau Admin update gaji pokok jabatan di
    // halaman Payroll, seluruh pegawai jabatan itu otomatis ikut naik/turun
    // di periode payroll berikutnya tanpa perlu diedit satu-satu.
    // employees.basic_salary tetap dipakai sebagai fallback HANYA untuk
    // pegawai yang belum punya jabatan tercatat.
    const positionRel = Array.isArray(emp.employee_positions) ? emp.employee_positions[0] : emp.employee_positions;
    const basicSalary = emp.position_id && positionRel ? Number(positionRel.default_basic_salary) : Number(emp.basic_salary);
    if (emp.employment_type === "casual") {
      const dailyRate = Number(emp.daily_rate);
      const upahHarian = Math.round(dailyRate * attendance.daysPresent);
      const earnings = [{ name: "Upah Harian Casual", amount: upahHarian }];

      const { error: itemError } = await supabase.from("payroll_items").insert({
        business_id: business.id,
        payroll_period_id: period.id,
        employee_id: emp.id,
        basic_salary: 0,
        earnings_breakdown: earnings,
        deductions_breakdown: [],
        gross_salary: upahHarian,
        total_deduction: 0,
        net_salary: upahHarian,
      });
      if (itemError) throw new Error(`Gagal menghitung payroll pegawai casual: ${itemError.message}`);
      continue;
    }

    const earnings = activeComponents
      .filter((c) => c.component_type === "earning")
      .map((c) => ({ name: c.name, amount: computeComponentAmount(c, basicSalary, attendance, bonusContext) }));
    const deductions = activeComponents
      .filter((c) => c.component_type === "deduction")
      .map((c) => ({ name: c.name, amount: computeComponentAmount(c, basicSalary, attendance, bonusContext) }));

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

/**
 * Hapus 1 periode payroll (dari "Riwayat Periode Payroll" di halaman
 * Payroll) yang sudah tidak diperlukan, beserta seluruh slip gaji
 * (payroll_items) di dalamnya — payroll_items.payroll_period_id
 * merujuk ke sini TANPA on delete cascade, jadi item-nya harus dihapus
 * dulu sebelum periode-nya sendiri supaya tidak kena FK violation.
 * Tidak dibatasi status (DRAFT/APPROVED) — Admin/Owner yang menilai
 * apakah periode ini masih diperlukan sebagai arsip atau tidak.
 */
export async function deletePayrollPeriod(periodId: string) {
  const supabase = createSupabaseServerClient();
  const { error: itemsError } = await supabase
    .from("payroll_items")
    .delete()
    .eq("payroll_period_id", periodId);
  if (itemsError) throw new Error(`Gagal menghapus slip gaji periode ini: ${itemsError.message}`);

  const { error } = await supabase.from("payroll_periods").delete().eq("id", periodId);
  if (error) throw new Error(`Gagal menghapus periode payroll: ${error.message}`);
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
