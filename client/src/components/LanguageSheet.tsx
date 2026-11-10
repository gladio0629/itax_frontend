import { Check } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { useT } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/provider";

const LOCALE_LABEL: Record<Locale, string> = { uz: "O'zbekcha", ru: "Русский", en: "English" };
const LOCALES: Locale[] = ["uz", "ru", "en"];

export function LanguageSheet({ onClose }: { onClose: () => void }) {
  const { locale, setLocale, t } = useT();
  return (
    <Sheet open onClose={onClose} ariaLabel={t("settings.language")}>
      <div className="px-5 pb-6 pt-3">
        <h2 className="mb-3 text-sm font-semibold text-ink">{t("settings.language")}</h2>
        <div className="space-y-1">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLocale(l);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left hover:bg-ink/5"
            >
              <span className="text-sm font-medium text-ink">{LOCALE_LABEL[l]}</span>
              {locale === l && <Check className="h-4 w-4 text-accent" />}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
