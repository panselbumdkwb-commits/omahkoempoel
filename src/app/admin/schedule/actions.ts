"use server";

import { upsertScheduleEntry, type ScheduleEntry } from "@/services/scheduleService";
import { revalidatePath } from "next/cache";

export async function upsertScheduleEntryAction(entry: ScheduleEntry) {
  await upsertScheduleEntry(entry);
  revalidatePath("/admin/schedule");
}
