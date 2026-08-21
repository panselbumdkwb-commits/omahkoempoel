"use server";

import { revalidatePath } from "next/cache";
import * as publicOrderService from "@/services/publicOrderService";
import { getShowDateTimeClock } from "@/services/settingsService";

export async function submitPublicOrderAction(input: publicOrderService.SubmitPublicOrderInput) {
  const result = await publicOrderService.submitPublicOrder(input);
  revalidatePath("/");
  return result;
}

export async function getPublicOrderStatusAction(orderId: string) {
  return publicOrderService.getPublicOrderStatus(orderId);
}

export async function getShowDateTimeClockAction() {
  return getShowDateTimeClock();
}
