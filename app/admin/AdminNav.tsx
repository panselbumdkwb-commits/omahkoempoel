"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  CAPTAIN: "Captain",
};

export default function AdminNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkClass = (href: string) =>
    `pill-nav-link ${pathname === href ? "pill-nav-link-active" : "pill-nav-link-inactive"}`;

  // CAPTAIN TIDAK BOLEH melihat Laporan & Payroll (migration 0018) —
  // menu itu disaring keluar untuk role ini. Sebaliknya Captain diberi
  // kendali penuh atas Pegawai & Absensi, plus bisa mencatat Belanja
  // (bahan baku/peralatan-perlengkapan/rutin) dan mengelola Persediaan.
  // Menu khusus SUPER_ADMIN (Kelola User, Pengaturan) tetap tersembunyi,
  // sama seperti yang tidak dilihat OWNER sekalipun.
  const baseItems: { href: string; label: string }[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/reports", label: "Laporan" },
    { href: "/admin/menu", label: "Kelola Menu" },
    { href: "/admin/employees", label: "Pegawai" },
    { href: "/admin/attendance", label: "Absensi" },
    { href: "/admin/verifikasi-pegawai", label: "Verifikasi Pegawai" },
    { href: "/admin/purchases", label: "Belanja" },
    { href: "/admin/inventory", label: "Persediaan" },
    { href: "/admin/payroll", label: "Payroll" },
    { href: "/admin/schedule", label: "Jadwal Kerja" },
    { href: "/admin/qr-meja", label: "QR Meja" },
  ];
  const CAPTAIN_HIDDEN = new Set(["/admin/reports", "/admin/payroll"]);
  const items = role === "CAPTAIN" ? baseItems.filter((i) => !CAPTAIN_HIDDEN.has(i.href)) : baseItems;

  return (
    <nav className="flex items-center gap-1.5 overflow-x-auto">
      {role === "CAPTAIN" && (
        <Link href="/pos" className="pill-nav-link bg-accent/15 text-accent font-bold hover:bg-accent/25">
          Buka Kasir
        </Link>
      )}

      {items.map((item) => (
        <Link key={item.href} href={item.href} className={linkClass(item.href)}>
          {item.label}
        </Link>
      ))}

      <Link href="/kitchen" className={linkClass("/kitchen")} target="_blank">
        Papan Dapur
      </Link>
      <Link href="/bar" className={linkClass("/bar")} target="_blank">
        Papan Bar
      </Link>

      {role === "SUPER_ADMIN" && (
        <Link href="/admin/users" className={linkClass("/admin/users")}>
          Kelola User
        </Link>
      )}
      {role === "SUPER_ADMIN" && (
        <Link href="/admin/settings" className={linkClass("/admin/settings")}>
          Pengaturan
        </Link>
      )}

      <div className="ml-auto flex items-center gap-2">
        {role && (
          <span className="hidden sm:inline badge-modern bg-primary/10 text-primary">{ROLE_LABEL[role] ?? role}</span>
        )}
        <button onClick={handleLogout} className="pill-nav-link text-danger hover:bg-danger/10">
          Logout
        </button>
      </div>
    </nav>
  );
}
