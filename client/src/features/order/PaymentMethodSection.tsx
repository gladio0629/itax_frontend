import { useEffect, useState } from "react";
import { Banknote, CreditCard, Plus } from "@/lib/icons";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { PaymentMethod, SavedCard } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

export function PaymentMethodSection({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  const { t } = useT();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsError, setCardsError] = useState(false);
  const [cardsReload, setCardsReload] = useState(0);

  useEffect(() => {
    if (value !== "card") return;
    setCardsError(false);
    api.getSavedCards().then(setCards).catch(() => setCardsError(true));
  }, [value, cardsReload]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onChange("cash")}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors",
          value === "cash" ? "border-accent bg-accent-5" : "border-border"
        )}
      >
        <Banknote className="h-5 w-5 text-ink/70" />
        <span className="text-sm font-semibold text-ink">{t("order.cash")}</span>
      </button>

      <button
        type="button"
        onClick={() => onChange("card")}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3.5 text-left transition-colors",
          value === "card" ? "border-accent bg-accent-5" : "border-border"
        )}
      >
        <CreditCard className="h-5 w-5 text-ink/70" />
        <span className="text-sm font-semibold text-ink">{t("order.card")}</span>
      </button>

      {value === "card" && (
        <div className="ml-4 space-y-2">
          {cardsError && (
            <button onClick={() => setCardsReload((n) => n + 1)} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
              {t("common.loadFailedRetry")}
            </button>
          )}
          {cards.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-xl bg-card px-3 py-2.5 shadow-softer">
              <span className="text-xs font-normal text-ink/80">{`${c.label} •••• ${c.last4}`}</span>
            </div>
          ))}
          <Link
            to="/cards/link"
            className="flex items-center gap-2 rounded-xl border border-dashed border-accent/40 px-3 py-2.5 text-xs font-semibold text-accent"
          >
            <Plus className="h-3.5 w-3.5" /> {t("order.linkCard")}
          </Link>
        </div>
      )}

      <p className="pt-2 text-xs font-semibold text-ink/60">{t("order.paymentSystems")}</p>
      <div className="flex gap-2">
        {["Payme", "Click"].map((label) => (
          <div key={label} translate="no" className="flex-1 rounded-xl border border-border px-4 py-3 text-center text-xs font-semibold text-ink/60">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
