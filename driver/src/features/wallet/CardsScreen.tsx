import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { CreditCard, Plus } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { SectionLabel } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { ProviderTile, providerName } from "./ProviderTile";

/** Linked cards (tokens from the provider; only brand and last 4 digits here) and "Karta ulash". */
export default function CardsScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const wallet = useQuery(() => api.getWallet(), []);
  const cards = wallet.data?.cards;

  return (
    <Screen
      back="/wallet"
      title={t("cards.title")}
      footer={
        <Button size="lg" fullWidth onClick={() => navigate("/wallet/cards/link")} trailing={<Plus className="h-5 w-5" />}>
          {t("cards.link")}
        </Button>
      }
    >
      {wallet.error && !wallet.data ? (
        <ErrorState error={wallet.error} onRetry={() => wallet.reload()} />
      ) : !wallet.data ? (
        <SkeletonList rows={2} label={t("common.loading")} />
      ) : !cards ? (
        // The server sent no list at all: say nothing about whether cards are linked.
        <EmptyState icon={CreditCard} title={t("cards.listUnknown")} description={t("cards.emptyDesc")} />
      ) : cards.length === 0 ? (
        <EmptyState icon={CreditCard} title={t("cards.empty")} description={t("cards.emptyDesc")} />
      ) : (
        <>
          <SectionLabel>{t("cards.linked")}</SectionLabel>
          <ul className="flex flex-col gap-2.5">
            {cards.map((c) => (
              <li key={c.id} className="flex min-h-[68px] items-center gap-3.5 rounded-field bg-raised px-4">
                <ProviderTile card={c} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="tabular text-15 font-extrabold text-ink">
                    {c.brand === "humo" ? "Humo" : "Uzcard"} {t("cards.ending", { last4: c.last4 })}
                  </span>
                  <span className="text-xs font-semibold text-muted">{providerName(c.provider)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Screen>
  );
}
