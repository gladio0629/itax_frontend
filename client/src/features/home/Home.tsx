import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Car } from "@/lib/icons";
import { api } from "@/api/client";
import { DEMO_MODE } from "@/config";
import { EmptyState } from "@/components/EmptyState";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n/provider";

// The order-building flow (map, address search, quote, classes, seats…) is
// built on the sample address book: the contract has no cities, geocoding or
// quote endpoints yet (docs/backend-gaps.md). It's loaded only in the
// sample-data build, so the http build doesn't carry that data. When the
// backend gains those endpoints, drop the DEMO_MODE check and rely on
// api.capabilities.ordering alone.
const OrderingHome = DEMO_MODE ? lazy(() => import("./HomeScreen")) : null;

export function HomeScreen() {
  if (OrderingHome && api.capabilities.ordering) {
    return (
      <Suspense fallback={<div className="h-full bg-bg" />}>
        <OrderingHome />
      </Suspense>
    );
  }
  return <OrderingComingSoon />;
}

/** Home while ordering isn't available: a clean "Tez orada" state; the
 * rest of the app (history, notifications, settings) works as usual. */
function OrderingComingSoon() {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <div className="relative flex h-full flex-col bg-bg" style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}>
      <div className="flex items-center justify-end px-4">
        <Link
          to="/notifications"
          aria-label={t("home.notifications")}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-card text-ink shadow-[0_2px_12px_rgba(0,0,0,0.16)]"
        >
          <Bell className="h-5 w-5" />
        </Link>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="mb-2 h-14 w-14 overflow-hidden rounded-full">
          <Logo size={56} />
        </span>
        <EmptyState
          icon={<Car className="h-7 w-7" />}
          title={t("home.comingSoonTitle")}
          description={t("home.comingSoonDesc")}
          actionLabel={t("home.comingSoonHistory")}
          onAction={() => navigate("/history")}
        />
      </div>
    </div>
  );
}
