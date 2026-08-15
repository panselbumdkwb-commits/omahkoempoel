"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";

export default function AdminNav() {
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
    <nav className="flex items-center gap-2">
      <Link href="/admin" className={linkClass("/admin")}>
        Dashboard
      </Link>
      <Link href="/admin/menu" className={linkClass("/admin/menu")}>
        Kelola Menu
      </Link>
      <button onClick={handleLogout} className="ml-auto px-3 py-2 text-sm text-danger">
        Logout
      </button>
    </nav>
  );
}
