import { createSupabaseServerClient } from "@/lib/supabase-server";
import PosClient from "./PosClient";

export default async function PosPage() {
  const supabase = createSupabaseServerClient();

  const [{ data: products }, { data: tables }, { data: paymentMethods }, { data: business }] =
    await Promise.all([
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
    <PosClient
      businessId={business?.id ?? ""}
      products={products ?? []}
      tables={tables ?? []}
      paymentMethods={paymentMethods ?? []}
    />
  );
}
