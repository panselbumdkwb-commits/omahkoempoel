import { supabaseAdmin } from "@/lib/supabase-admin";

async function getBusinessName() {
  try {
    const { data, error } = await supabaseAdmin
      .from("business")
      .select("name")
      .limit(1)
      .single();
    if (error) throw error;
    return data?.name ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const businessName = await getBusinessName();

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full rounded-lg border border-border bg-surface dark:bg-surface-dark dark:border-border p-8 text-center">
        <h1 className="text-3xl font-heading text-primary mb-2">
          Omah Koempoel
        </h1>
        <p className="text-text-muted mb-6">
          Sistem sedang dalam tahap pengembangan (Phase 1 — Foundation).
        </p>

        <div className="rounded-md bg-background dark:bg-background-dark p-4 text-sm">
          {businessName ? (
            <p>
              ✅ Terhubung ke Supabase — data bisnis:{" "}
              <span className="font-semibold">{businessName}</span>
            </p>
          ) : (
            <p>
              ⚠️ Belum terhubung ke Supabase. Pastikan environment
              variables <code>NEXT_PUBLIC_SUPABASE_URL</code> dan{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> sudah diisi di Vercel,
              dan migration database sudah dijalankan.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
