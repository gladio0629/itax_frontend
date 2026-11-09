import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Plus } from "lucide-react";
import { api } from "@/api/client";
import type { SavedCard } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomBar } from "@/components/BottomBar";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";

const BRAND_LABEL: Record<SavedCard["brand"], string> = {
  uzcard: "Uzcard",
  humo: "Humo",
  visa: "Visa",
};

export function CardsScreen() {
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
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Kartalarim" />
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {error ? (
          <ErrorState onRetry={load} />
        ) : cards === null ? (
          <SkeletonList count={2} />
        ) : cards.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-7 w-7" />}
            title="Hali karta qo'shilmagan"
            description="Kartangizni bog'lab, buyurtmalar uchun onlayn to'lov qilishingiz mumkin."
          />
        ) : (
          <div className="space-y-3">
            {cards.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-softer">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-10 text-accent">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">{c.label}</p>
                  <p className="text-xs text-ink/60 tabular">
                    {BRAND_LABEL[c.brand]} &middot; &bull;&bull;&bull;&bull; {c.last4}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomBar>
        <Button fullWidth variant="secondary" onClick={() => navigate("/cards/link")}>
          <Plus className="h-4 w-4" /> Yangi karta qo'shish
        </Button>
      </BottomBar>
    </div>
  );
}
