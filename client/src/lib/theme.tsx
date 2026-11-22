import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { refreshStatusBar } from "@/ui/statusBar";

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

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

/**
 * Browser chrome (Safari's status/address bar tint) matches the page
 * background. Read from the resolved --color-bg so the platform's token set
 * (standard or iOS) decides the colour; both media-qualified theme-color
 * metas get it, because a manual override can differ from the system scheme.
 */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim();
  if (!bg) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

/**
 * Theme follows the device setting (prefers-color-scheme), live, until the
 * passenger flips the switch in Sozlamalar — that choice is stored and wins.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<Theme | null>(() => readStoredTheme());
  const [system, setSystem] = useState<Theme>(() => systemTheme());
  const theme = override ?? system;

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const update = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    syncThemeColor();
    refreshStatusBar();
  }, [theme]);

  const applyTheme = useCallback((next: Theme) => {
    const commit = () => {
      setOverride(next);
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
