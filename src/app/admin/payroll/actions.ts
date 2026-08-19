"use server";

import { revalidatePath } from "next/cache";
import * as payrollService from "@/services/payrollService";
import * as employeeService from "@/services/employeeService";
import * as operationalExpenseService from "@/services/operationalExpenseService";

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

// ----------------------------------------------------------
// BIAYA OPERASIONAL BULANAN (Listrik, Air, Internet, Kebersihan,
// Cadangan Kebutuhan Sosial, dst — lihat operationalExpenseService)
// ----------------------------------------------------------

export async function createExpenseAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as operationalExpenseService.ExpenseCategory;
  const calcType = String(formData.get("calcType") ?? "fixed") as operationalExpenseService.ExpenseCalcType;
  const value = Number(formData.get("value") ?? 0);
  if (!name) throw new Error("Nama biaya wajib diisi.");
  await operationalExpenseService.createExpense({ name, category, calcType, value });
  revalidatePath("/admin/payroll");
}

export async function updateExpenseValueAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const value = Number(formData.get("value") ?? 0);
  if (!id) throw new Error("Biaya tidak valid.");
  await operationalExpenseService.updateExpenseValue(id, value);
  revalidatePath("/admin/payroll");
}

export async function toggleExpenseAction(id: string, isActive: boolean) {
  await operationalExpenseService.toggleExpenseActive(id, !isActive);
  revalidatePath("/admin/payroll");
}

/** Catat nominal aktual biaya variable_manual (Listrik/Air) untuk 1
 * bulan kalender — lihat operationalExpenseService.recordExpenseEntry. */
export async function recordExpenseEntryAction(formData: FormData) {
  const expenseId = String(formData.get("expenseId") ?? "");
  const periodMonth = String(formData.get("periodMonth") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!expenseId || !periodMonth) throw new Error("Data tidak lengkap.");
  await operationalExpenseService.recordExpenseEntry(expenseId, periodMonth, amount);
  revalidatePath("/admin/payroll");
}

/** Ambil catatan nominal Listrik/Air dkk untuk 1 bulan kalender —
 * dipanggil dari client saat Owner ganti "Bulan Pencatatan" di UI. */
export async function listExpenseEntriesForMonthAction(periodMonth: string) {
  if (!periodMonth) throw new Error("Bulan wajib diisi.");
  return operationalExpenseService.listExpenseEntriesForMonth(periodMonth);
}

/** Total biaya operasional bulan tertentu — dipanggil dari client saat
 * Owner memilih rentang tanggal, supaya Cadangan Kebutuhan Sosial (%
 * dari omset) dihitung untuk bulan yang benar. */
export async function computeMonthlyExpenseTotalAction(periodStart: string, periodEnd: string) {
  if (!periodStart || !periodEnd) throw new Error("Tanggal periode wajib diisi.");
  return operationalExpenseService.computeMonthlyExpenseTotal(periodStart, periodEnd);
}
