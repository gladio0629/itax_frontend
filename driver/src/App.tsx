import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Toaster } from "@/components/Toaster";
import { DEMO_MODE } from "@/config";
import { RouteFallback } from "@/components/RouteFallback";
import { ErrorState } from "@/components/ErrorState";
import { useSession } from "@/stores/sessionStore";
import { AppRoutes } from "./routes";
import { ChunkBoundary } from "@/components/ChunkBoundary";
import { useT } from "@/lib/i18n/provider";
import { api } from "@/api/client";

// The "slow internet" banner follows a test-panel switch: sample-data mode
// only, so the http build doesn't carry the test-panel store.
const SlowBanner = DEMO_MODE ? lazy(() => import("@/components/SlowBanner").then((m) => ({ default: m.SlowBanner }))) : null;

export default function App() {
  const session = useSession((s) => s.session);
  const refresh = useSession((s) => s.refresh);
  const setSession = useSession((s) => s.set);
  const navigate = useNavigate();
  const { t } = useT();
  const [bootError, setBootError] = useState<unknown>(null);

  const boot = useCallback(() => {
    setBootError(null);
    refresh().catch((e) => setBootError(e));
  }, [refresh]);

  useEffect(boot, [boot]);

  // Session expired or revoked by the server: back to sign-in.
  useEffect(
    () =>
      api.onSessionEnd(() => {
        setSession({ stage: "signed_out" });
        navigate("/register", { replace: true });
      }),
    [setSession, navigate]
  );

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        {SlowBanner && (
          <Suspense fallback={null}>
            <SlowBanner />
          </Suspense>
        )}
        <div className="relative min-h-0 flex-1">
          {session ? (
            <ChunkBoundary title={t("error.loadTitle")} action={t("common.retry")}>
              <Suspense fallback={<RouteFallback />}>
                <AppRoutes />
              </Suspense>
            </ChunkBoundary>
          ) : bootError ? (
            <div className="flex h-full items-center justify-center">
              <ErrorState error={bootError} onRetry={boot} />
            </div>
          ) : (
            <RouteFallback />
          )}
          <div id="overlay-root" />
          <Toaster />
        </div>
      </div>
    </PhoneFrame>
  );
}
