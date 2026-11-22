import type { CarClassId } from "@/api/types";

// IZGO's own flat side-view cars for the class carousel — one silhouette per
// class, design v2 colours (Ink + green), no third-party imagery.
const PAINT: Record<CarClassId, { body: string; roof: string }> = {
  standart: { body: "#2EDB85", roof: "#1FB86A" },
  komfort: { body: "#E9ECF2", roof: "#D5DAE4" },
  biznes: { body: "#0B1524", roof: "#142235" },
  miniven: { body: "#C9D1DE", roof: "#B4BECF" },
};

export function ClassCarArt({ id, className }: { id: CarClassId; className?: string }) {
  const p = PAINT[id];
  const van = id === "miniven";
  return (
    <svg viewBox="0 0 96 40" className={className} aria-hidden="true">
      <ellipse cx="48" cy="36" rx="40" ry="2.6" fill="rgba(0,0,0,0.12)" />
      {van ? (
        <>
          <path d="M8 31 V16 Q9 9 17 8 H70 Q78 8 83 15 L89 22 Q91 24 91 27 V31 Z" fill={p.body} />
          <path d="M18 11 H68 Q74 11 78 16 L82 21 H18 Z" fill="#2B3446" opacity="0.85" />
          <path d="M44 11 V21 M60 11 V21" stroke={p.body} strokeWidth="2" />
        </>
      ) : (
        <>
          <path d="M6 30 V24 Q6 20 12 19 L26 17 L36 9 Q39 7 44 7 H60 Q66 7 70 11 L77 17 L86 19 Q91 20 91 25 V30 Z" fill={p.body} />
          <path d="M30 17 L38 10.5 Q40 9.5 44 9.5 H58 Q63 9.5 66 12.5 L71 17 Z" fill="#2B3446" opacity="0.85" />
          <path d="M51 9.5 V17" stroke={p.body} strokeWidth="2" />
          <path d="M6 24 H14" stroke={p.roof} strokeWidth="2" strokeLinecap="round" />
          {id === "standart" && <rect x="42" y="3.5" width="12" height="4" rx="1.2" fill="#16264D" />}
        </>
      )}
      <circle cx="24" cy="31" r="6" fill="#1B2230" />
      <circle cx="24" cy="31" r="2.6" fill="#C9CED8" />
      <circle cx="74" cy="31" r="6" fill="#1B2230" />
      <circle cx="74" cy="31" r="2.6" fill="#C9CED8" />
    </svg>
  );
}
