import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type EmployeeInput = {
  employeeCode: string;
  fullName: string;
  phone?: string;
  positionId?: string | null;
  basicSalary: number;
  joinDate?: string;
  /** 'tetap' (default): digaji bulanan. 'casual': pengganti sementara,
   * diupah harian lewat dailyRate x hari hadir (lihat payrollService). */
  employmentType?: "tetap" | "casual";
  /** Upah per hari (Rp) — hanya dipakai kalau employmentType = 'casual'. */
  dailyRate?: number;
  // --- Data pribadi (opsional, bisa dilengkapi belakangan lewat Edit) ---
  email?: string;
  birthDate?: string | null;
  gender?: "L" | "P" | null;
  idNumber?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

/** Daftar pegawai. Secara default hanya yang belum dihapus (soft-delete
 * lewat deleted_at) yang ditampilkan — lihat deleteEmployee(). Terima
 * filter opsional posisi (untuk dropdown "Filter Jabatan" di halaman
 * Pegawai) supaya pencarian data lebih cepat dari sisi query juga,
 * bukan cuma filter di client. */
export async function listEmployees(params?: { positionId?: string | null }) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("employees")
    .select(
      "id, employee_code, full_name, phone, position_id, basic_salary, employment_type, daily_rate, status, join_date, photo_path, email, birth_date, gender, id_number, address, emergency_contact_name, emergency_contact_phone, employee_positions(name)"
    )
    .is("deleted_at", null)
    .order("full_name");
  if (params?.positionId) {
    query = query.eq("position_id", params.positionId);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Gagal memuat data pegawai: ${error.message}`);

  // Ubah photo_path (path privat di bucket employee-photos) jadi signed URL
  // berumur pendek supaya foto bisa dirender <img> di halaman Pegawai
  // tanpa membuat bucket-nya publik (data pribadi/wajah pegawai).
  const withPhotoUrls = await Promise.all(
    (data ?? []).map(async (emp: any) => ({
      ...emp,
      photo_url: emp.photo_path ? await getEmployeePhotoUrl(emp.photo_path) : null,
    }))
  );
  return withPhotoUrls;
}

/** Daftar jabatan beserta acuan gaji pokok bulanannya (default_basic_salary).
 * Dipakai baik di halaman Pegawai (auto-isi form Tambah Pegawai) maupun
 * halaman Payroll (master "Gaji Pokok per Jabatan"). */
export async function listPositions() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("employee_positions")
    .select("id, name, default_basic_salary")
    .order("name");
  if (error) throw new Error(`Gagal memuat jabatan: ${error.message}`);
  return data ?? [];
}

/** Buat signed URL berumur pendek (1 jam) untuk 1 foto pegawai/absensi di
 * bucket privat employee-photos. Dipakai supabaseAdmin (service role)
 * supaya bisa jalan baik dari halaman admin (sesi staf) maupun dari
 * konteks tanpa sesi (mis. tidak dipakai untuk kiosk, tapi tetap aman
 * dipusatkan di satu tempat). Bucket sengaja PRIVAT (bukan public seperti
 * bucket products) karena berisi data pribadi/wajah pegawai. */
export async function getEmployeePhotoUrl(photoPath: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from("employee-photos")
    .createSignedUrl(photoPath, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/**
 * Upload foto profil pegawai (bukan foto absensi) ke bucket privat
 * employee-photos, lalu simpan PATH-nya (bukan URL) ke employees.photo_path.
 * Memakai sesi staf yang login (bukan admin client) supaya storage policy
 * "employee_photos_admin_insert" (migration 0023, khusus SUPER_ADMIN/OWNER)
 * benar-benar menguji role user yang login — konsisten dengan pola
 * uploadProductImage di catalogService.ts.
 */
export async function uploadEmployeePhoto(employeeId: string, file: File) {
  const supabase = createSupabaseServerClient();

  const maxSizeBytes = 3 * 1024 * 1024; // 3MB
  if (file.size > maxSizeBytes) throw new Error("Ukuran foto maksimal 3MB.");
  if (!file.type.startsWith("image/")) throw new Error("File harus berupa gambar.");

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${employeeId}/profile-${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("employee-photos")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Gagal upload foto pegawai: ${uploadError.message}`);

  const { error: updateError } = await supabase.from("employees").update({ photo_path: path }).eq("id", employeeId);
  if (updateError) throw new Error(`Gagal menyimpan foto pegawai: ${updateError.message}`);

  return getEmployeePhotoUrl(path);
}

