import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { SavedCard } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { Icon, PrimaryButton, Screen, StateEmpty, StateError, StateLoading } from "@/ui";

const BRAND_LABEL: Record<SavedCard["brand"], string> = {
  uzcard: "Uzcard",
  humo: "Humo",
  visa: "Visa",
};

/** Saved cards (opened from Payment → "Karta"), design v2. */
export function CardsScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [error, setError] = useState(false);

  function load() {
    setError(false);
    setCards(null);
    api.getSavedCards().then(setCards).catch(() => setError(true));
  }

  useEffect(load, []);

  return (
    <Screen
      title={t("cards.title")}
      footer={
        <PrimaryButton icon="plus" onClick={() => navigate("/cards/link")}>
          {t("cards.addNew")}
        </PrimaryButton>
      }
    >
      {error ? (
        <StateError onRetry={load} />
      ) : cards === null ? (
        <StateLoading rows={2} />
      ) : cards.length === 0 ? (
        <StateEmpty title={t("cards.emptyTitle")} description={t("cards.emptyDesc")} />
      ) : (
        <ul className="flex flex-col">
          {cards.map((c, i) => (
            <li key={c.id} className={i < cards.length - 1 ? "flex min-h-[68px] items-center gap-3.5 border-b border-iz-border py-3" : "flex min-h-[68px] items-center gap-3.5 py-3"}>
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-green-soft text-iz-green-text">
                <Icon name="card" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[15px] font-extrabold text-iz-ink">{c.label}</span>
                <span className="text-[13px] tabular-nums text-iz-muted">
                  {BRAND_LABEL[c.brand]} · •••• {c.last4}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
