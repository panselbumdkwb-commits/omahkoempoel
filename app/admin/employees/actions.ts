"use server";

import { revalidatePath } from "next/cache";
import * as employeeService from "@/services/employeeService";

export async function createPositionAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const defaultBasicSalary = Number(formData.get("defaultBasicSalary") ?? 0);
  if (!name) throw new Error("Nama jabatan wajib diisi.");
  await employeeService.createPosition(name, defaultBasicSalary);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/payroll");
}

/** Ubah acuan gaji pokok bulanan 1 jabatan (dipakai dari halaman Pegawai
 * maupun halaman Payroll — keduanya menulis ke tabel employee_positions
 * yang sama). */
export async function updatePositionSalaryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const defaultBasicSalary = Number(formData.get("defaultBasicSalary") ?? 0);
  if (!id) throw new Error("Jabatan tidak valid.");
  await employeeService.updatePositionSalary(id, defaultBasicSalary);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/payroll");
}

export async function createEmployeeAction(formData: FormData) {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const positionId = String(formData.get("positionId") ?? "");
  const basicSalary = Number(formData.get("basicSalary") ?? 0);
  const employmentType = String(formData.get("employmentType") ?? "tetap") as "tetap" | "casual";
  const dailyRate = Number(formData.get("dailyRate") ?? 0);
  const email = String(formData.get("email") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const idNumber = String(formData.get("idNumber") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const emergencyContactName = String(formData.get("emergencyContactName") ?? "").trim();
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") ?? "").trim();

  if (!employeeCode || !fullName) throw new Error("Kode pegawai dan nama wajib diisi.");

  await employeeService.createEmployee({
    employeeCode,
    fullName,
    phone,
    positionId: positionId || null,
    basicSalary,
    employmentType,
    dailyRate,
    email: email || undefined,
    birthDate: birthDate || null,
    gender: gender === "L" || gender === "P" ? gender : null,
    idNumber: idNumber || undefined,
    address: address || undefined,
    emergencyContactName: emergencyContactName || undefined,
    emergencyContactPhone: emergencyContactPhone || undefined,
  });
  revalidatePath("/admin/employees");
}

export async function updateEmployeeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const positionId = String(formData.get("positionId") ?? "");
  const basicSalary = Number(formData.get("basicSalary") ?? 0);
  const employmentType = String(formData.get("employmentType") ?? "tetap") as "tetap" | "casual";
  const dailyRate = Number(formData.get("dailyRate") ?? 0);
  const email = String(formData.get("email") ?? "").trim();
  const birthDate = String(formData.get("birthDate") ?? "").trim();
  const gender = String(formData.get("gender") ?? "").trim();
  const idNumber = String(formData.get("idNumber") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const emergencyContactName = String(formData.get("emergencyContactName") ?? "").trim();
  const emergencyContactPhone = String(formData.get("emergencyContactPhone") ?? "").trim();

  if (!id) throw new Error("ID pegawai tidak valid.");
  if (!employeeCode) throw new Error("Kode pegawai wajib diisi.");
  await employeeService.updateEmployee(id, {
    employeeCode,
    fullName,
    phone,
    positionId,
    basicSalary,
    employmentType,
    dailyRate,
    email,
    birthDate: birthDate || null,
    gender: gender === "L" || gender === "P" ? gender : null,
    idNumber,
    address,
    emergencyContactName,
    emergencyContactPhone,
  });
  revalidatePath("/admin/employees");
}

/** Upload/ganti foto profil pegawai — hanya SUPER_ADMIN/OWNER (ditegakkan
 * RLS storage bucket employee-photos, migration 0023). */
export async function uploadEmployeePhotoAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const file = formData.get("photo") as File | null;
  if (!id) throw new Error("ID pegawai tidak valid.");
  if (!file || file.size === 0) throw new Error("Pilih file foto dulu.");
  await employeeService.uploadEmployeePhoto(id, file);
  revalidatePath("/admin/employees");
}

export async function toggleEmployeeStatusAction(id: string, currentStatus: string) {
  const next = currentStatus === "active" ? "inactive" : "active";
  await employeeService.setEmployeeStatus(id, next as "active" | "inactive");
  revalidatePath("/admin/employees");
}

/** Hapus data pegawai (soft-delete — lihat employeeService.deleteEmployee).
 * Hanya boleh dipanggil oleh Owner/Admin, ditegakkan oleh RLS di database. */
export async function deleteEmployeeAction(id: string) {
  if (!id) throw new Error("ID pegawai tidak valid.");
  await employeeService.deleteEmployee(id);
  revalidatePath("/admin/employees");
  revalidatePath("/admin/schedule");
}

export async function setEmployeePinAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const pin = String(formData.get("pin") ?? "");
  if (!id) throw new Error("ID pegawai tidak valid.");
  await employeeService.setEmployeePin(id, pin);
  revalidatePath("/admin/employees");
}

/** Buat/reset username + password login Absen Mandiri (HP pribadi) —
 * dipakai kalau pegawai lupa password, ganti HP, atau HP-nya hilang
 * (reset ini juga mencabut semua sesi lama, lihat
 * employeeService.setEmployeeMobileLogin). */
export async function setEmployeeMobileLoginAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const username = String(formData.get("mobileUsername") ?? "");
  const password = String(formData.get("mobilePassword") ?? "");
  if (!id) throw new Error("ID pegawai tidak valid.");
  await employeeService.setEmployeeMobileLogin(id, username, password);
  revalidatePath("/admin/employees");
}
export async function recordAttendanceAction(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  const date = String(formData.get("date") ?? "");
  const status = String(formData.get("status") ?? "present") as any;
  const clockIn = String(formData.get("clockIn") ?? "");
  const clockOut = String(formData.get("clockOut") ?? "");
  const lateMinutes = Number(formData.get("lateMinutes") ?? 0);

  if (!employeeId || !date) throw new Error("Pegawai dan tanggal wajib diisi.");

  await employeeService.recordAttendance({
    employeeId,
    date,
    status,
    clockIn: clockIn ? new Date(`${date}T${clockIn}:00`).toISOString() : null,
    clockOut: clockOut ? new Date(`${date}T${clockOut}:00`).toISOString() : null,
    lateMinutes: Number.isFinite(lateMinutes) ? lateMinutes : 0,
  });
  revalidatePath("/admin/attendance");
}

/** Ambil daftar absensi untuk 1 tanggal — dipakai halaman Absensi
 * Pegawai supaya Admin/Owner/Captain bisa pindah tanggal (hari
 * sebelumnya/berikutnya, atau pilih tanggal langsung) tanpa reload
 * halaman penuh. */
export async function getAttendanceByDateAction(date: string) {
  if (!date) throw new Error("Tanggal wajib diisi.");
  return employeeService.listAttendanceByDate(date);
}
