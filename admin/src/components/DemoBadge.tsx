import { useLocation } from "react-router-dom";
import { useDemoStore } from "@/stores/demoStore";

/** "DEMO" marker. Inside the admin shell it sits inline in the top bar; on the
 * login screen (no top bar) it floats top-right. */
export function DemoBadge({ inline }: { inline?: boolean }) {
  const isDemo = useDemoStore((s) => s.isDemo);
  const { pathname } = useLocation();
  if (!isDemo) return null;
  if (!inline && pathname !== "/login") return null;
  return (
    <span
      className={
        inline
          ? "rounded-full bg-ink/[0.06] px-2 py-1 text-xs font-semibold text-ink/60"
          : "pointer-events-none fixed right-4 top-4 z-40 rounded-full bg-ink/80 px-2 py-1 text-xs font-semibold text-white"
      }
    >
      Demo
    </span>
  );
}
