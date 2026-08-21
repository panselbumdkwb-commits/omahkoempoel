import { createBrowserClient } from "@supabase/ssr";

// PENTING: pakai createBrowserClient dari @supabase/ssr (bukan createClient
// biasa dari @supabase/supabase-js). Alasan: createClient biasa menyimpan
// sesi login di localStorage, sedangkan middleware & server component kita
// (supabase-server.ts) membaca sesi dari COOKIE lewat @supabase/ssr. Kalau
// browser client dan server client pakai mekanisme penyimpanan sesi yang
// berbeda, hasilnya: user kelihatan berhasil login di browser, tapi server
// selalu menganggap belum login (root cause redirect balik ke /login).
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
