import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { uz, type Dictionary, type TranslationKey } from "./uz";
import { ru } from "./ru";
import { en } from "./en";

export type Locale = "uz" | "ru" | "en";

const DICTS: Record<Locale, Dictionary> = { uz, ru, en };
const INTL_TAG: Record<Locale, string> = { uz: "uz-Latn", ru: "ru-RU", en: "en-US" };
const STORAGE_KEY = "izgo_client_locale";
const LOCALES: Locale[] = ["uz", "ru", "en"];

type LocaleCtx = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  intlTag: string;
};

const Ctx = createContext<LocaleCtx | null>(null);

function readStoredLocale(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return LOCALES.includes(value as Locale) ? (value as Locale) : null;
  } catch {
    return null;
  }
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value)),
    template
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStoredLocale() ?? "uz");

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable (private mode) — locale just won't persist
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      const dict = DICTS[locale];
      const template = dict[key] ?? uz[key] ?? key;
      return interpolate(template, params);
    },
    [locale]
  );

  const value = useMemo<LocaleCtx>(
    () => ({ locale, setLocale, t, intlTag: INTL_TAG[locale] }),
    [locale, setLocale, t]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT must be used within LanguageProvider");
  return ctx;
}

export const SUPPORTED_LOCALES = LOCALES;
