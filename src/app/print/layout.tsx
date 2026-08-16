import { redirect } from "next/navigation";
import { getCurrentUser, getCurrentRole } from "@/lib/auth";

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = await getCurrentRole();
  if (!role || !["SUPER_ADMIN", "OWNER", "KASIR", "FRONT_SERVE", "KITCHEN"].includes(role)) {
    redirect("/pos");
  }

  return (
    <div className="min-h-screen bg-white text-black">
      {/* CSS khusus printer thermal (lebar 80mm) — hanya berlaku saat
          benar-benar mencetak, tidak mempengaruhi tampilan preview di layar. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          body { width: 80mm; }
        }
      `}</style>
      {children}
    </div>
  );
}
