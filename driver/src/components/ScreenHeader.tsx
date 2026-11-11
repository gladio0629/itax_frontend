import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { DemoBadge } from "./DemoBadge";

/**
 * Sub-pages get a back arrow; tab roots don't. Titles are left-aligned at
 * the same baseline either way. Actions live in the screen body (thumb zone),
 * so the right slot only carries the demo badge or a minor control.
 */
export function ScreenHeader({ title, back, right }: { title: string; back?: string | true; right?: ReactNode }) {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <header className="flex shrink-0 items-center gap-1 px-2" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
      {back ? (
        <button
          type="button"
          onClick={() => {
            if (back === true && window.history.state?.idx > 0) navigate(-1);
            else navigate(back === true ? "/" : back, { replace: true });
          }}
          aria-label={t("common.back")}
          className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-button text-ink"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      ) : (
        <span className="w-2 shrink-0" />
      )}
      <h1 className="min-w-0 flex-1 truncate py-3 text-xl font-bold text-ink">{title}</h1>
      <div className="flex shrink-0 items-center pr-2">{right ?? <DemoBadge />}</div>
    </header>
  );
}
