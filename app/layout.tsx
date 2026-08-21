import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Omah Koempoel",
  description: "Cafe Omah Koempoel — Order, Reservasi, dan Informasi Cafe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
