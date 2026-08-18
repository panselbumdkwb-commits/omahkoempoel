import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getShowDateTimeClock, getCafeOperatingHours } from "@/services/settingsService";
import MenuClient from "./MenuClient";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { meja?: string };
}) {
  const supabase = createSupabaseServerClient();

  const [{ data: categories }, { data: products }, { data: tables }, showDateTimeClock, cafeOperatingHours] =
    await Promise.all([
      supabase.from("categories").select("id, name, sort_order").order("sort_order"),
      supabase
        .from("products")
        .select(
          "id, category_id, name, description, price, image_url, product_variants(id, name, price_adjustment), product_modifiers(id, name, price_adjustment)"
        )
        .eq("status", "active")
        .order("name"),
      supabase.from("tables").select("id, number, status").order("number"),
      getShowDateTimeClock(),
      getCafeOperatingHours(),
    ]);

  const menuUnavailable = !categories || !products;

  // Kalau pembeli scan QR meja (?meja=<table_id>), cocokkan ke data meja
  // yang valid supaya tidak bisa dipalsukan lewat sembarang ID di URL.
  const presetTable = searchParams.meja
    ? (tables ?? []).find((t) => t.id === searchParams.meja) ?? null
    : null;

  return (
    <MenuClient
      categories={categories ?? []}
      products={products ?? []}
      tables={tables ?? []}
      menuUnavailable={menuUnavailable}
      showDateTimeClock={showDateTimeClock}
      cafeOperatingHours={cafeOperatingHours}
      presetTable={presetTable ? { id: presetTable.id, number: presetTable.number } : null}
    />
  );
}
