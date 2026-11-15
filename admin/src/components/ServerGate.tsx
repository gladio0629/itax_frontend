import { useCallback, useEffect, useState, type ReactNode } from "react";
import { WifiOff, RotateCw } from "lucide-react";
import { probeDevBackend } from "@shared/http/devProbe";
import { apiConfig, DEMO_MODE } from "@/config";
import { Button } from "./Button";

type GateState = "ok" | "checking" | "down";

// The admin UI is Uzbek-only; this one screen follows the browser language.
const TEXT = {
  uz: { message: "Server bilan aloqa yo'q. Keyinroq urinib ko'ring.", retry: "Qayta urinish" },
  ru: { message: "Нет связи с сервером. Попробуйте позже.", retry: "Повторить" },
  en: { message: "No connection to the server. Please try again later.", retry: "Try again" },
} as const;

function browserText() {
  const lang = (typeof navigator !== "undefined" ? navigator.language : "uz").slice(0, 2).toLowerCase();
  return lang === "ru" || lang === "en" ? TEXT[lang] : TEXT.uz;
}

function initialState(): GateState {
  if (DEMO_MODE) return "ok";
  if (!apiConfig.configured) return "down";
  return apiConfig.viaDevProxy ? "checking" : "ok";
}

/**
 * Shows the full-screen "no server" state instead of the app when there is
 * no backend to talk to: a production build without VITE_API_URL, or the
 * dev proxy target not answering. Everything else renders the app as is.
 */
export function ServerGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(initialState);

  const check = useCallback(() => {
    // Nothing to probe without a URL; a reload picks up a new deploy.
    if (!apiConfig.configured) return window.location.reload();
    setState("checking");
    probeDevBackend().then((reachable) => setState(reachable ? "ok" : "down"));
  }, []);

  useEffect(() => {
    if (initialState() === "checking") check();
  }, [check]);

  if (state === "ok") return <>{children}</>;
  const text = browserText();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-8 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-card bg-danger/10 text-danger" aria-hidden>
        <WifiOff className="h-7 w-7" />
      </div>
      <p role="alert" className="max-w-sm text-base font-semibold text-ink">
        {text.message}
      </p>
      <Button variant="secondary" size="sm" onClick={check} loading={state === "checking"}>
        <RotateCw className="h-4 w-4" />
        {text.retry}
      </Button>
    </main>
  );
}
