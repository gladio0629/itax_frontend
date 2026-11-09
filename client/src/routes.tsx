import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { OnboardingScreen } from "@/features/onboarding/OnboardingScreen";
import { PhoneScreen } from "@/features/auth/PhoneScreen";
import { OtpScreen } from "@/features/auth/OtpScreen";
import { HomeScreen } from "@/features/home/HomeScreen";
import { OrderConfigureScreen } from "@/features/order/OrderConfigureScreen";
import { OrderTrackScreen } from "@/features/order/OrderTrackScreen";
import { OrderFinishedScreen } from "@/features/order/OrderFinishedScreen";
import { WalletScreen } from "@/features/wallet/WalletScreen";
import { CardsScreen } from "@/features/cards/CardsScreen";
import { CardLinkScreen } from "@/features/cards/CardLinkScreen";
import { ReferralScreen } from "@/features/bonus/ReferralScreen";
import { NotificationsScreen } from "@/features/notifications/NotificationsScreen";
import { HistoryScreen } from "@/features/history/HistoryScreen";
import { HistoryDetailScreen } from "@/features/history/HistoryDetailScreen";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";
import { HelpScreen } from "@/features/help/HelpScreen";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/auth/phone" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  const { isAuthenticated, onboardingSeen } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate to={isAuthenticated ? "/home" : onboardingSeen ? "/auth/phone" : "/onboarding"} replace />
        }
      />
      <Route path="/onboarding" element={<OnboardingScreen />} />
      <Route path="/auth/phone" element={<PhoneScreen />} />
      <Route path="/auth/otp" element={<OtpScreen />} />

      <Route path="/home" element={<RequireAuth><HomeScreen /></RequireAuth>} />
      <Route path="/order/configure" element={<RequireAuth><OrderConfigureScreen /></RequireAuth>} />
      <Route path="/order/track/:orderId" element={<RequireAuth><OrderTrackScreen /></RequireAuth>} />
      <Route path="/order/finished/:orderId" element={<RequireAuth><OrderFinishedScreen /></RequireAuth>} />

      <Route path="/wallet" element={<RequireAuth><WalletScreen /></RequireAuth>} />
      <Route path="/cards" element={<RequireAuth><CardsScreen /></RequireAuth>} />
      <Route path="/cards/link" element={<RequireAuth><CardLinkScreen /></RequireAuth>} />
      <Route path="/referral" element={<RequireAuth><ReferralScreen /></RequireAuth>} />

      <Route path="/notifications" element={<RequireAuth><NotificationsScreen /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryScreen /></RequireAuth>} />
      <Route path="/history/:orderId" element={<RequireAuth><HistoryDetailScreen /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfileScreen /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsScreen /></RequireAuth>} />
      <Route path="/help" element={<RequireAuth><HelpScreen /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
