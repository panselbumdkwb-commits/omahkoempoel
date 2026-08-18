"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import DateTimeBadge from "@/components/DateTimeBadge";

export default function LoginForm({ showDateTimeClock }: { showDateTimeClock: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setLoading(false);
      setError("Login gagal: email atau password salah.");
      return;
    }

    // Arahkan berdasarkan role: Owner/Super Admin ke Dashboard,
    // Kasir/Front Serve ke interface transaksi (/pos).
    const { data: role } = await supabase.rpc("fn_current_role_code");
    setLoading(false);

    if (role === "OWNER" || role === "SUPER_ADMIN") {
      router.push("/admin");
    } else if (role === "KITCHEN") {
      router.push("/kitchen");
    } else if (role === "BAR") {
      router.push("/bar");
    } else {
      router.push("/pos");
    }
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-background dark:bg-background-dark">
      <form
        onSubmit={handleSubmit}
        className="max-w-sm w-full rounded-lg border border-border bg-surface dark:bg-surface-dark dark:border-border p-8"
      >
        <h1 className="text-2xl font-heading text-primary mb-2 text-center">
          Omah Koempoel — Staff Login
        </h1>
        {showDateTimeClock && (
          <p className="text-center mb-6">
            <DateTimeBadge variant="full" className="text-xs text-text-muted" />
          </p>
        )}

        <label className="block text-sm mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-border rounded-md p-2 mb-4 bg-background dark:bg-background-dark"
        />

        <label className="block text-sm mb-1">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-border rounded-md p-2 mb-4 bg-background dark:bg-background-dark"
        />

        {error && <p className="text-danger text-sm mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white rounded-md py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Login"}
        </button>

        <div className="mt-6 pt-4 border-t border-border text-center">
          <a
            href="/kiosk/attendance"
            className="text-sm text-primary underline font-semibold"
          >
            Absen Pegawai (tanpa perlu login)
          </a>
        </div>
      </form>
    </main>
  );
}
