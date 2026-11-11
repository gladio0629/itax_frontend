import { Suspense, useEffect } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { Toaster } from "@/components/Toaster";
import { SlowBanner } from "@/components/SlowBanner";
import { RouteFallback } from "@/components/RouteFallback";
import { useSession } from "@/stores/sessionStore";
import { AppRoutes } from "./routes";

export default function App() {
  const session = useSession((s) => s.session);
  const refresh = useSession((s) => s.refresh);
  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  return (
    <PhoneFrame>
      <div className="flex h-full flex-col">
        <SlowBanner />
        <div className="relative min-h-0 flex-1">
          {session ? (
            <Suspense fallback={<RouteFallback />}>
              <AppRoutes />
            </Suspense>
          ) : (
            <RouteFallback />
          )}
          <Toaster />
        </div>
      </div>
    </PhoneFrame>
  );
}
