import { Car, Star, UserPlus, type LucideIcon } from "@/lib/icons";
import type { BonusSource, BonusSourceIcon } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatSom } from "@/lib/format";

const SOURCE_ICON: Record<BonusSourceIcon, LucideIcon> = {
  order: Car,
  invite: UserPlus,
  rate: Star,
};

const ACTION_LABEL_KEY: Record<BonusSource["action"], TranslationKey> = {
  goto_order: "bonus.action.gotoOrder",
  invite: "bonus.action.invite",
  rate_trip: "bonus.action.rateTrip",
};

export function BonusDetailSheet({
  source,
  onClose,
  onAction,
}: {
  source: BonusSource;
  onClose: () => void;
  onAction: () => void;
}) {
  const { t, intlTag } = useT();
  const Icon = SOURCE_ICON[source.icon];

  return (
    <Sheet open onClose={onClose} ariaLabel={t(source.titleKey as TranslationKey)}>
      <div className="px-5 pb-6 pt-3">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-yellow text-on-yellow">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">{t(source.titleKey as TranslationKey)}</h2>
            <p className="text-xs text-ink/60">
              {formatSom(source.amountThisMonth, intlTag)} {t("bonus.thisMonth")}
            </p>
          </div>
        </div>
        <p className="mb-5 text-sm text-ink/70">{t(source.descriptionKey as TranslationKey)}</p>
        <Button fullWidth onClick={onAction}>
          {t(ACTION_LABEL_KEY[source.action])}
        </Button>
      </div>
    </Sheet>
  );
}
