import { useCallback, useEffect, useState, type ReactNode } from "react";
import { probeDevBackend } from "@shared/http/devProbe";
import { apiConfig, DEMO_MODE } from "@/config";
import { useT } from "@/lib/i18n/provider";
import { WifiOff, RotateCw } from "@/lib/icons";
import { Button } from "./Button";

type GateState = "ok" | "checking" | "down";

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
    // Only the dev proxy is probed; production builds drop this branch.
    if (!import.meta.env.DEV) return setState("ok");
    setState("checking");
    probeDevBackend().then((reachable) => setState(reachable ? "ok" : "down"));
  }, []);

  useEffect(() => {
    if (initialState() === "checking") check();
  }, [check]);

  if (state === "ok") return <>{children}</>;
  return <NoServerScreen checking={state === "checking"} onRetry={check} />;
}

function NoServerScreen({ checking, onRetry }: { checking: boolean; onRetry: () => void }) {
  const { t } = useT();
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 px-8 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
        <WifiOff className="h-7 w-7" />
      </div>
      <p role="alert" className="max-w-[300px] text-base font-semibold text-ink">
        {t("noServer.message")}
      </p>
      <Button variant="secondary" size="sm" onClick={onRetry} loading={checking}>
        <RotateCw className="h-4 w-4" />
        {t("common.retry")}
      </Button>
    </main>
  );
}
