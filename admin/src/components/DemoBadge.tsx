import { useDemoStore } from "@/stores/demoStore";

export function DemoBadge() {
  const isDemo = useDemoStore((s) => s.isDemo);
  if (!isDemo) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-40 rounded-full bg-ink/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
      DEMO
    </div>
  );
}
