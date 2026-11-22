import { lazy, Suspense } from "react";
import { Navigate, createBrowserRouter, createRoutesFromElements, Route } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { RootLayout } from "./App";
import { AppShell } from "@/components/AppShell";
import { PhoneScreen } from "@/features/auth/PhoneScreen";
import { OtpScreen } from "@/features/auth/OtpScreen";
import { HomeScreen } from "@/features/home/Home";
import { api } from "@/api/client";
import type { ClientCapabilities } from "@/api/types";
import { OrderTrackScreen } from "@/features/order/OrderTrackScreen";
import { OrderFinishedScreen } from "@/features/order/OrderFinishedScreen";
import { BonusScreen } from "@/features/bonus/BonusScreen";
import { CardsScreen } from "@/features/cards/CardsScreen";
import { CardLinkScreen } from "@/features/cards/CardLinkScreen";
import { NotificationsScreen } from "@/features/notifications/NotificationsScreen";
import { HistoryScreen } from "@/features/history/HistoryScreen";
import { HistoryDetailScreen } from "@/features/history/HistoryDetailScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { AccountScreen } from "@/features/settings/AccountScreen";
import { NotificationsSettingsScreen } from "@/features/settings/NotificationsSettingsScreen";
import { AboutScreen } from "@/features/settings/AboutScreen";
import { SafetySettingsScreen } from "@/features/settings/SafetySettingsScreen";
import { HelpScreen } from "@/features/help/HelpScreen";
import { LanguageScreen } from "@/features/settings/LanguageScreen";

// Design v2 kit gallery: dev server only (tree-shaken from every build).
const UiGallery = import.meta.env.DEV ? lazy(() => import("@/dev/UiGallery")) : null;

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/phone" replace />;
  return <>{children}</>;
}

/** A screen the active adapter can't serve (no endpoint yet) isn't
 * reachable: an old link or bookmark lands on Home instead. */
function When({ can, children }: { can: keyof ClientCapabilities; children: React.ReactNode }) {
  return api.capabilities[can] ? <>{children}</> : <Navigate to="/home" replace />;
}

function IndexRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return <Navigate to={isAuthenticated ? "/home" : "/auth/phone"} replace />;
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route path="/" element={<IndexRedirect />} />
      <Route path="/auth/phone" element={<PhoneScreen />} />
      <Route path="/auth/otp" element={<OtpScreen />} />
      {/* Reachable signed out (login) and signed in (Settings). */}
      <Route path="/language" element={<LanguageScreen />} />
      {UiGallery && (
        <Route
          path="/dev/ui"
          element={
            <Suspense fallback={null}>
              <UiGallery />
            </Suspense>
          }
        />
      )}

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/bonus" element={<When can="bonuses"><BonusScreen /></When>} />
        <Route path="/order/track/:orderId" element={<OrderTrackScreen />} />
        <Route path="/order/finished/:orderId" element={<OrderFinishedScreen />} />

        <Route path="/cards" element={<When can="savedCards"><CardsScreen /></When>} />
        <Route path="/cards/link" element={<When can="savedCards"><CardLinkScreen /></When>} />

        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:orderId" element={<HistoryDetailScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/account" element={<AccountScreen />} />
        <Route path="/settings/notifications" element={<NotificationsSettingsScreen />} />
        <Route path="/settings/about" element={<AboutScreen />} />
        <Route path="/settings/safety" element={<When can="safety"><SafetySettingsScreen /></When>} />
        <Route path="/help" element={<When can="help"><HelpScreen /></When>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);
