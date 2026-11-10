import { ArrowUpDown } from "lucide-react";
import type { Address } from "@/api/types";
import { useT } from "@/lib/i18n/provider";

function RouteRow({ dotClass, label, value, onClick }: { dotClass: string; label: string; value: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-[56px] w-full items-center gap-3 px-2 py-2 text-left hover:bg-ink/5">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-ink/60">{label}</span>
        <span className="block truncate text-sm font-semibold text-ink">{value}</span>
      </span>
    </button>
  );
}

/** From/to fields with the swap control in its own column, so it never sits on top of either row's hit area. */
export function RouteFields({
  from,
  to,
  onPick,
  onSwap,
}: {
  from: Address | null;
  to: Address | null;
  onPick: (which: "from" | "to") => void;
  onSwap: () => void;
}) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent-5 p-3">
      <div className="min-w-0 flex-1 divide-y divide-border">
        <RouteRow dotClass="bg-ink" label={t("order.from")} value={from?.label ?? t("order.choosePlace")} onClick={() => onPick("from")} />
        <RouteRow dotClass="bg-brand-yellow ring-1 ring-on-yellow/40" label={t("order.to")} value={to?.label ?? t("order.choosePlace")} onClick={() => onPick("to")} />
      </div>
      <button
        onClick={onSwap}
        aria-label={t("order.swap")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-card text-accent shadow-softer active:scale-95"
      >
        <ArrowUpDown className="h-4 w-4" />
      </button>
    </div>
  );
}
