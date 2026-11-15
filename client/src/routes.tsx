import { Navigate, createBrowserRouter, createRoutesFromElements, Route } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { RootLayout } from "./App";
import { AppShell } from "@/components/AppShell";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { PhoneScreen } from "@/features/auth/PhoneScreen";
import { OtpScreen } from "@/features/auth/OtpScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/phone" replace />;
  return <>{children}</>;
}

function IndexRedirect() {
  const { isAuthenticated, onboardingSeen } = useAuthStore();
  return <Navigate to={isAuthenticated ? "/home" : onboardingSeen ? "/auth/phone" : "/onboarding"} replace />;
}

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>
      <Route path="/" element={<IndexRedirect />} />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route path="/auth/phone" element={<PhoneScreen />} />
      <Route path="/auth/otp" element={<OtpScreen />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/home" element={<HomeScreen />} />
        <Route path="/bonus" element={<BonusScreen />} />
        <Route path="/order/track/:orderId" element={<OrderTrackScreen />} />
        <Route path="/order/finished/:orderId" element={<OrderFinishedScreen />} />

        <Route path="/cards" element={<CardsScreen />} />
        <Route path="/cards/link" element={<CardLinkScreen />} />

        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:orderId" element={<HistoryDetailScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/account" element={<AccountScreen />} />
        <Route path="/settings/notifications" element={<NotificationsSettingsScreen />} />
        <Route path="/settings/about" element={<AboutScreen />} />
        <Route path="/settings/safety" element={<SafetySettingsScreen />} />
        <Route path="/help" element={<HelpScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Route>
  )
);
