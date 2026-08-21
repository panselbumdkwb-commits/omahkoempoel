import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { classifyPosition } from "@/lib/positionMatch";

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

// ===================================================================
// GENERATE JADWAL SHIFT OTOMATIS
//
// Aturan (sesuai kebijakan Owner):
// - Setiap shift operasional (Pagi & Sore) harus tercakup oleh Kasir,
//   Bar, Kitchen, dan Waitres. Kasir hanya 1 pegawai per shift, tapi
//   di-backup oleh Kapten saat kasir libur.
// - Kapten bekerja fleksibel TANPA jam kerja tetap (siap siaga /
//   backup), tidak dijadwalkan ke shift manapun.
// - Sekuriti hanya bertugas di Shift Malam, tidak di shift lain.
// - 6 hari kerja, 1 hari libur/minggu. Libur TIDAK PERNAH jatuh di
//   akhir pekan (Sabtu/Minggu) — hanya di Senin–Jumat — dan digilir
//   (staggered) antar pegawai dalam jabatan yang sama supaya jabatan
//   itu tetap ada yang masuk kerja setiap hari, termasuk weekend.
//
// Catatan desain: tabel employee_schedules menyimpan pola MINGGUAN yang
// berulang (1 baris per pegawai per hari-dalam-minggu), bukan per
// tanggal kalender. Jadi "gantian" di sini berarti pegawai yang berbeda
// mendapat hari libur yang berbeda dalam seminggu (roster tetap tiap
// minggu) — bukan hari libur yang berpindah-pindah tanggal tiap minggu.
// Ini konsisten dengan desain jadwal yang sudah ada di halaman ini.
// ===================================================================

const WEEKDAY_OFF_POOL = [1, 2, 3, 4, 5]; // Senin..Jumat (day_of_week)
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]; // Minggu..Sabtu

const SHIFT_PAGI = { start: "09:00", end: "17:00", label: "Shift Pagi" };
const SHIFT_SORE = { start: "16:00", end: "00:00", label: "Shift Sore" };
const SHIFT_MALAM = { start: "23:00", end: "07:00", label: "Shift Malam (Sekuriti)" };
const SHIFT_KASIR = { start: "09:00", end: "21:00", label: "Shift Kasir (Penuh)" };

export type GenerateScheduleResult = {
  entriesWritten: number;
  warnings: string[];
  summary: { position: string; employeeCount: number; note: string }[];
};

/**
 * Menyusun ulang seluruh jadwal shift mingguan secara otomatis dari
 * daftar pegawai aktif & jabatannya saat ini. MENIMPA jadwal lama untuk
 * semua pegawai yang ikut diproses (kasir/bar/kitchen/waitres/kapten/
 * sekuriti) — pegawai dengan jabatan lain ("other") tidak disentuh dan
 * tetap bisa diatur manual seperti biasa.
 */
