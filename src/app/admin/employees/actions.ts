"use server";

import { revalidatePath } from "next/cache";
import * as employeeService from "@/services/employeeService";

export async function createPositionAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Nama jabatan wajib diisi.");
  await employeeService.createPosition(name);
  revalidatePath("/admin/employees");
}

export async function createEmployeeAction(formData: FormData) {
  const employeeCode = String(formData.get("employeeCode") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const positionId = String(formData.get("positionId") ?? "");
  const basicSalary = Number(formData.get("basicSalary") ?? 0);

  if (!employeeCode || !fullName) throw new Error("Kode pegawai dan nama wajib diisi.");

  await employeeService.createEmployee({
    employeeCode,
    fullName,
    phone,
    positionId: positionId || null,
    basicSalary,
  });
  revalidatePath("/admin/employees");
}

export async function updateEmployeeAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const positionId = String(formData.get("positionId") ?? "");
  const basicSalary = Number(formData.get("basicSalary") ?? 0);

  if (!id) throw new Error("ID pegawai tidak valid.");
  await employeeService.updateEmployee(id, { fullName, phone, positionId, basicSalary });
  revalidatePath("/admin/employees");
}

export async function toggleEmployeeStatusAction(id: string, currentStatus: string) {
  const next = currentStatus === "active" ? "inactive" : "active";
  await employeeService.setEmployeeStatus(id, next as "active" | "inactive");
  revalidatePath("/admin/employees");
}

export async function recordAttendanceAction(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  const date = String(formData.get("date") ?? "");
  const status = String(formData.get("status") ?? "present") as any;
  const clockIn = String(formData.get("clockIn") ?? "");
  const clockOut = String(formData.get("clockOut") ?? "");

  if (!employeeId || !date) throw new Error("Pegawai dan tanggal wajib diisi.");

  await employeeService.recordAttendance({
    employeeId,
    date,
    status,
    clockIn: clockIn ? new Date(`${date}T${clockIn}:00`).toISOString() : null,
    clockOut: clockOut ? new Date(`${date}T${clockOut}:00`).toISOString() : null,
  });
  revalidatePath("/admin/attendance");
}
