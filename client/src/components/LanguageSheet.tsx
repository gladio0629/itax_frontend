import { Check } from "@/lib/icons";
import { Sheet } from "@/components/Sheet";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/provider";
import { useIsIOS } from "@/lib/platform";
import { ActionSheet } from "@/components/ios/ActionSheet";

const LOCALE_LABEL: Record<Locale, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };
const LOCALES: Locale[] = ["uz", "ru", "en"];

export function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { locale, setLocale, t } = useT();
  if (useIsIOS()) {
    return (
      <ActionSheet
        open
        onClose={onClose}
        title={t("settings.language")}
        cancelLabel={t("common.cancel")}
        actions={LOCALES.map((l) => ({
          label: LOCALE_LABEL[l],
          checked: locale === l,
          onSelect: () => {
            setLocale(l);
            onClose();
          },
        }))}
      />
    );
  }
  return (
    <Sheet open onClose={onClose} ariaLabel={t("settings.language")}>
      <div className="px-5 pb-6 pt-3">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("settings.language")}</h2>
        <div className="space-y-2">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                onClose();
              }}
              className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-ink/5"
            >
              <span className="text-sm font-normal text-ink">{LOCALE_LABEL[l]}</span>
              {locale === l && <Check className="h-4 w-4 text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
