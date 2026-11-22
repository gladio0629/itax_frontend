import { AdminBrand } from "@/components/Logo";

/** Dark left half of the login screens (design Main/Verify). Hidden below
 * 1024px; the form side then shows a small dark brand bar instead. */
export function AuthAside({ title, text }: { title: string; text: string }) {
  return (
    <aside className="hidden w-[min(640px,45%)] shrink-0 flex-col bg-ink px-14 py-12 text-white lg:flex">
      <AdminBrand />
      <div className="flex min-h-0 flex-1 items-center">
        <RouteArt />
      </div>
      <h2 className="text-[34px] font-extrabold leading-[42px]">{title}</h2>
      <p className="mt-2.5 max-w-[480px] text-15 leading-[23px] text-ink-muted">{text}</p>
    </aside>
  );
}

/** Decorative route illustration (copied from the design, aria-hidden). */
function RouteArt() {
  const font = "'IZGO Sans', system-ui, sans-serif";
  return (
    <svg aria-hidden="true" viewBox="0 0 560 420" className="block h-auto w-full max-w-[560px]">
      <g stroke="var(--ink-ring)" strokeWidth="2" fill="none">
        <circle cx="150" cy="300" r="60" />
        <circle cx="150" cy="300" r="110" />
        <circle cx="150" cy="300" r="170" />
      </g>
      <path d="M150 300 C 230 120, 380 90, 460 150" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 12" />
      <circle cx="150" cy="300" r="22" fill="var(--green)" fillOpacity="0.25" />
      <circle cx="150" cy="300" r="10" fill="var(--green)" />
      <circle cx="460" cy="150" r="16" fill="white" />
      <circle cx="460" cy="150" r="6" fill="var(--ink)" />
      <g transform="translate(36 222)">
        <rect width="104" height="30" rx="15" fill="var(--ink-2)" />
        <text x="52" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily={font}>
          Toshkent
        </text>
      </g>
      <g transform="translate(408 100)">
        <rect width="112" height="30" rx="15" fill="var(--ink-2)" />
        <text x="56" y="20" textAnchor="middle" fill="white" fontSize="12" fontWeight="700" fontFamily={font}>
          Samarqand
        </text>
      </g>
      {[
        { y: 236, title: "Email + SMS kodi", sub: "Ikki qadamli kirish" },
        { y: 304, title: "Audit jurnali", sub: "Har harakat yozib boriladi" },
      ].map((c) => (
        <g key={c.y} transform={`translate(268 ${c.y})`}>
          <rect width="250" height="56" rx="18" fill="var(--ink-2)" />
          <circle cx="28" cy="28" r="14" fill="var(--green)" />
          <path d="M21 28l5 5 9-10" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <text x="52" y="24" fill="white" fontSize="13" fontWeight="800" fontFamily={font}>
            {c.title}
          </text>
          <text x="52" y="41" fill="var(--ink-muted)" fontSize="11" fontWeight="600" fontFamily={font}>
            {c.sub}
          </text>
        </g>
      ))}
    </svg>
  );
}
