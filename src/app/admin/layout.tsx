import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentRole } from "@/lib/auth";
import AdminNav from "./AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER"].includes(role)) {
    redirect("/pos");
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <header className="border-b border-border px-6 py-4 flex items-center gap-6">
        <h1 className="font-heading text-2xl text-primary">Omah Koempoel</h1>
        <AdminNav role={role} />
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}