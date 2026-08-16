"use server";

import { revalidatePath } from "next/cache";
import * as kitchenService from "@/services/kitchenService";

export async function advanceOrderStatusAction(
  orderId: string,
  status: "CONFIRMED" | "PROCESSING" | "READY" | "SERVED"
) {
  await kitchenService.advanceOrderStatus(orderId, status);
  revalidatePath("/kitchen");
  revalidatePath("/pos");
}
