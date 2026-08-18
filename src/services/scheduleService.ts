import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const DAY_NAMES_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export type ScheduleEntry = {
  employeeId: string;
  dayOfWeek: number; // 0=Minggu .. 6=Sabtu
  shiftStart: string | null; // "HH:MM"
  shiftEnd: string | null;
  isOff: boolean;
  note?: string;
};

/** Ambil seluruh jadwal kerja mingguan (semua pegawai, 7 hari). */
export async function listSchedule() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employee_schedules")
    .select("id, employee_id, day_of_week, shift_start, shift_end, is_off, note")
    .order("day_of_week");
  if (error) throw new Error(`Gagal memuat jadwal kerja: ${error.message}`);
  return data ?? [];
}

/** Simpan satu entri jadwal (1 pegawai x 1 hari). Dipakai baris per baris
 * dari grid jadwal di halaman admin — upsert supaya aman dipanggil ulang. */
export async function upsertScheduleEntry(entry: ScheduleEntry) {
  const supabase = createSupabaseServerClient();
  const { data: business, error: businessError } = await supabase
    .from("business")
    .select("id")
    .limit(1)
    .single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  const { error } = await supabase.from("employee_schedules").upsert(
    {
      business_id: business.id,
      employee_id: entry.employeeId,
      day_of_week: entry.dayOfWeek,
      shift_start: entry.isOff ? null : entry.shiftStart || null,
      shift_end: entry.isOff ? null : entry.shiftEnd || null,
      is_off: entry.isOff,
      note: entry.note || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "employee_id,day_of_week" }
  );
  if (error) {
    throw new Error(`Gagal menyimpan jadwal (hanya Admin/Owner yang boleh mengubah): ${error.message}`);
  }
}

/** Jadwal kerja untuk 1 pegawai tertentu di hari tertentu (dipakai kiosk
 * absensi untuk menampilkan jam kerja pegawai hari itu, opsional). */
export async function getEmployeeScheduleForDay(employeeId: string, dayOfWeek: number) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("employee_schedules")
    .select("shift_start, shift_end, is_off, note")
    .eq("employee_id", employeeId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();
  return data ?? null;
}
