import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "izgo_client_theme";

type ThemeCtx = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? systemTheme());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const applyTheme = useCallback((next: Theme) => {
    const commit = () => {
      setThemeState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // ignore — theme just won't persist
      }
    };

    const doc = document as ViewTransitionDocument;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (typeof doc.startViewTransition === "function" && !reducedMotion) {
      document.documentElement.dataset.transition = "theme";
      doc.startViewTransition(commit);
    } else {
      commit();
    }
  }, []);

  const toggleTheme = useCallback(() => {
    applyTheme(theme === "dark" ? "light" : "dark");
  }, [theme, applyTheme]);

  const value = useMemo<ThemeCtx>(
    () => ({ theme, setTheme: applyTheme, toggleTheme }),
    [theme, applyTheme, toggleTheme]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
