import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/** Mengambil role code user yang sedang login, lewat fn_current_role_code()
 * yang sama dipakai RLS — supaya cek di UI selalu konsisten dengan aturan
 * yang ditegakkan di database (bukan logika terpisah yang bisa berbeda). */
export async function getCurrentRole(): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("fn_current_role_code");
  if (error) return null;
  return data ?? null;
}

export async function getCurrentUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
