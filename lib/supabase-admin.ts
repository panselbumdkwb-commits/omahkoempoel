import "server-only";
import { createClient } from "@supabase/supabase-js";

// PENTING: file ini mengimpor "server-only" — jika ada komponen client
// yang mencoba mengimpor file ini, build akan GAGAL (proteksi eksplisit
// agar service role key tidak pernah ikut ter-bundle ke browser).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
