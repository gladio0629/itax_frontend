import { Hourglass } from "@/lib/icons";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { EmptyState } from "./EmptyState";
import { ScreenHeader } from "./ScreenHeader";

/** "Tez orada": a feature the connected backend doesn't offer yet
 * (adapter capability off). Never a broken or half-empty screen. */
export function ComingSoon({ titleKey, back }: { titleKey?: TranslationKey; back?: string | true }) {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col">
      {titleKey && <ScreenHeader title={t(titleKey)} back={back} />}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <EmptyState icon={Hourglass} title={t("soon.title")} description={t("soon.desc")} />
      </div>
    </div>
  );
}
