"use client";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden w-full max-w-sm mx-auto block mt-4 bg-primary text-white py-3 rounded-md font-semibold"
    >
      🖨️ Cetak
    </button>
  );
}