export async function createPosition(name: string, defaultBasicSalary: number = 0) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");
  if (defaultBasicSalary < 0) throw new Error("Gaji pokok tidak boleh negatif.");
  const { error } = await supabase
    .from("employee_positions")
    .insert({ business_id: business.id, name, default_basic_salary: defaultBasicSalary });
  if (error) throw new Error(`Gagal menambah jabatan: ${error.message}`);
}

/** Ubah acuan gaji pokok bulanan untuk 1 jabatan. TIDAK mengubah
 * basic_salary pegawai yang sudah ada (supaya tidak tiba-tiba mengubah
 * slip gaji semua orang) — cuma jadi acuan baru untuk pegawai baru /
 * penyesuaian manual berikutnya. */
export async function updatePositionSalary(id: string, defaultBasicSalary: number) {
  if (defaultBasicSalary < 0) throw new Error("Gaji pokok tidak boleh negatif.");
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("employee_positions")
    .update({ default_basic_salary: defaultBasicSalary })
    .eq("id", id);
  if (error) throw new Error(`Gagal memperbarui gaji pokok jabatan: ${error.message}`);
}

export async function createEmployee(input: EmployeeInput) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");
  if (input.basicSalary < 0) throw new Error("Gaji pokok tidak boleh negatif.");
  const employmentType = input.employmentType ?? "tetap";
  const dailyRate = input.dailyRate ?? 0;
  if (dailyRate < 0) throw new Error("Upah harian tidak boleh negatif.");
  if (employmentType === "casual" && dailyRate === 0) {
    throw new Error("Upah harian wajib diisi untuk pegawai Casual.");
  }

  const { error } = await supabase.from("employees").insert({
    business_id: business.id,
    employee_code: input.employeeCode,
    full_name: input.fullName,
    phone: input.phone ?? null,
    position_id: input.positionId ?? null,
    basic_salary: input.basicSalary,
    employment_type: employmentType,
    daily_rate: dailyRate,
    join_date: input.joinDate ?? new Date().toISOString().slice(0, 10),
    email: input.email ?? null,
    birth_date: input.birthDate ?? null,
    gender: input.gender ?? null,
    id_number: input.idNumber ?? null,
    address: input.address ?? null,
    emergency_contact_name: input.emergencyContactName ?? null,
    emergency_contact_phone: input.emergencyContactPhone ?? null,
  });
  if (error) throw new Error(`Gagal menambah pegawai: ${error.message}`);
}

