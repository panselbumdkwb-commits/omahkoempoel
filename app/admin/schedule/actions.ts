"use server";

import { upsertScheduleEntry, generateAutoSchedule, type ScheduleEntry } from "@/services/scheduleService";
import { revalidatePath } from "next/cache";

export async function upsertScheduleEntryAction(entry: ScheduleEntry) {
  await upsertScheduleEntry(entry);
  revalidatePath("/admin/schedule");
}

/** Susun ulang jadwal shift mingguan otomatis dari data pegawai & jabatan
 * saat ini (Kasir/Bar/Kitchen/Waitres/Kapten/Sekuriti). Lihat aturan
 * lengkap di scheduleService.generateAutoSchedule(). */
export async function generateAutoScheduleAction() {
  const result = await generateAutoSchedule();
  revalidatePath("/admin/schedule");
  return result;
}
