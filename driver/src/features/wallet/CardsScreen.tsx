import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { CreditCard, Plus } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/Card";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { providerName } from "./ProviderTile";

export default function CardsScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const wallet = useQuery(() => api.getWallet(), []);
  const cards = wallet.data?.cards;

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("cards.title")} back="/wallet" />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {wallet.error ? (
          <ErrorState error={wallet.error} onRetry={() => wallet.reload()} />
        ) : !cards ? (
          <SkeletonList rows={2} label={t("common.loading")} />
        ) : cards.length === 0 ? (
          <EmptyState icon={CreditCard} title={t("cards.empty")} description={t("cards.emptyDesc")} />
        ) : (
          <>
            <SectionLabel>{t("cards.linked")}</SectionLabel>
            <ul className="space-y-3">
              {cards.map((c) => (
                <li
                  key={c.id}
                  className="relative flex h-24 flex-col justify-between overflow-hidden rounded-card p-4 text-white shadow-1"
                  style={{ background: c.brand === "humo" ? "linear-gradient(135deg,#0E6F6F,#0A4848)" : "linear-gradient(135deg,#264A9F,#152A61)" }}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold uppercase tracking-wide">{c.brand}</span>
                    <span className="text-white/80">{providerName(c.provider)}</span>
                  </div>
                  <p className="tabular text-xl font-bold tracking-wider">{t("cards.ending", { last4: c.last4 })}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-auto pt-6">
          <Button size="lg" fullWidth onClick={() => navigate("/wallet/cards/link")}>
            <Plus className="h-5 w-5" />
            {t("cards.link")}
          </Button>
        </div>
      </div>
    </div>
  );
}
