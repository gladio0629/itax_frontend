import { useEffect, useState } from "react";
import { Banknote, CreditCard, Plus } from "@/lib/icons";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { PayMethod, PaymentMethod, SavedCard } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { RadioRow } from "@/components/ui/RadioRow";
import type { LucideIcon } from "@/lib/icons";

function PayTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="flex h-[var(--size-tile)] w-[var(--size-tile)] shrink-0 items-center justify-center rounded-tile bg-fill text-ink/70" aria-hidden="true">
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function PaymentMethodSection({
  value,
  onChange,
}: {
  value: PayMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  const { t } = useT();
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [cardsError, setCardsError] = useState(false);
  const [cardsReload, setCardsReload] = useState(0);

  useEffect(() => {
    // No saved-cards list on the real backend yet (capabilities.savedCards).
    if (value !== "card" || !api.capabilities.savedCards) return;
    setCardsError(false);
    api.getSavedCards().then(setCards).catch(() => setCardsError(true));
  }, [value, cardsReload]);

  return (
    <div className="space-y-3">
      {/* Radio rows with the round check on the right (reference style). */}
      <div role="radiogroup" aria-label={t("order.step.payment")}>
        <RadioRow
          checked={value === "cash"}
          onSelect={() => onChange("cash")}
          leading={<PayTile icon={Banknote} />}
          title={t("order.cash")}
        />
        <RadioRow
          checked={value === "card"}
          onSelect={() => onChange("card")}
          leading={<PayTile icon={CreditCard} />}
          title={t("order.card")}
          last
        />
      </div>

      {value === "card" && api.capabilities.savedCards && (
        <div className="ml-4 space-y-2">
          {cardsError && (
            <button onClick={() => setCardsReload((n) => n + 1)} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
              {t("common.loadFailedRetry")}
            </button>
          )}
          {cards.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-control bg-fill px-3 py-2.5">
              <span className="text-xs font-normal text-ink/80">{`${c.label} •••• ${c.last4}`}</span>
            </div>
          ))}
          <Link
            to="/cards/link"
            className="flex h-[var(--size-chip)] w-fit items-center gap-1.5 rounded-chip bg-fill px-3.5 text-sub font-medium text-accent"
          >
            <Plus className="h-3.5 w-3.5" /> {t("order.linkCard")}
          </Link>
        </div>
      )}

      <p className="pt-2 text-sub text-ink/60">{t("order.paymentSystems")}</p>
      <div className="flex gap-2">
        {["Payme", "Click"].map((label) => (
          <div key={label} translate="no" className="flex h-[var(--size-chip)] flex-1 items-center justify-center rounded-chip bg-fill text-sub font-medium text-ink/70">
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
