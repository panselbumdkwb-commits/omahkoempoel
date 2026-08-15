import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// PENTING: client ini menggunakan anon key + cookie sesi user yang login,
// BUKAN service role key. Artinya setiap query lewat client ini tetap
// tunduk pada RLS dan auth.uid() terisi dengan benar — sehingga audit_logs
// mencatat siapa pelaku sebenarnya (bukan "server" generik).
//
// Gunakan supabaseAdmin (supabase-admin.ts) HANYA untuk operasi yang
// memang butuh bypass RLS dengan validasi eksplisit di kode (mis. ordering
// publik tanpa login di fase berikutnya) — jangan dipakai untuk aksi kasir
// yang sudah login, karena akan menghilangkan jejak audit yang akurat.
export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component without write access — safe to ignore,
            // middleware is responsible for refreshing the session cookie.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // see note above
          }
        },
      },
    }
  );
}
