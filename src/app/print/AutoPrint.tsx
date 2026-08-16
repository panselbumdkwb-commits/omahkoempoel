"use client";

import { useEffect } from "react";

export default function AutoPrint({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);

  return <>{children}</>;
}
