"use server";

import { revalidatePath } from "next/cache";
import * as orderService from "@/services/orderService";
import * as paymentService from "@/services/paymentService";

export async function listOpenOrdersAction() {
  return orderService.listOpenOrders();
}

export async function getOrderDetailAction(orderId: string) {
  return orderService.getOrderDetail(orderId);
}

export async function updateCustomerNameAction(orderId: string, customerName: string) {
  await orderService.updateCustomerName(orderId, customerName);
  revalidatePath("/pos");
}

export async function updateOrderTableAction(
  orderId: string,
  tableId: string | null,
  orderType: "dine_in" | "take_away"
) {
  await orderService.updateOrderTableAndType(orderId, tableId, orderType);
  revalidatePath("/pos");
}

export async function sendToKitchenAction(orderId: string) {
  await orderService.updateOrderStatus(orderId, "CONFIRMED");
  revalidatePath("/pos");
  revalidatePath("/kitchen");
}

export async function createOrderAction(input: orderService.CreateOrderInput) {
  const order = await orderService.createOrder(input);
  revalidatePath("/pos");
  return order;
}

export async function addOrderItemAction(input: orderService.AddOrderItemInput) {
  const item = await orderService.addOrderItem(input);
  revalidatePath("/pos");
  return item;
}

export async function processPaymentAction(input: paymentService.ProcessPaymentInput) {
  const result = await paymentService.processPayment(input);
  revalidatePath("/pos");
  return result;
}

export async function closeOrderAction(orderId: string) {
  await orderService.closeOrder(orderId);
  revalidatePath("/pos");
}
