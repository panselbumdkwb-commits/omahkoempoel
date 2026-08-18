"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function AdminNav({ role }: { role: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const linkClass = (href: string) =>
    `px-3 py-2 rounded-md text-sm font-semibold ${
      pathname === href ? "bg-primary text-white" : "text-text-muted"
    }`;

  return (
    <nav className="flex items-center gap-2 overflow-x-auto">
      <Link href="/admin" className={linkClass("/admin")}>
        Dashboard
      </Link>
      <Link href="/admin/reports" className={linkClass("/admin/reports")}>
        Laporan
      </Link>
      <Link href="/admin/menu" className={linkClass("/admin/menu")}>
        Kelola Menu
      </Link>
      <Link href="/admin/employees" className={linkClass("/admin/employees")}>
        Pegawai
      </Link>
      <Link href="/admin/attendance" className={linkClass("/admin/attendance")}>
        Absensi
      </Link>
      <Link href="/admin/payroll" className={linkClass("/admin/payroll")}>
        Payroll
      </Link>
      <Link href="/admin/schedule" className={linkClass("/admin/schedule")}>
        Jadwal Kerja
      </Link>
      <Link href="/admin/qr-meja" className={linkClass("/admin/qr-meja")}>
        QR Meja
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
      <button onClick={handleLogout} className="ml-auto px-3 py-2 text-sm text-danger">
        Logout
      </button>
    </nav>
  );
}
