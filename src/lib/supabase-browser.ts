import { createClient } from "@supabase/supabase-js";

// Client ini HANYA memakai anon key — aman dipakai di browser.
// Service role key TIDAK PERNAH dipakai di sini atau di file manapun
// yang di-import oleh komponen client-side.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
