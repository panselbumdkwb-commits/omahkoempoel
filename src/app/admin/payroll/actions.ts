"use server";

import { revalidatePath } from "next/cache";
import * as payrollService from "@/services/payrollService";

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
