import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentRole } from "@/lib/auth";
import { getShowDateTimeClock } from "@/services/settingsService";
import AdminNav from "./AdminNav";
import DateTimeBadge from "@/components/DateTimeBadge";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER", "CAPTAIN"].includes(role)) {
    redirect("/pos");
  }

  const showDateTimeClock = await getShowDateTimeClock();

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark">
      <header className="glass-header border-b border-border px-6 py-3.5 flex items-center gap-6 print:hidden">
        <h1 className="font-heading text-xl sm:text-2xl text-primary tracking-tight whitespace-nowrap">
          Omah Koempoel
        </h1>
        <AdminNav role={role} />
        {showDateTimeClock && (
          <DateTimeBadge variant="compact" className="ml-auto text-sm text-text-muted hidden md:inline" />
        )}
      </header>
      <div className="p-4 sm:p-6 print:p-0 animate-float-in">{children}</div>
    </div>
  );
}