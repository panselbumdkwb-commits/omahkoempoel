import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPin } from "@/lib/pin";
import { getJakartaTodayRange } from "@/lib/timezone";

/** Daftar pegawai aktif untuk dipilih di layar kios — HANYA nama,
 * tidak ada data gaji/sensitif lain yang ditampilkan di layar publik. */
export async function listActiveEmployeesForKiosk() {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, employee_code")
    .eq("status", "active")
    .order("full_name");
  if (error) throw new Error("Gagal memuat daftar pegawai.");
  return data ?? [];
}

function todayJakartaDateString(): string {
  const { startUTC } = getJakartaTodayRange();
  const shifted = new Date(startUTC.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Clock-in/out mandiri oleh pegawai lewat kios. Ini SATU-SATUNYA jalur
 * lain (selain publicOrderService) yang memakai supabaseAdmin, karena
 * halaman kios memang tidak mensyaratkan login staf. Keamanannya
 * bertumpu pada verifikasi PIN per pegawai (hash, bukan plaintext) —
 * bukan pada RLS/role, karena memang tidak ada sesi user di sini.
 */
export async function kioskClockAttendance(
  employeeId: string,
  pin: string,
  action: "in" | "out"
) {
  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, attendance_pin_hash, business_id, status")
    .eq("id", employeeId)
    .single();
  if (empError || !employee) throw new Error("Pegawai tidak ditemukan.");
  if (employee.status !== "active") throw new Error("Akun pegawai ini tidak aktif.");

  if (!employee.attendance_pin_hash) {
    throw new Error("PIN belum diatur untuk pegawai ini. Hubungi Admin/Owner.");
  }
  if (!verifyPin(pin, employee.attendance_pin_hash)) {
    throw new Error("PIN salah.");
  }

  const today = todayJakartaDateString();
  const now = new Date().toISOString();

  if (action === "in") {
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id, clock_in")
      .eq("employee_id", employeeId)
      .eq("attendance_date", today)
      .maybeSingle();

    if (existing?.clock_in) {
      throw new Error(`${employee.full_name} sudah absen masuk hari ini.`);
    }

    const { error } = await supabaseAdmin.from("attendance").upsert(
      {
        business_id: employee.business_id,
        employee_id: employeeId,
        attendance_date: today,
        clock_in: now,
        status: "present",
      },
      { onConflict: "employee_id,attendance_date" }
    );
    if (error) throw new Error(`Gagal mencatat absen masuk: ${error.message}`);
    return { message: `Absen masuk tercatat: ${employee.full_name}`, time: now };
  } else {
    const { data: existing } = await supabaseAdmin
      .from("attendance")
      .select("id, clock_in, clock_out")
      .eq("employee_id", employeeId)
      .eq("attendance_date", today)
      .maybeSingle();

    if (!existing?.clock_in) {
      throw new Error(`${employee.full_name} belum absen masuk hari ini.`);
    }
    if (existing.clock_out) {
      throw new Error(`${employee.full_name} sudah absen pulang hari ini.`);
    }

    const { error } = await supabaseAdmin
      .from("attendance")
      .update({ clock_out: now })
      .eq("id", existing.id);
    if (error) throw new Error(`Gagal mencatat absen pulang: ${error.message}`);
    return { message: `Absen pulang tercatat: ${employee.full_name}`, time: now };
  }
}
