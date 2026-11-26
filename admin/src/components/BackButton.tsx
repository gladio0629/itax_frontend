import { useNavigate } from "react-router-dom";
import type { To } from "react-router-dom";
import { cn } from "@/lib/cn";

/** True when the router has an earlier in-app entry to go back to.
 * BrowserRouter keeps `idx` in history.state; it survives replace-navigations
 * (e.g. `?q=` cleanup), unlike `location.key`. */
export function hasInAppHistory() {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

/** A parent route (used when the page was opened by a direct link), or a
 * close handler for an overlay opened over its own list. */
export type BackTarget = To | (() => void);

/** "← Orqaga" (design Verify): chevron + text, top-left above or beside the
 * title. With a route: goes to the previous page in history, else to `to`.
 * With a function: just calls it. */
export function BackButton({ to, className, disabled }: { to: BackTarget; className?: string; disabled?: boolean }) {
  const navigate = useNavigate();
  const go = () => {
    if (typeof to === "function") to();
    else if (hasInAppHistory()) navigate(-1);
    else navigate(to, { replace: true });
  };
  return (
    <button
      type="button"
      onClick={go}
      disabled={disabled}
      className={cn(
        // Small visual link; the ::before box keeps the touch target ≥ 44px.
        "relative inline-flex shrink-0 items-center gap-1.5 self-start rounded-md text-sm font-bold text-ink before:absolute before:-inset-x-2 before:-inset-y-3 before:content-[''] hover:underline disabled:opacity-50 disabled:hover:no-underline",
        className
      )}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Orqaga
    </button>
  );
}
