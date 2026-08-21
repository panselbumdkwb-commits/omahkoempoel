import { headers } from "next/headers";
import QRCode from "qrcode";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { requireAdminOrOwner } from "@/lib/auth";
import QrMejaClient from "./QrMejaClient";

export default async function QrMejaPage() {
  await requireAdminOrOwner();
  const supabase = createSupabaseServerClient();
  const { data: tables } = await supabase.from("tables").select("id, number").order("number");

  const headersList = headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  const tablesWithQr = await Promise.all(
    (tables ?? []).map(async (t) => {
      const url = `${baseUrl}/?meja=${t.id}`;
      const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 1 });
      return { id: t.id, number: t.number, url, qrDataUrl };
    })
  );

  return <QrMejaClient tables={tablesWithQr} />;
}
