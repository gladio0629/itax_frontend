export function RouteIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-full w-full">
      <circle cx="140" cy="110" r="100" className="fill-accent/10" />
      <circle cx="140" cy="110" r="70" className="fill-accent/5" />
      <path
        d="M40 160 C 90 60, 150 190, 230 70"
        fill="none"
        className="stroke-accent"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 14"
      />
      <circle cx="40" cy="160" r="9" className="fill-ink" />
      <circle cx="230" cy="70" r="9" className="fill-on-yellow" />
      <circle cx="230" cy="70" r="6" className="fill-brand-yellow" />
      <g transform="translate(118, 98)">
        <rect x="0" y="10" width="44" height="22" rx="8" className="fill-ink" />
        <rect x="6" y="0" width="32" height="14" rx="6" className="fill-ink" />
        <circle cx="10" cy="32" r="6" className="fill-card" />
        <circle cx="34" cy="32" r="6" className="fill-card" />
      </g>
    </svg>
  );
}

export function PriceIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-full w-full">
      <circle cx="140" cy="110" r="100" className="fill-accent/10" />
      <rect x="70" y="60" width="140" height="100" rx="20" className="fill-card stroke-accent" strokeWidth="3" />
      <rect x="92" y="86" width="96" height="10" rx="5" className="fill-ink/10" />
      <rect x="92" y="104" width="64" height="10" rx="5" className="fill-ink/10" />
      <circle cx="140" cy="140" r="16" className="fill-accent" />
      <text x="140" y="145" textAnchor="middle" fontSize="14" fontWeight="700" className="fill-white">
        so'm
      </text>
    </svg>
  );
}

export function TrustIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-full w-full">
      <circle cx="140" cy="110" r="100" className="fill-accent/10" />
      <circle cx="140" cy="95" r="38" className="fill-ink" />
      <circle cx="140" cy="86" r="14" className="fill-card" />
      <path d="M112 118 q28 -18 56 0 l0 20 q-28 14 -56 0 Z" className="fill-card" />
      <g transform="translate(170, 130)">
        <circle cx="16" cy="16" r="16" className="fill-accent" />
        <path d="M9 16 l5 5 10 -10" fill="none" className="stroke-white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
