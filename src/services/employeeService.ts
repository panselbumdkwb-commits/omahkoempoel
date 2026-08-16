import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type EmployeeInput = {
  employeeCode: string;
  fullName: string;
  phone?: string;
  positionId?: string | null;
  basicSalary: number;
  joinDate?: string;
};

export async function listEmployees() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_code, full_name, phone, position_id, basic_salary, status, join_date, employee_positions(name)")
    .order("full_name");
  if (error) throw new Error(`Gagal memuat data pegawai: ${error.message}`);
  return data ?? [];
}

export async function listPositions() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("employee_positions").select("id, name").order("name");
  if (error) throw new Error(`Gagal memuat jabatan: ${error.message}`);
  return data ?? [];
}

export async function createPosition(name: string) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");
  const { error } = await supabase.from("employee_positions").insert({ business_id: business.id, name });
  if (error) throw new Error(`Gagal menambah jabatan: ${error.message}`);
}

export async function createEmployee(input: EmployeeInput) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");
  if (input.basicSalary < 0) throw new Error("Gaji pokok tidak boleh negatif.");

  const { error } = await supabase.from("employees").insert({
    business_id: business.id,
    employee_code: input.employeeCode,
    full_name: input.fullName,
    phone: input.phone ?? null,
    position_id: input.positionId ?? null,
    basic_salary: input.basicSalary,
    join_date: input.joinDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(`Gagal menambah pegawai: ${error.message}`);
}

export async function updateEmployee(
  id: string,
  updates: Partial<{ fullName: string; phone: string; positionId: string; basicSalary: number }>
) {
  const supabase = createSupabaseServerClient();
  if (updates.basicSalary !== undefined && updates.basicSalary < 0) {
    throw new Error("Gaji pokok tidak boleh negatif.");
  }
  const { error } = await supabase
    .from("employees")
    .update({
      ...(updates.fullName !== undefined && { full_name: updates.fullName }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.positionId !== undefined && { position_id: updates.positionId }),
      ...(updates.basicSalary !== undefined && { basic_salary: updates.basicSalary }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Gagal memperbarui pegawai: ${error.message}`);
}

export async function setEmployeeStatus(id: string, status: "active" | "inactive" | "resigned") {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("employees").update({ status }).eq("id", id);
  if (error) throw new Error(`Gagal mengubah status pegawai: ${error.message}`);
}

export async function setEmployeePin(id: string, pin: string) {
  if (!/^\d{4,6}$/.test(pin)) {
    throw new Error("PIN harus 4-6 digit angka.");
  }
  const supabase = createSupabaseServerClient();
  const { hashPin } = await import("@/lib/pin");
  const { error } = await supabase
    .from("employees")
    .update({ attendance_pin_hash: hashPin(pin) })
    .eq("id", id);
  if (error) throw new Error(`Gagal mengatur PIN: ${error.message}`);
}

// ---------------------------------------------------------------
// ATTENDANCE
// ---------------------------------------------------------------

export async function listAttendanceByDate(date: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, employee_id, clock_in, clock_out, status, notes, employees(full_name, employee_code)")
    .eq("attendance_date", date);
  if (error) throw new Error(`Gagal memuat absensi: ${error.message}`);
  return data ?? [];
}

/** Catat kehadiran manual oleh Admin/Owner (belum ada integrasi
 * biometrik/lokasi — sesuai catatan privasi di Bagian 31 master
 * prompt, perangkat semacam itu butuh persetujuan eksplisit dan
 * belum diaktifkan). */
export async function recordAttendance(input: {
  employeeId: string;
  date: string;
  clockIn?: string | null;
  clockOut?: string | null;
  status: "present" | "late" | "absent" | "leave" | "early_leave";
  notes?: string;
}) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase.from("attendance").upsert(
    {
      business_id: business.id,
      employee_id: input.employeeId,
      attendance_date: input.date,
      clock_in: input.clockIn ?? null,
      clock_out: input.clockOut ?? null,
      status: input.status,
      notes: input.notes ?? null,
    },
    { onConflict: "employee_id,attendance_date" }
  );
  if (error) throw new Error(`Gagal mencatat absensi: ${error.message}`);
}
