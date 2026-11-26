import { useRef, useState } from "react";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { useNavigate } from "react-router-dom";
import { useT, type Locale } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, IconButton, PrimaryButton, useStatusBar } from "@/ui";

const LOCALES: Locale[] = ["uz", "ru", "en"];

/** Globe drawn behind the title (design: Language). */
function GlobeArt() {
  return (
    <svg aria-hidden width="300" height="300" viewBox="0 0 300 300" fill="none" stroke="#17273B" strokeWidth="2" className="pointer-events-none absolute -right-[90px] top-10 block kb:hidden">
      <circle cx="150" cy="150" r="148" />
      <path d="M2 150h296M150 2c60 50 60 246 0 296M150 2c-60 50-60 246 0 296M24 76h252M24 224h252" />
    </svg>
  );
}

/**
 * App language (design: Language). Opened from the login screen and from
 * Settings; the choice applies on "Saqlash", back leaves it unchanged.
 */
export function LanguageScreen() {
  useStatusBar("light");
  const sheetRef = useRef<HTMLDivElement>(null);
  useLiftFloatingControl(sheetRef);
  const { t, locale, setLocale } = useT();
  const navigate = useNavigate();
  const [picked, setPicked] = useState<Locale>(locale);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/", { replace: true }));

  return (
    <div className="flex h-full flex-col bg-iz-head">
      <div className="relative flex min-h-0 flex-1 flex-col justify-between gap-6 overflow-hidden px-5 pb-6 pt-[calc(var(--safe-top)+12px)]">
        <GlobeArt />
        <IconButton icon="back" label={t("common.back")} onClick={back} className="relative" />
        <div className="relative flex flex-col gap-2.5">
          <h1 className="text-[32px] font-extrabold leading-10 text-iz-head-text">{t("language.title")}</h1>
          <p className="text-[15px] leading-[23px] text-iz-head-muted">{t("language.desc")}</p>
        </div>
      </div>

      <div ref={sheetRef} className="flex shrink-0 flex-col gap-2.5 rounded-t-iz-sheet bg-iz-sheet px-5 pb-[calc(max(var(--safe-bottom),16px)+12px)] pt-6">
        <div role="radiogroup" aria-label={t("language.title")} className="flex flex-col gap-2.5">
          {LOCALES.map((l) => {
            const selected = picked === l;
            return (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={selected}
                lang={l}
                onClick={() => setPicked(l)}
                className={cn(
                  "flex h-[72px] items-center gap-3.5 rounded-[22px] border-2 pl-3.5 pr-4 text-left transition-[background,box-shadow]",
                  selected
                    ? "border-iz-ink bg-iz-field-focus shadow-[0_0_0_4px_var(--iz-focus-ring)]"
                    : "border-transparent bg-iz-field"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile text-[13px] font-extrabold",
                    selected ? "bg-iz-selected text-iz-selected-accent" : "bg-iz-sheet text-iz-ink"
                  )}
                >
                  {t(`language.code.${l}` as TranslationKey)}
                </span>
                <span className={cn("flex-1 text-[16px] text-iz-ink", selected ? "font-extrabold" : "font-bold")}>
                  {t(`language.name.${l}` as TranslationKey)}
                </span>
                {selected ? (
                  <span aria-hidden className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-iz-selected text-iz-selected-accent">
                    <Icon name="check" size={14} strokeWidth={3.2} />
                  </span>
                ) : (
                  <span aria-hidden className="h-[26px] w-[26px] rounded-full border-2 border-iz-switch-off" />
                )}
              </button>
            );
          })}
        </div>
        <PrimaryButton
          className="mt-2.5"
          onClick={() => {
            setLocale(picked);
            back();
          }}
        >
          {t("common.save")}
        </PrimaryButton>
      </div>
    </div>
  );
}
