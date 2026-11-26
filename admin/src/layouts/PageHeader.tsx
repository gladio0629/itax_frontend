import { createContext, useContext, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import type { To } from "react-router-dom";
import { BackButton } from "@/components/BackButton";

/** Header slots owned by AdminLayout; screens fill them with <PageHeader>. */
type Slots = {
  titleEl: HTMLElement | null;
  actionsEl: HTMLElement | null;
  /** How many <PageHeader>s are mounted (0 = layout shows its fallback title). */
  claim: () => () => void;
};

export const PageHeaderContext = createContext<Slots | null>(null);

/** The layout's side: slot elements + a mount counter. */
export function usePageHeaderSlots() {
  const [titleEl, setTitleEl] = useState<HTMLElement | null>(null);
  const [actionsEl, setActionsEl] = useState<HTMLElement | null>(null);
  const [claims, setClaims] = useState(0);
  const claim = () => {
    setClaims((n) => n + 1);
    return () => setClaims((n) => n - 1);
  };
  return { titleEl, actionsEl, setTitleEl, setActionsEl, claimed: claims > 0, claim };
}

/**
 * A screen's header: small line above (date, description or breadcrumb),
 * the H1, and actions on the right (period, Eksport, "Xodim qo'shish"…).
 * Rendered into AdminLayout's header through portals, so every route,
 * including /orders/:id, sets its own title.
 * `back`: a page reached from another page shows "← Orqaga" beside the
 * small line; the value is the parent route for direct links.
 */
export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: To }) {
  const slots = useContext(PageHeaderContext);
  const claim = slots?.claim;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => claim?.(), []);
  if (!slots) return null;
  return (
    <>
      {slots.titleEl &&
        createPortal(
          <>
            {back !== undefined ? (
              <span className="flex min-w-0 items-center gap-4">
                <BackButton to={back} />
                {subtitle && <span className="truncate text-13 font-semibold text-muted">{subtitle}</span>}
              </span>
            ) : (
              subtitle && <span className="truncate text-13 font-semibold text-muted">{subtitle}</span>
            )}
            <h1 className="truncate text-22 font-extrabold text-ink">{title}</h1>
          </>,
          slots.titleEl
        )}
      {slots.actionsEl && actions && createPortal(actions, slots.actionsEl)}
    </>
  );
}
