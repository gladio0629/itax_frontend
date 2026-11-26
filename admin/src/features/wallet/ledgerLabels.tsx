import { ArrowDownLeft, ArrowUpRight, Banknote, CreditCard, Gift, HandCoins, Percent, Scale, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import type { WalletEntryType } from "@/api/types";

export const LEDGER_KIND: Record<WalletEntryType, { label: string; tile: string; icon: typeof Percent }> = {
  topup: { label: "To'ldirish", tile: "bg-green-soft text-green-text", icon: ArrowDownLeft },
  commission: { label: "Komissiya", tile: "bg-surface text-ink", icon: Percent },
  tip: { label: "Choy puli", tile: "bg-green-soft text-green-text", icon: HandCoins },
  adjustment: { label: "Tuzatish", tile: "bg-info-soft text-info", icon: Scale },
  penalty: { label: "Jarima", tile: "bg-error-soft text-error", icon: TriangleAlert },
  cash: { label: "Naqd safar", tile: "bg-surface text-ink", icon: Banknote },
  card: { label: "Karta safar", tile: "bg-surface text-ink", icon: CreditCard },
  trip_payment: { label: "Safar to'lovi", tile: "bg-surface text-ink", icon: ArrowUpRight },
  bonus: { label: "Bonus", tile: "bg-warn-soft text-warn", icon: Gift },
};

/** Chips in the design's order; only kinds this backend reports are shown. */
export const LEDGER_CHIP_ORDER: WalletEntryType[] = ["topup", "commission", "tip", "adjustment", "penalty"];

export function LedgerKindCell({ kind }: { kind: WalletEntryType }) {
  const k = LEDGER_KIND[kind];
  return (
    <span className="inline-flex items-center gap-2.5 font-bold">
      <span aria-hidden className={cn("inline-flex h-8 w-8 items-center justify-center rounded-[10px]", k.tile)}>
        <k.icon className="h-4 w-4" />
      </span>
      {k.label}
    </span>
  );
}

/** Short display id: real ids are UUIDs (first 8 chars); sample ids look
 * like "wal_drv_06_5" → "L-06-5". */
export const entryNo = (id: string) =>
  id.startsWith("wal_") ? `L-${id.slice(4).replace(/^drv_/, "").replace(/_/g, "-")}` : `L-${id.slice(0, 8)}`;