export async function updateEmployee(
  id: string,
  updates: Partial<{
    employeeCode: string;
    fullName: string;
    phone: string;
    positionId: string;
    basicSalary: number;
    employmentType: "tetap" | "casual";
    dailyRate: number;
    email: string;
    birthDate: string | null;
    gender: "L" | "P" | null;
    idNumber: string;
    address: string;
    emergencyContactName: string;
    emergencyContactPhone: string;
  }>
) {
  const supabase = createSupabaseServerClient();
  if (updates.basicSalary !== undefined && updates.basicSalary < 0) {
    throw new Error("Gaji pokok tidak boleh negatif.");
  }
  if (updates.dailyRate !== undefined && updates.dailyRate < 0) {
    throw new Error("Upah harian tidak boleh negatif.");
  }
  if (updates.employeeCode !== undefined && !updates.employeeCode.trim()) {
    throw new Error("Kode pegawai tidak boleh kosong.");
  }
  const { error } = await supabase
    .from("employees")
    .update({
      ...(updates.employeeCode !== undefined && { employee_code: updates.employeeCode.trim() }),
      ...(updates.fullName !== undefined && { full_name: updates.fullName }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.positionId !== undefined && { position_id: updates.positionId }),
      ...(updates.basicSalary !== undefined && { basic_salary: updates.basicSalary }),
      ...(updates.employmentType !== undefined && { employment_type: updates.employmentType }),
      ...(updates.dailyRate !== undefined && { daily_rate: updates.dailyRate }),
      ...(updates.email !== undefined && { email: updates.email }),
      ...(updates.birthDate !== undefined && { birth_date: updates.birthDate }),
      ...(updates.gender !== undefined && { gender: updates.gender }),
      ...(updates.idNumber !== undefined && { id_number: updates.idNumber }),
      ...(updates.address !== undefined && { address: updates.address }),
      ...(updates.emergencyContactName !== undefined && { emergency_contact_name: updates.emergencyContactName }),
      ...(updates.emergencyContactPhone !== undefined && { emergency_contact_phone: updates.emergencyContactPhone }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    // Kode pegawai punya UNIQUE constraint per business — beri pesan yang
    // jelas kalau Admin memasukkan kode yang sudah dipakai pegawai lain.
    if (error.code === "23505") {
      throw new Error("Kode pegawai sudah dipakai pegawai lain. Gunakan kode yang berbeda.");
    }
    throw new Error(`Gagal memperbarui pegawai: ${error.message}`);
  }
}

export async function setEmployeeStatus(id: string, status: "active" | "inactive" | "resigned") {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("employees").update({ status }).eq("id", id);
  if (error) throw new Error(`Gagal mengubah status pegawai: ${error.message}`);
}

/**
 * Hapus data pegawai dari daftar. Selalu SOFT DELETE (isi deleted_at +
 * status 'resigned'), TIDAK PERNAH hard-delete baris employees — karena
 * riwayat absensi, jadwal, dan slip gaji pegawai ini tetap harus valid
 * secara historis (prinsip Financial/Record Integrity yang dipakai di
 * seluruh aplikasi ini, sama seperti produk yang pernah dipesan tidak
 * pernah benar-benar dihapus, hanya dinonaktifkan). Pegawai yang
 * dihapus otomatis hilang dari listEmployees() dan jadwal kerja.
 */
export async function deleteEmployee(id: string) {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("employees")
    .update({ deleted_at: new Date().toISOString(), status: "resigned" })
    .eq("id", id);
  if (error) throw new Error(`Gagal menghapus pegawai: ${error.message}`);
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
    .select(
      "id, employee_id, clock_in, clock_out, status, notes, late_minutes, clock_in_photo_path, clock_out_photo_path, employees(full_name, employee_code)"
    )
    .eq("attendance_date", date);
  if (error) throw new Error(`Gagal memuat absensi: ${error.message}`);

  // Sama seperti listEmployees: ubah path privat jadi signed URL supaya
  // Admin/Owner bisa lihat foto absensi untuk verifikasi MANUAL (bukan
  // pencocokan wajah otomatis/AI — lihat komentar migration 0023).
  const withPhotoUrls = await Promise.all(
    (data ?? []).map(async (row: any) => ({
      ...row,
      clock_in_photo_url: row.clock_in_photo_path ? await getEmployeePhotoUrl(row.clock_in_photo_path) : null,
      clock_out_photo_url: row.clock_out_photo_path ? await getEmployeePhotoUrl(row.clock_out_photo_path) : null,
    }))
  );
  return withPhotoUrls;
}

/** Ringkasan absensi utk rentang tanggal (dipakai halaman Jadwal Shift
 * supaya Admin/Captain/Owner bisa lihat siapa yang ijin/sakit/terlambat
 * minggu ini berdampingan dengan jadwal shift-nya, tanpa perlu pindah ke
 * halaman Absensi terpisah). Hanya status selain 'present' yang relevan
 * ditampilkan sebagai sorotan, tapi query mengembalikan semua supaya
 * pemanggil bisa filter sesuai kebutuhan. */
export async function listAttendanceForRange(startDate: string, endDate: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("attendance")
    .select("id, employee_id, attendance_date, status, late_minutes, notes, employees(full_name, employee_code)")
    .gte("attendance_date", startDate)
    .lte("attendance_date", endDate)
    .order("attendance_date", { ascending: false });
  if (error) throw new Error(`Gagal memuat ringkasan absensi: ${error.message}`);
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
  status: "present" | "late" | "absent" | "leave" | "sick" | "early_leave";
  notes?: string;
  /** Menit keterlambatan — hanya relevan saat status='late'. Dipakai
   * payroll untuk potongan Rp5.000 per akumulasi 60 menit. */
  lateMinutes?: number;
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
      late_minutes: input.status === "late" ? Math.max(0, input.lateMinutes ?? 0) : 0,
    },
    { onConflict: "employee_id,attendance_date" }
  );
  if (error) throw new Error(`Gagal mencatat absensi: ${error.message}`);
}
