"use server";

import { revalidatePath } from "next/cache";
import { getSalesReport, getFinancialStatement } from "@/services/reportService";
import * as operationalExpenseService from "@/services/operationalExpenseService";

export async function getSalesReportAction(startISO: string, endISO: string) {
  return getSalesReport(startISO, endISO);
}

export async function getFinancialStatementAction(startISO: string, endISO: string) {
  return getFinancialStatement(startISO, endISO);
}

// ----------------------------------------------------------
// BIAYA OPERASIONAL BULANAN (Listrik, Air, Internet, Kebersihan,
// Cadangan Kebutuhan Sosial, dst — lihat operationalExpenseService).
// Dipindahkan dari halaman Payroll ke halaman Laporan supaya menu
// Payroll HANYA mencatat pengupahan pegawai (sesuai standar akuntansi:
// biaya operasional & non-operasional adalah bagian dari Laporan
// Laba Rugi, bukan sistem pengupahan).
// ----------------------------------------------------------

export async function createExpenseAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "other") as operationalExpenseService.ExpenseCategory;
  const calcType = String(formData.get("calcType") ?? "fixed") as operationalExpenseService.ExpenseCalcType;
  const expenseType = String(formData.get("expenseType") ?? "operational") as operationalExpenseService.ExpenseType;
  const value = Number(formData.get("value") ?? 0);
  if (!name) throw new Error("Nama biaya wajib diisi.");
  await operationalExpenseService.createExpense({ name, category, calcType, value, expenseType });
  revalidatePath("/admin/reports");
}

/** Ubah klasifikasi Operasional/Non-Operasional 1 biaya — dipakai
 * Laporan Laba Rugi supaya pemisahan biayanya sesuai keputusan Owner
 * (mis. bunga bank/penyusutan = non-operasional). */
export async function updateExpenseTypeAction(id: string, expenseType: operationalExpenseService.ExpenseType) {
  if (!id) throw new Error("Biaya tidak valid.");
  await operationalExpenseService.updateExpenseType(id, expenseType);
  revalidatePath("/admin/reports");
}

export async function updateExpenseValueAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const value = Number(formData.get("value") ?? 0);
  if (!id) throw new Error("Biaya tidak valid.");
  await operationalExpenseService.updateExpenseValue(id, value);
  revalidatePath("/admin/reports");
}

export async function toggleExpenseAction(id: string, isActive: boolean) {
  await operationalExpenseService.toggleExpenseActive(id, !isActive);
  revalidatePath("/admin/reports");
}

/** Catat nominal aktual biaya variable_manual (Listrik/Air) untuk 1
 * bulan kalender — lihat operationalExpenseService.recordExpenseEntry. */
export async function recordExpenseEntryAction(formData: FormData) {
  const expenseId = String(formData.get("expenseId") ?? "");
  const periodMonth = String(formData.get("periodMonth") ?? "");
  const amount = Number(formData.get("amount") ?? 0);
  if (!expenseId || !periodMonth) throw new Error("Data tidak lengkap.");
  await operationalExpenseService.recordExpenseEntry(expenseId, periodMonth, amount);
  revalidatePath("/admin/reports");
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
