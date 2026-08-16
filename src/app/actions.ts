"use server";

import { revalidatePath } from "next/cache";
import * as publicOrderService from "@/services/publicOrderService";

export async function submitPublicOrderAction(input: publicOrderService.SubmitPublicOrderInput) {
  const result = await publicOrderService.submitPublicOrder(input);
  revalidatePath("/");
  return result;
}

export async function getPublicOrderStatusAction(orderId: string) {
  return publicOrderService.getPublicOrderStatus(orderId);
}
