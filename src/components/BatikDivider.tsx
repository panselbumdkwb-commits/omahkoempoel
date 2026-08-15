// Motif kawung sederhana: 4 elips saling tumpang tindih membentuk satu unit,
// diulang sebagai garis pembatas tipis berwarna emas. Terinspirasi motif
// geometris tradisional Jawa, dibuat generik (bukan reproduksi kain batik
// tertentu) — dipakai sebagai elemen signature yang konsisten di header
// dan cart tray.
export default function BatikDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="14"
      viewBox="0 0 120 14"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="kawung" width="24" height="14" patternUnits="userSpaceOnUse">
          <g stroke="#C9A15A" strokeWidth="0.9" fill="none" opacity="0.85">
            <ellipse cx="6" cy="7" rx="5" ry="3.2" />
            <ellipse cx="18" cy="7" rx="5" ry="3.2" />
            <ellipse cx="12" cy="2" rx="5" ry="3.2" transform="rotate(90 12 2)" />
            <ellipse cx="12" cy="12" rx="5" ry="3.2" transform="rotate(90 12 12)" />
            <circle cx="12" cy="7" r="1" fill="#C9A15A" stroke="none" />
          </g>
        </pattern>
      </defs>
      <rect width="120" height="14" fill="url(#kawung)" />
    </svg>
  );
}
