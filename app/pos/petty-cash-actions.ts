"use server";

import { revalidatePath } from "next/cache";
import * as pettyCashService from "@/services/pettyCashService";
import { getPettyCashDefaultAmount } from "@/services/settingsService";

export async function getPettyCashSummaryAction(cashDate?: string) {
  return pettyCashService.getPettyCashSummary(cashDate);
}

export async function getPettyCashDefaultAmountAction() {
  return getPettyCashDefaultAmount();
}

/** Buka Kas Kecil Harian dengan nominal awal — RLS di DB memastikan ini
 * hanya benar-benar berhasil untuk SUPER_ADMIN/OWNER, walau tombolnya
 * juga disembunyikan di UI untuk role lain. */
export async function openPettyCashDayAction(openingAmount: number, notes?: string) {
  await pettyCashService.openPettyCashDay({ openingAmount, notes });
  revalidatePath("/pos");
}

export async function recordPettyCashUsageAction(pettyCashDayId: string, description: string, amount: number) {
  await pettyCashService.recordPettyCashUsage({ pettyCashDayId, description, amount });
  revalidatePath("/pos");
}

export async function closePettyCashDayAction(pettyCashDayId: string, closingAmount: number, notes?: string) {
  await pettyCashService.closePettyCashDay({ pettyCashDayId, closingAmount, notes });
  revalidatePath("/pos");
}
