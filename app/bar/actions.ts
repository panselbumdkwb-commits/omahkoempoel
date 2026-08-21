"use server";

import { revalidatePath } from "next/cache";
import * as barService from "@/services/barService";

export async function advanceOrderStatusAction(
  orderId: string,
  status: "CONFIRMED" | "PROCESSING" | "READY" | "SERVED"
) {
  await barService.advanceOrderStatus(orderId, status);
  revalidatePath("/bar");
  revalidatePath("/pos");
  revalidatePath("/kitchen");
}
