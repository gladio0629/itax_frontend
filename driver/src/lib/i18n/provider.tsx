import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { uz, type Dictionary, type TranslationKey } from "./uz";
import { ru } from "./ru";
import { en } from "./en";

export type Locale = "uz" | "ru" | "en";
export type { TranslationKey };

const DICTS: Record<Locale, Dictionary> = { uz, ru, en };
const INTL_TAG: Record<Locale, string> = { uz: "uz-Latn", ru: "ru-RU", en: "en-US" };
const STORAGE_KEY = "izgo_driver_locale";
export const SUPPORTED_LOCALES: Locale[] = ["uz", "ru", "en"];

type TFn = (key: TranslationKey, params?: Record<string, string | number>) => string;
type LocaleCtx = { locale: Locale; setLocale: (l: Locale) => void; t: TFn; intlTag: string };
const Ctx = createContext<LocaleCtx | null>(null);

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LOCALES.includes(v as Locale) ? (v as Locale) : null;
  } catch {
    return null;
  }
}

function interpolate(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{\\{${k}\\}\\}`, "g"), String(v)),
    template
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readStored() ?? "uz");
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* not persisted */
    }
  }, []);
  const t = useCallback<TFn>(
    (key, params) => interpolate(DICTS[locale][key] ?? uz[key] ?? key, params),
    [locale]
  );
  const value = useMemo(() => ({ locale, setLocale, t, intlTag: INTL_TAG[locale] }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useT must be used within LanguageProvider");
  return ctx;
}

/** Translate a key that arrives as a plain string from the adapter. */
export function isKey(key: string): key is TranslationKey {
  return key in uz;
}
