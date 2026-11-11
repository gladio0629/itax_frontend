import type { PayProvider } from "@/api/types";

// Neutral wordmark tiles (no third-party logo assets).
const STYLE: Record<PayProvider, { bg: string; label: string }> = {
  payme: { bg: "bg-[#0E8C8C]", label: "Payme" },
  click: { bg: "bg-[#3B6FE0]", label: "Click" },
};

export function providerName(p: PayProvider) {
  return STYLE[p].label;
}

export function ProviderTile({ provider }: { provider: PayProvider }) {
  const s = STYLE[provider];
  return (
    <span aria-hidden="true" translate="no" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-button text-base font-bold text-white ${s.bg}`}>
      {s.label[0]}
    </span>
  );
}
