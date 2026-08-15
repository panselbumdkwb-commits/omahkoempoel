import { createSupabaseServerClient } from "@/lib/supabase-server";
import MenuClient from "./MenuClient";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();

  const [{ data: categories }, { data: products }, { data: tables }] = await Promise.all([
    supabase.from("categories").select("id, name, sort_order").order("sort_order"),
    supabase
      .from("products")
      .select(
        "id, category_id, name, description, price, image_url, product_variants(id, name, price_adjustment), product_modifiers(id, name, price_adjustment)"
      )
      .eq("status", "active")
      .order("name"),
    supabase.from("tables").select("id, number, status").order("number"),
  ]);

  const menuUnavailable = !categories || !products;

  return (
    <MenuClient
      categories={categories ?? []}
      products={products ?? []}
      tables={tables ?? []}
      menuUnavailable={menuUnavailable}
    />
  );
}
