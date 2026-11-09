import { useDemoStore } from "@/stores/demoStore";

export function DemoBadge() {
  const isDemo = useDemoStore((s) => s.isDemo);
  if (!isDemo) return null;
  return (
    <div className="pointer-events-none absolute right-3 z-40 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm" style={{ top: "calc(var(--safe-top) + 10px)" }}>
      DEMO
    </div>
  );
}
