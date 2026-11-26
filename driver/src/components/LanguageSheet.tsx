import { Check } from "@/lib/icons";
import { Sheet } from "./Sheet";
import { SUPPORTED_LOCALES, useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

export function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale, setLocale, t } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("profile.language")}>
      <div className="space-y-2 pb-2" role="radiogroup" aria-label={t("profile.language")}>
        {SUPPORTED_LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={locale === l}
            onClick={() => {
              setLocale(l);
              onClose();
            }}
            className="press flex h-14 w-full items-center justify-between rounded-button bg-raised px-4 text-left"
          >
            <span className="text-base text-ink" lang={l}>
              {t(`settings.languageName.${l}` as TranslationKey)}
            </span>
            {locale === l && <Check className="h-5 w-5 text-brand-ink" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
