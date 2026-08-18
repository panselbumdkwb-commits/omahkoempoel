"use client";

type TableWithQr = { id: string; number: string; url: string; qrDataUrl: string };

export default function QrMejaClient({ tables }: { tables: TableWithQr[] }) {
  if (tables.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <h2 className="font-heading text-2xl text-primary mb-4">QR Code Meja</h2>
        <p className="text-text-muted text-sm">Belum ada data meja di sistem.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
        }
      `}</style>

      <div className="flex justify-between items-center print:hidden">
        <div>
          <h2 className="font-heading text-2xl text-primary">QR Code Meja</h2>
          <p className="text-sm text-text-muted mt-1">
            Cetak dan tempel QR ini di masing-masing meja. Pembeli tinggal scan untuk langsung membuka
            menu dengan meja sudah terisi otomatis.
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold"
        >
          🖨️ Cetak Semua
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 print:grid-cols-2 print:gap-6">
        {tables.map((t) => (
          <div
            key={t.id}
            className="border border-border rounded-lg p-4 text-center bg-surface dark:bg-surface-dark print:break-inside-avoid"
          >
            <p className="font-heading text-lg text-primary mb-2">Meja {t.number}</p>
            <img src={t.qrDataUrl} alt={`QR Meja ${t.number}`} className="mx-auto w-40 h-40" />
            <p className="text-xs text-text-muted mt-2">Scan untuk pesan dari meja ini</p>
            <p className="text-[10px] text-text-muted break-all mt-1 print:hidden">{t.url}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
