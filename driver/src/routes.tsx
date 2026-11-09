import { Navigate, Route, Routes } from "react-router-dom";
import { OffersScreen } from "@/features/offers/OffersScreen";
import { ActiveTripScreen } from "@/features/trip/ActiveTripScreen";
import { WalletScreen } from "@/features/wallet/WalletScreen";
import { WalletTopupScreen } from "@/features/wallet/WalletTopupScreen";
import { StatsScreen } from "@/features/stats/StatsScreen";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { RegistrationScreen } from "@/features/registration/RegistrationScreen";
import { NotificationsScreen } from "@/features/notifications/NotificationsScreen";
import { HistoryScreen } from "@/features/history/HistoryScreen";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/offers" replace />} />
      <Route path="/offers" element={<OffersScreen />} />
      <Route path="/trip/:orderId" element={<ActiveTripScreen />} />
      <Route path="/wallet" element={<WalletScreen />} />
      <Route path="/wallet/topup" element={<WalletTopupScreen />} />
      <Route path="/stats" element={<StatsScreen />} />
      <Route path="/profile" element={<ProfileScreen />} />
      <Route path="/register" element={<RegistrationScreen />} />
      <Route path="/notifications" element={<NotificationsScreen />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
