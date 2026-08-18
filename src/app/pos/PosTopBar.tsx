"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import DateTimeBadge from "@/components/DateTimeBadge";

export default function PosTopBar({ showDateTimeClock }: { showDateTimeClock: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-surface dark:bg-surface-dark">
      <h1 className="font-heading text-xl text-primary">Omah Koempoel — Kasir</h1>
      {showDateTimeClock && (
        <DateTimeBadge variant="compact" className="text-sm text-text-muted hidden sm:inline" />
      )}
      <button onClick={handleLogout} className="text-sm text-danger font-semibold">
        Logout
      </button>
    </header>
  );
}
