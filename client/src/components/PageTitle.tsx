import type { ReactNode } from "react";
import { useIsIOS } from "@/lib/platform";
import { NavBar } from "@/components/ios/NavBar";

/**
 * Title row for top-level screens. Shares the 44px row (safe-top + 16px) with
 * AppShell's floating hamburger, so the title is vertically centred on it and
 * content below starts 8px under the hamburger rather than beside it.
 *
 * iOS: a navigation bar with a collapsing Large Title instead (plus an
 * optional accessory such as a segmented control).
 */
export function PageTitle({
  children,
  right,
  accessory,
  scrollKey,
}: {
  children: ReactNode;
  right?: ReactNode;
  /** iOS only: control pinned under the large title (e.g. History tabs). */
  accessory?: ReactNode;
  /** iOS only: changes when a different scroll area becomes visible. */
  scrollKey?: string | number;
}) {
  if (useIsIOS()) {
    return <NavBar large title={String(children)} right={right} accessory={accessory} scrollKey={scrollKey} />;
  }
  return (
    <div
      className="mb-2 flex h-11 shrink-0 items-center justify-between gap-2 pl-[68px] pr-4"
      style={{ marginTop: "calc(var(--safe-top) + 16px)" }}
    >
      <h1 className="min-w-0 truncate text-lg font-semibold text-ink">{children}</h1>
      {right}
    </div>
  );
}
