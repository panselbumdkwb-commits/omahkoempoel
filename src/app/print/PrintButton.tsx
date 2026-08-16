"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden w-[72mm] mx-auto block mt-4 bg-primary text-white py-3 rounded-md font-semibold"
    >
      🖨️ Cetak
    </button>
  );
}
