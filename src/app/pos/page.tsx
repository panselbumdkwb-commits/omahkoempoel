import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import * as orderService from "@/services/orderService";
import PosTopBar from "./PosTopBar";
import OrderQueueClient from "./OrderQueueClient";

export default async function PosPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [openOrders, { data: products }, { data: tables }, { data: paymentMethods }, { data: business }] =
    await Promise.all([
      orderService.listOpenOrders(),
      supabase
        .from("products")
        .select("id, name, price, category_id, categories(name)")
        .eq("status", "active")
        .order("name"),
      supabase.from("tables").select("id, number, status").order("number"),
      supabase.from("payment_methods").select("id, code, name").eq("is_active", true),
      supabase.from("business").select("id, name").limit(1).single(),
    ]);

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <PosTopBar />
      <OrderQueueClient
        initialOrders={openOrders}
        businessId={business?.id ?? ""}
        products={products ?? []}
        tables={tables ?? []}
        paymentMethods={paymentMethods ?? []}
      />
    </div>
  );
}
