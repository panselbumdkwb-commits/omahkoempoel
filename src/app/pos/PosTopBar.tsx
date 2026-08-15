"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function PosTopBar() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-surface dark:bg-surface-dark">
      <h1 className="font-heading text-xl text-primary">Omah Koempoel — Kasir</h1>
      <button onClick={handleLogout} className="text-sm text-danger font-semibold">
        Logout
      </button>
    </header>
  );
}
