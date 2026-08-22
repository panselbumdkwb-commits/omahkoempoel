"use server";

import { revalidatePath } from "next/cache";
import * as payrollService from "@/services/payrollService";
import * as employeeService from "@/services/employeeService";

export async function createComponentAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const componentType = String(formData.get("componentType") ?? "earning") as "earning" | "deduction";
  const calcType = String(formData.get("calcType") ?? "fixed") as payrollService.PayrollCalcType;
  const value = Number(formData.get("value") ?? 0);
  const capBaseRaw = String(formData.get("capBase") ?? "");
  const capBase = capBaseRaw ? Number(capBaseRaw) : null;

  if (!name) throw new Error("Nama komponen wajib diisi.");

  await payrollService.createComponent({ name, componentType, calcType, value, capBase });
  revalidatePath("/admin/payroll");
}

export async function toggleComponentAction(id: string, isActive: boolean) {
  await payrollService.toggleComponentActive(id, !isActive);
  revalidatePath("/admin/payroll");
}

export async function runPayrollAction(formData: FormData) {
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  if (!periodStart || !periodEnd) throw new Error("Tanggal periode wajib diisi.");

  const period = await payrollService.runPayroll(periodStart, periodEnd);
  revalidatePath("/admin/payroll");
  return period;
}

export async function listPayrollItemsAction(periodId: string) {
  return payrollService.listPayrollItems(periodId);
}

export async function approvePayrollPeriodAction(periodId: string) {
  await payrollService.approvePayrollPeriod(periodId);
  revalidatePath("/admin/payroll");
}

/** Ubah acuan gaji pokok bulanan 1 jabatan langsung dari halaman Payroll
 * (data yang sama dengan halaman Pegawai — lihat employeeService). */
export async function updatePositionSalaryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const defaultBasicSalary = Number(formData.get("defaultBasicSalary") ?? 0);
  if (!id) throw new Error("Jabatan tidak valid.");
  await employeeService.updatePositionSalary(id, defaultBasicSalary);
  revalidatePath("/admin/payroll");
  revalidatePath("/admin/employees");
}

// Catatan: pengelolaan Biaya Operasional & Non-Operasional (listrik,
// air, internet, dll) TIDAK lagi ada di halaman Payroll — sudah
// dipindahkan ke halaman Laporan (app/admin/reports/actions.ts &
// OperationalExpensesPanel.tsx), karena menu Payroll hanya untuk
// pengupahan pegawai, sementara biaya-biaya itu adalah bagian dari
// Laporan Laba Rugi.
