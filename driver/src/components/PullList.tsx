import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { ArrowDown } from "@/lib/icons";
import { Spinner } from "./Spinner";
import { cn } from "@/lib/cn";

const THRESHOLD = 64;
const MAX = 96;

/**
 * Vertical scroll area with pull-to-refresh. The pull is axis-locked (a
 * sideways swipe goes to the tabs) and only starts at the very top. Screens
 * also offer a visible refresh button, since a gesture alone isn't enough.
 */
export const PullList = forwardRef<HTMLDivElement, { onRefresh: () => Promise<unknown> | void; children: ReactNode; pullLabel: string; releaseLabel: string; className?: string }>(
  function PullList({ onRefresh, children, pullLabel, releaseLabel, className }, outer) {
    const ref = useRef<HTMLDivElement>(null);
    useImperativeHandle(outer, () => ref.current as HTMLDivElement);
    const [dist, setDist] = useState(0);
    const [busy, setBusy] = useState(false);
    const onRefreshRef = useRef(onRefresh);
    onRefreshRef.current = onRefresh;

    useEffect(() => {
      const el = ref.current;
      if (!el) return;
      let startX = 0;
      let startY = 0;
      let mode: "idle" | "pull" | "skip" = "idle";
      let d = 0;
      const start = (e: TouchEvent) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        mode = el.scrollTop <= 0 ? "idle" : "skip";
        d = 0;
      };
      const move = (e: TouchEvent) => {
        if (mode === "skip") return;
        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        if (mode === "idle") {
          if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
          mode = dy > 0 && Math.abs(dy) > Math.abs(dx) && el.scrollTop <= 0 ? "pull" : "skip";
          if (mode === "skip") return;
        }
        // Our own pull replaces the browser's overscroll here (needs a non-passive listener).
        e.preventDefault();
        d = Math.min(MAX, dy * 0.5);
        setDist(d);
      };
      const end = async () => {
        const fire = mode === "pull" && d >= THRESHOLD;
        mode = "idle";
        if (!fire) return setDist(0);
        setDist(THRESHOLD);
        setBusy(true);
        try {
          await onRefreshRef.current();
        } finally {
          setBusy(false);
          setDist(0);
        }
      };
      el.addEventListener("touchstart", start, { passive: true });
      el.addEventListener("touchmove", move, { passive: false });
      el.addEventListener("touchend", end);
      el.addEventListener("touchcancel", end);
      return () => {
        el.removeEventListener("touchstart", start);
        el.removeEventListener("touchmove", move);
        el.removeEventListener("touchend", end);
        el.removeEventListener("touchcancel", end);
      };
    }, []);

    const ready = dist >= THRESHOLD;
    return (
      <div ref={ref} className={cn("relative h-full overflow-y-auto overscroll-contain", className)}>
        <div
          aria-hidden={dist === 0 && !busy}
          className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
          style={{ transform: `translateY(${dist - 44}px)`, opacity: Math.min(1, dist / THRESHOLD), transition: dist === 0 || busy ? "transform 200ms, opacity 200ms" : "none" }}
        >
          <span className="mt-2 flex h-9 items-center gap-2 rounded-full bg-surface px-3 text-xs font-medium text-ink shadow-1" role={busy ? "status" : undefined}>
            {busy ? <Spinner className="h-4 w-4" /> : <ArrowDown className={cn("h-4 w-4 transition-transform", ready && "rotate-180")} />}
            {ready || busy ? releaseLabel : pullLabel}
          </span>
        </div>
        <div style={{ transform: dist ? `translateY(${dist}px)` : undefined, transition: dist === 0 ? "transform 200ms" : "none" }}>{children}</div>
      </div>
    );
  }
);
