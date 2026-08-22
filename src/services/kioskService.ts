import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPin } from "@/lib/pin";
import { getJakartaTodayRange, getJakartaDayOfWeek } from "@/lib/timezone";

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
 * Unggah foto selfie absensi (base64 data URL dari kamera kios/HP) ke
 * bucket privat employee-photos, lewat supabaseAdmin (service role)
 * karena kiosk/absen mandiri tidak punya sesi login staf. Foto ini
 * HANYA untuk verifikasi MANUAL oleh Admin/Owner di halaman Absensi —
 * TIDAK ada pencocokan wajah otomatis/AI di sistem ini (lihat komentar
 * migration 0023 & catatan privasi Bagian 31 master prompt).
 */
async function uploadAttendanceSelfie(
  employeeId: string,
  photoDataUrl: string,
  moment: "in" | "out"
): Promise<string | null> {
  try {
    const match = /^data:(image\/\w+);base64,(.+)$/.exec(photoDataUrl);
    if (!match) return null;
    const [, mimeType, base64] = match;
    const maxSizeBytes = 2 * 1024 * 1024; // 2MB cukup untuk selfie verifikasi
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > maxSizeBytes) return null; // diam-diam lewati, jangan gagalkan absensi

    const ext = mimeType.split("/")[1] ?? "jpg";
    const path = `${employeeId}/attendance-${moment}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("employee-photos")
      .upload(path, buffer, { contentType: mimeType, upsert: true });
    if (error) return null;
    return path;
  } catch {
    // Foto absensi bersifat pelengkap verifikasi manual, bukan syarat
    // wajib — kalau gagal upload, absensi tetap tercatat tanpa foto.
    return null;
  }
}

/** Jadwal kerja pegawai HARI INI (dipakai di layar kiosk absensi supaya
 * pegawai tahu jam kerjanya sebelum absen masuk/pulang). Lewat admin
 * client karena kiosk tidak punya sesi login. */
export async function getTodayScheduleForEmployee(employeeId: string) {
  const dayOfWeek = getJakartaDayOfWeek();
  const { data } = await supabaseAdmin
    .from("employee_schedules")
    .select("shift_start, shift_end, is_off")
    .eq("employee_id", employeeId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();
  return data ?? null;
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
  action: "in" | "out",
  photoDataUrl?: string | null
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
  const photoPath = photoDataUrl ? await uploadAttendanceSelfie(employeeId, photoDataUrl, action) : null;

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
        ...(photoPath && { clock_in_photo_path: photoPath }),
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
      .update({ clock_out: now, ...(photoPath && { clock_out_photo_path: photoPath }) })
      .eq("id", existing.id);
    if (error) throw new Error(`Gagal mencatat absen pulang: ${error.message}`);
    return { message: `Absen pulang tercatat: ${employee.full_name}`, time: now };
  }
}
