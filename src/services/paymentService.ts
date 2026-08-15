import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type ProcessPaymentInput = {
  orderId: string;
  paymentMethodId: string;
  amount: number;
  referenceNo?: string;
};

/**
 * Mencatat pembayaran untuk sebuah order. Mendukung split bill secara
 * natural karena satu order bisa punya banyak baris payment — begitu
 * total payment >= grand_total, order otomatis pindah status ke PAID.
 *
 * Uang dihitung dengan numeric/decimal di database (bukan float) sesuai
 * Master Prompt Bagian 74 poin 23.
 */
export async function processPayment(input: ProcessPaymentInput) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("grand_total, status")
    .eq("id", input.orderId)
    .single();
  if (orderError) throw new Error(`Order tidak ditemukan: ${orderError.message}`);
  if (order.status === "CLOSED") {
    throw new Error("Order sudah CLOSED, tidak dapat menerima pembayaran baru.");
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      order_id: input.orderId,
      payment_method_id: input.paymentMethodId,
      amount: input.amount,
      reference_no: input.referenceNo ?? null,
      status: "COMPLETED",
      created_by: user?.id ?? null,
    })
    .select()
    .single();
  if (paymentError) throw new Error(`Gagal mencatat pembayaran: ${paymentError.message}`);

  const { data: existingPayments, error: sumError } = await supabase
    .from("payments")
    .select("amount")
    .eq("order_id", input.orderId)
    .eq("status", "COMPLETED");
  if (sumError) throw new Error(`Gagal menghitung total bayar: ${sumError.message}`);

  const totalPaid = (existingPayments ?? []).reduce((sum, p: any) => sum + Number(p.amount), 0);

  if (totalPaid >= Number(order.grand_total)) {
    const { error: statusError } = await supabase
      .from("orders")
      .update({ status: "PAID" })
      .eq("id", input.orderId);
    if (statusError) throw new Error(`Gagal update status order ke PAID: ${statusError.message}`);
  }

  return { payment, totalPaid, remaining: Math.max(0, Number(order.grand_total) - totalPaid) };
}

export async function listPaymentMethods() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("id, code, name, type")
    .eq("is_active", true);
  if (error) throw new Error(`Gagal mengambil metode pembayaran: ${error.message}`);
  return data;
}
