import { GlobalSearch } from "./GlobalSearch";
import { api } from "@/api/client";

/** v2 header: 76px, white, hairline bottom. Left: the screen's subtitle +
 * H1 (portal slot, see layouts/PageHeader). Right: header search, then the
 * screen's actions (portal slot). `fallbackTitle` shows until a screen
 * mounts its own <PageHeader>. */
export function Header({
  fallbackTitle,
  showFallback,
  titleRef,
  actionsRef,
}: {
  fallbackTitle: string;
  showFallback: boolean;
  titleRef: (el: HTMLDivElement | null) => void;
  actionsRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <header className="flex min-h-[76px] shrink-0 flex-wrap items-center gap-x-5 gap-y-3 border-b border-line bg-white px-5 py-3 lg:flex-nowrap lg:px-8 lg:py-0">
      <div className="flex min-w-0 flex-col">
        {showFallback && <h1 className="truncate text-22 font-extrabold text-ink">{fallbackTitle}</h1>}
        {/* Portal target only: React never renders children into it directly. */}
        <div ref={titleRef} className="flex min-w-0 flex-col gap-0.5 empty:hidden" />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {api.capabilities.globalSearch && <GlobalSearch className="w-[220px] xl:w-[320px]" />}
        <div ref={actionsRef} className="flex shrink-0 items-center gap-2.5" />
      </div>
    </header>
  );
}