export async function generateAutoSchedule(): Promise<GenerateScheduleResult> {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, full_name, employee_code, status, employee_positions(name)")
    .eq("status", "active")
    .is("deleted_at", null);
  if (error) throw new Error(`Gagal memuat pegawai: ${error.message}`);

  const groups: Record<string, { id: string; name: string }[]> = {
    kasir: [],
    bar: [],
    kitchen: [],
    waitress: [],
    kapten: [],
    sekuriti: [],
  };

  for (const emp of employees ?? []) {
    const posRaw = (emp as any).employee_positions;
    const posName: string | null = Array.isArray(posRaw) ? posRaw[0]?.name ?? null : posRaw?.name ?? null;
    const key = classifyPosition(posName);
    if (key === "other") continue;
    groups[key].push({ id: emp.id, name: emp.full_name ?? emp.employee_code });
  }

  const warnings: string[] = [];
  const summary: GenerateScheduleResult["summary"] = [];
  const entries: ScheduleEntry[] = [];

  // Kasir: hanya 1 pegawai idealnya, di-backup Kapten saat libur.
  let kasirOffDay: number | null = null;
  if (groups.kasir.length === 0) {
    warnings.push("Belum ada pegawai dengan jabatan Kasir — shift Kasir tidak dijadwalkan.");
  } else {
    if (groups.kasir.length > 1) {
      warnings.push(
        `Ditemukan ${groups.kasir.length} pegawai Kasir — idealnya hanya 1 orang/shift (sisanya bisa dijadikan Waitres/Bar cadangan).`
      );
    }
    groups.kasir.forEach((emp, i) => {
      const offDay = WEEKDAY_OFF_POOL[i % WEEKDAY_OFF_POOL.length];
      if (i === 0) kasirOffDay = offDay;
      for (const day of ALL_DAYS) {
        if (day === offDay) {
          entries.push({ employeeId: emp.id, dayOfWeek: day, shiftStart: null, shiftEnd: null, isOff: true, note: "Libur" });
        } else {
          entries.push({
            employeeId: emp.id,
            dayOfWeek: day,
            shiftStart: SHIFT_KASIR.start,
            shiftEnd: SHIFT_KASIR.end,
            isOff: false,
            note: SHIFT_KASIR.label,
          });
        }
      }
    });
    summary.push({ position: "Kasir", employeeCount: groups.kasir.length, note: "1 shift penuh/hari, libur bergantian Senin–Jumat" });
  }

  // Bar, Kitchen, Waitres: sebar ke Shift Pagi & Shift Sore, staggered
  // day-off supaya tiap jabatan selalu ada yang masuk tiap hari.
  const rotatingGroups: { key: "bar" | "kitchen" | "waitress"; label: string }[] = [
    { key: "bar", label: "Bar" },
    { key: "kitchen", label: "Kitchen" },
    { key: "waitress", label: "Waitres" },
  ];
  rotatingGroups.forEach((g, groupIdx) => {
    const members = groups[g.key];
    if (members.length === 0) {
      warnings.push(`Belum ada pegawai dengan jabatan ${g.label} — shift ${g.label} tidak dijadwalkan.`);
      return;
    }
    members.forEach((emp, i) => {
      const offDay = WEEKDAY_OFF_POOL[(i + groupIdx) % WEEKDAY_OFF_POOL.length];
      const shift = i % 2 === 0 ? SHIFT_PAGI : SHIFT_SORE;
      for (const day of ALL_DAYS) {
        if (day === offDay) {
          entries.push({ employeeId: emp.id, dayOfWeek: day, shiftStart: null, shiftEnd: null, isOff: true, note: "Libur" });
        } else {
          entries.push({
            employeeId: emp.id,
            dayOfWeek: day,
            shiftStart: shift.start,
            shiftEnd: shift.end,
            isOff: false,
            note: `${shift.label} — ${g.label}`,
          });
        }
      }
    });
    if (members.length === 1) {
      warnings.push(`Jabatan ${g.label} hanya 1 pegawai — saat libur, ${g.label} tidak ada yang menggantikan (pertimbangkan tambah pegawai).`);
    }
    summary.push({ position: g.label, employeeCount: members.length, note: "Bergantian Shift Pagi/Sore, libur bergantian Senin–Jumat" });
  });

  // Sekuriti: khusus Shift Malam setiap hari kerja, libur bergantian.
  if (groups.sekuriti.length === 0) {
    warnings.push("Belum ada pegawai dengan jabatan Sekuriti — Shift Malam tidak dijadwalkan.");
  } else {
    groups.sekuriti.forEach((emp, i) => {
      const offDay = WEEKDAY_OFF_POOL[i % WEEKDAY_OFF_POOL.length];
      for (const day of ALL_DAYS) {
        if (day === offDay) {
          entries.push({ employeeId: emp.id, dayOfWeek: day, shiftStart: null, shiftEnd: null, isOff: true, note: "Libur" });
        } else {
          entries.push({
            employeeId: emp.id,
            dayOfWeek: day,
            shiftStart: SHIFT_MALAM.start,
            shiftEnd: SHIFT_MALAM.end,
            isOff: false,
            note: SHIFT_MALAM.label,
          });
        }
      }
    });
    summary.push({ position: "Sekuriti", employeeCount: groups.sekuriti.length, note: "Selalu Shift Malam, libur bergantian Senin–Jumat" });
  }

  // Kapten: fleksibel, tanpa jam tetap — tidak dijadwalkan shift apa pun.
  // Kalau Kasir cuma 1 orang, tandai hari libur kasir sebagai hari backup.
  if (groups.kapten.length === 0) {
    if (groups.kasir.length === 1) {
      warnings.push("Belum ada pegawai Kapten — tidak ada backup otomatis saat Kasir libur. Pastikan ada staf lain yang bisa menggantikan sementara.");
    }
  } else {
    groups.kapten.forEach((emp) => {
      for (const day of ALL_DAYS) {
        const isBackupDay = groups.kasir.length === 1 && day === kasirOffDay;
        entries.push({
          employeeId: emp.id,
          dayOfWeek: day,
          shiftStart: null,
          shiftEnd: null,
          isOff: false,
          note: isBackupDay ? "Fleksibel — Backup Kasir (kasir libur)" : "Fleksibel — Siap Siaga",
        });
      }
    });
    summary.push({ position: "Kapten", employeeCount: groups.kapten.length, note: "Tanpa jam kerja tetap, standby & backup Kasir" });
  }

  for (const entry of entries) {
    await upsertScheduleEntry(entry);
  }

  return { entriesWritten: entries.length, warnings, summary };
}
