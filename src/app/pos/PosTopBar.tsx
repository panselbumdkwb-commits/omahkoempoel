"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import DateTimeBadge from "@/components/DateTimeBadge";

export default function PosTopBar({
  showDateTimeClock,
  role,
}: {
  showDateTimeClock: boolean;
  role?: string | null;
}) {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="glass-header border-b border-border px-4 py-3 flex items-center justify-between bg-surface dark:bg-surface-dark">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-xl text-primary">Omah Koempoel — Kasir</h1>
        {/* Captain: rule & role utamanya KASIR, tapi tetap bisa lihat
            Laporan/Kelola Menu/Pegawai/Absensi/Jadwal Kerja/QR Meja/Papan
            Dapur/Papan Bar (view-only — koordinasi ke Admin/Owner untuk
            perubahan data). Owner/Super Admin sudah punya jalur sendiri ke
            /admin lewat redirect login, tombol ini khusus supaya Captain
            tidak nyasar. */}
        {role === "CAPTAIN" && (
          <Link href="/admin" className="pill-nav-link bg-accent/15 text-accent font-bold hover:bg-accent/25 text-sm">
            📊 Lihat Data (Laporan, Menu, Pegawai, dll)
          </Link>
        )}
      </div>
      {showDateTimeClock && (
        <DateTimeBadge variant="compact" className="text-sm text-text-muted hidden sm:inline" />
      )}
      <button onClick={handleLogout} className="text-sm text-danger font-semibold">
        Logout
      </button>
    </header>
  );
}
