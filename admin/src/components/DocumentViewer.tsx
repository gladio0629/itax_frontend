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
          <stop offset="0%" stopColor="#eef5f1" />
          <stop offset="100%" stopColor="#dce8e1" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" rx="16" fill={`url(#docbg_${kind})`} />
      <rect x="16" y="16" width="288" height="28" rx="8" fill="#0FB67C" opacity="0.12" />
      <text x="28" y="35" fontSize="11" fontWeight="600" fill="#0A5C3C">
        {title.toUpperCase()}
      </text>
      <rect x="16" y="58" width="72" height="90" rx="10" fill="#c9d4ce" />
      <circle cx="52" cy="92" r="16" fill="#9fb0a7" />
      <rect x="34" y="114" width="36" height="8" rx="4" fill="#9fb0a7" />
      <text x="100" y="74" fontSize="9" fill="#5b6b62">
        F.I.Sh.
      </text>
      <text x="100" y="90" fontSize="12" fontWeight="600" fill="#0e1a16">
        {name}
      </text>
      <text x="100" y="112" fontSize="9" fill="#5b6b62">
        {kind === "license" ? "Guvohnoma raqami" : "Avtomobil davlat raqami"}
      </text>
      <text x="100" y="128" fontSize="12" fontWeight="600" fill="#0e1a16">
        {kind === "license" ? `UZB ${name.length}${plate.replace(/\s/g, "").slice(0, 6)}` : plate}
      </text>
      <text x="16" y="178" fontSize="8" fill="#8a988f">
        Demo hujjat — real skanerlangan rasm emas
      </text>
    </svg>
  );
}
