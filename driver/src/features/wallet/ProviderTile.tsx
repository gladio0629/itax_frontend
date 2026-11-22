import type { LinkedCard, PayProvider } from "@/api/types";
import { cn } from "@/lib/cn";

// Neutral wordmark tiles (no third-party logo assets), colours from the design tokens.
const STYLE: Record<PayProvider, { tile: string; label: string; mark: string }> = {
  payme: { tile: "bg-payme text-night", label: "Payme", mark: "PAY" },
  click: { tile: "bg-click text-white", label: "Click", mark: "CLK" },
};

export function providerName(p: PayProvider) {
  return STYLE[p].label;
}

/** 44 px tile with the provider's short mark (or the card brand for a saved card). */
export function ProviderTile({ provider, card }: { provider?: PayProvider; card?: LinkedCard }) {
  const s = provider ? STYLE[provider] : null;
  return (
    <span
      aria-hidden="true"
      translate="no"
      className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-tile text-xs font-extrabold", card ? "bg-night text-brand" : s?.tile)}
    >
      {card ? (card.brand === "humo" ? "HU" : "UZ") : s?.mark}
    </span>
  );
}
