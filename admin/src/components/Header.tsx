import { GlobalSearch } from "./GlobalSearch";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import type { Section } from "@/api/types";
import { OpHeaderTools } from "@/features/ops/OpHeaderTools";

/** Sections the header search can return hits for. */
const SEARCHABLE: Section[] = ["orders", "drivers", "passengers", "staff"];

/** v2 header: 76px, white, hairline bottom. Left: the screen's subtitle +
 * H1 (portal slot, see layouts/PageHeader). Right: header search, then the
 * screen's actions (portal slot). Every screen renders <PageHeader>. */
export function Header({
  titleRef,
  actionsRef,
}: {
  titleRef: (el: HTMLDivElement | null) => void;
  actionsRef: (el: HTMLDivElement | null) => void;
}) {
  const { me } = usePermissions();
  const canSearch = api.capabilities.globalSearch && !!me?.sections.some((x) => SEARCHABLE.includes(x));
  // Operator windows: search opens "Qidiruv", bell opens "Mening vazifalarim".
  const operatorTools = !!me?.actions.includes("operatorWork");
  return (
    <header className="flex min-h-[76px] shrink-0 flex-wrap items-center gap-x-5 gap-y-3 border-b border-line bg-white px-5 py-3 lg:flex-nowrap lg:px-8 lg:py-0">
      <div className="flex min-w-0 flex-col">
        {/* Portal target only: React never renders children into it directly. */}
        <div ref={titleRef} className="flex min-w-0 flex-col gap-0.5 empty:hidden" />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-3">
        {canSearch && <GlobalSearch className="w-[220px] xl:w-[320px]" />}
        {operatorTools && <OpHeaderTools />}
        <div ref={actionsRef} className="flex shrink-0 items-center gap-2.5" />
      </div>
    </header>
  );
}
