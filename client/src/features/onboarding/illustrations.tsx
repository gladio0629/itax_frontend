export function RouteIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-full w-full">
      <circle cx="140" cy="110" r="100" fill="#0FB67C" opacity="0.08" />
      <circle cx="140" cy="110" r="70" fill="#0FB67C" opacity="0.06" />
      <path
        d="M40 160 C 90 60, 150 190, 230 70"
        fill="none"
        stroke="#0FB67C"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 14"
      />
      <circle cx="40" cy="160" r="9" fill="#0E1A16" />
      <circle cx="230" cy="70" r="9" fill="#0FB67C" />
      <g transform="translate(118, 98)">
        <rect x="0" y="10" width="44" height="22" rx="8" fill="#0E1A16" />
        <rect x="6" y="0" width="32" height="14" rx="6" fill="#0E1A16" />
        <circle cx="10" cy="32" r="6" fill="#F6F8F7" />
        <circle cx="34" cy="32" r="6" fill="#F6F8F7" />
      </g>
    </svg>
  );
}

export function PriceIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-full w-full">
      <circle cx="140" cy="110" r="100" fill="#0FB67C" opacity="0.08" />
      <rect x="70" y="60" width="140" height="100" rx="20" fill="#FFFFFF" stroke="#0FB67C" strokeWidth="3" />
      <rect x="92" y="86" width="96" height="10" rx="5" fill="#0E1A16" opacity="0.1" />
      <rect x="92" y="104" width="64" height="10" rx="5" fill="#0E1A16" opacity="0.1" />
      <circle cx="140" cy="140" r="16" fill="#0FB67C" />
      <text x="140" y="145" textAnchor="middle" fontSize="14" fontWeight="700" fill="white">
        so'm
      </text>
    </svg>
  );
}

export function TrustIllustration() {
  return (
    <svg viewBox="0 0 280 220" className="h-full w-full">
      <circle cx="140" cy="110" r="100" fill="#0FB67C" opacity="0.08" />
      <circle cx="140" cy="95" r="38" fill="#0E1A16" />
      <circle cx="140" cy="86" r="14" fill="#F6F8F7" />
      <path d="M112 118 q28 -18 56 0 l0 20 q-28 14 -56 0 Z" fill="#F6F8F7" />
      <g transform="translate(170, 130)">
        <circle cx="16" cy="16" r="16" fill="#0FB67C" />
        <path d="M9 16 l5 5 10 -10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
