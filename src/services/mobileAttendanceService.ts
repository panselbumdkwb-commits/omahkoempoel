import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyPin } from "@/lib/pin";
import { getJakartaTodayRange } from "@/lib/timezone";

const GEOFENCE_RADIUS_METERS = 10;

function todayJakartaDateString(): string {
  const { startUTC } = getJakartaTodayRange();
  const shifted = new Date(startUTC.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Jarak antara 2 koordinat (meter), rumus Haversine. */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Unggah foto selfie absensi (base64 data URL dari kamera HP) ke bucket
 * privat employee-photos. Sama seperti kioskService.ts — HANYA untuk
 * verifikasi MANUAL oleh Admin/Owner, bukan pencocokan wajah otomatis.
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
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > 2 * 1024 * 1024) return null;

    const ext = mimeType.split("/")[1] ?? "jpg";
    const path = `${employeeId}/attendance-${moment}-${Date.now()}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("employee-photos")
      .upload(path, buffer, { contentType: mimeType, upsert: true });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

/** Pegawai yang sudah terverifikasi (attendance_pin_hash terisi) —
 * dipakai di dropdown halaman absen mandiri lewat HP pribadi. */
export async function listVerifiedMobileEmployees() {
  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name")
    .eq("status", "active")
    .not("attendance_pin_hash", "is", null)
    .order("full_name");
  if (error) throw new Error("Gagal memuat daftar pegawai.");
  return data ?? [];
}

/**
 * Absen masuk/pulang lewat HP pribadi pegawai. WAJIB berada dalam
 * radius 10 meter dari lokasi Kedai (business.latitude/longitude,
 * diisi Super Admin di halaman Pengaturan) — beda dengan kios yang
 * tidak butuh cek lokasi karena perangkatnya memang sudah di Kedai.
 */
export async function mobileClockAttendance(
  employeeId: string,
  pin: string,
  action: "in" | "out",
  location: { lat: number; lng: number },
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
    throw new Error("Akun belum terverifikasi. Selesaikan pendaftaran & tunggu verifikasi Captain/Admin/Owner.");
  }
  if (!verifyPin(pin, employee.attendance_pin_hash)) {
    throw new Error("PIN salah.");
  }

  const { data: business } = await supabaseAdmin
    .from("business")
    .select("latitude, longitude")
    .eq("id", employee.business_id)
    .single();
  if (!business?.latitude || !business?.longitude) {
    throw new Error("Lokasi Kedai belum diatur oleh Super Admin. Absen lewat HP pribadi belum bisa dipakai — silakan absen lewat kios di Kedai.");
  }
  const distance = distanceMeters(business.latitude, business.longitude, location.lat, location.lng);
  if (distance > GEOFENCE_RADIUS_METERS) {
    throw new Error(
      `Kamu berada ${distance.toFixed(0)} meter dari Kedai — absen masuk/pulang lewat HP hanya bisa dilakukan dalam radius ${GEOFENCE_RADIUS_METERS} meter. Gunakan kios di Kedai kalau kamu sedang tidak di lokasi.`
    );
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
    if (existing?.clock_in) throw new Error(`${employee.full_name} sudah absen masuk hari ini.`);

    const { error } = await supabaseAdmin.from("attendance").upsert(
      {
        business_id: employee.business_id,
        employee_id: employeeId,
        attendance_date: today,
        clock_in: now,
        status: "present",
        source: "mobile",
        clock_in_lat: location.lat,
        clock_in_lng: location.lng,
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
    if (!existing?.clock_in) throw new Error(`${employee.full_name} belum absen masuk hari ini.`);
    if (existing.clock_out) throw new Error(`${employee.full_name} sudah absen pulang hari ini.`);

    const { error } = await supabaseAdmin
      .from("attendance")
      .update({
        clock_out: now,
        clock_out_lat: location.lat,
        clock_out_lng: location.lng,
        ...(photoPath && { clock_out_photo_path: photoPath }),
      })
      .eq("id", existing.id);
    if (error) throw new Error(`Gagal mencatat absen pulang: ${error.message}`);
    return { message: `Absen pulang tercatat: ${employee.full_name}`, time: now };
  }
}

/** Pengajuan izin/tidak masuk — boleh dilakukan dari mana saja (TIDAK
 * ada validasi lokasi), berbeda dengan absen masuk. */
export async function submitLeaveRequest(employeeId: string, pin: string, reason: string) {
  if (!reason.trim()) throw new Error("Alasan izin wajib diisi.");
  const { data: employee, error: empError } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, attendance_pin_hash, business_id, status")
    .eq("id", employeeId)
    .single();
  if (empError || !employee) throw new Error("Pegawai tidak ditemukan.");
  if (employee.status !== "active") throw new Error("Akun pegawai ini tidak aktif.");
  if (!employee.attendance_pin_hash) {
    throw new Error("Akun belum terverifikasi. Selesaikan pendaftaran & tunggu verifikasi Captain/Admin/Owner.");
  }
  if (!verifyPin(pin, employee.attendance_pin_hash)) throw new Error("PIN salah.");

  const today = todayJakartaDateString();
  const { data: existing } = await supabaseAdmin
    .from("attendance")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("attendance_date", today)
    .maybeSingle();
  if (existing) throw new Error(`${employee.full_name} sudah tercatat absen hari ini, tidak bisa mengajukan izin lagi.`);

  const { error } = await supabaseAdmin.from("attendance").insert({
    business_id: employee.business_id,
    employee_id: employeeId,
    attendance_date: today,
    status: "leave",
    source: "mobile",
    notes: reason.trim(),
  });
  if (error) throw new Error(`Gagal mengajukan izin: ${error.message}`);
  return { message: `Pengajuan izin tercatat: ${employee.full_name}` };
}
