// Stylized, fully static SVG document mockup (driving license / tech
// passport) — no real scanned images or external services. Purely
// decorative placeholder so reviewers have something to look at.
export function DocumentViewer({
  kind,
  name,
  plate,
}: {
  kind: "license" | "tech_passport";
  name: string;
  plate: string;
}) {
  const title = kind === "license" ? "Haydovchilik guvohnomasi" : "Texnik pasport";
  return (
    <svg viewBox="0 0 320 200" className="h-auto w-full rounded-2xl" role="img" aria-label={title}>
      <defs>
        <linearGradient id={`docbg_${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#eef1f8" />
          <stop offset="100%" stopColor="#dde4f1" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="16" fill={`url(#docbg_${kind})`} />
      <rect x="16" y="16" width="288" height="28" rx="8" fill="#264A9F" opacity="0.12" />
      <text x="28" y="35" fontSize="11" fontWeight="600" fill="#264A9F">
        {title.toUpperCase()}
      </text>
      <rect x="16" y="58" width="72" height="90" rx="10" fill="#cdd3e0" />
      <circle cx="52" cy="92" r="16" fill="#9aa5bb" />
      <rect x="34" y="114" width="36" height="8" rx="4" fill="#9aa5bb" />
      <text x="100" y="74" fontSize="9" fill="#6b7489">
        F.I.Sh.
      </text>
      <text x="100" y="90" fontSize="12" fontWeight="600" fill="#0e1420">
        {name}
      </text>
      <text x="100" y="112" fontSize="9" fill="#6b7489">
        {kind === "license" ? "Guvohnoma raqami" : "Avtomobil davlat raqami"}
      </text>
      <text x="100" y="128" fontSize="12" fontWeight="600" fill="#0e1420">
        {kind === "license" ? `UZB ${name.length}${plate.replace(/\s/g, "").slice(0, 6)}` : plate}
      </text>
      <text x="16" y="178" fontSize="8" fill="#98a0b3">
        Demo hujjat — real skanerlangan rasm emas
      </text>
    </svg>
  );
}
