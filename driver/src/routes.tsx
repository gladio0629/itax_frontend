import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";

// Every screen is its own lazy chunk.
const HomeScreen = lazy(() => import("@/features/home/HomeScreen"));
const HistoryScreen = lazy(() => import("@/features/history/HistoryScreen"));
const TripDetailScreen = lazy(() => import("@/features/history/TripDetailScreen"));
const WalletScreen = lazy(() => import("@/features/wallet/WalletScreen"));
const TopupScreen = lazy(() => import("@/features/wallet/TopupScreen"));
const CardsScreen = lazy(() => import("@/features/wallet/CardsScreen"));
const CardLinkScreen = lazy(() => import("@/features/wallet/CardLinkScreen"));
const ProfileScreen = lazy(() => import("@/features/profile/ProfileScreen"));
const PersonalScreen = lazy(() => import("@/features/profile/PersonalScreen"));
const BonusScreen = lazy(() => import("@/features/profile/BonusScreen"));
const CapabilitiesScreen = lazy(() => import("@/features/profile/CapabilitiesScreen"));
const NotificationPrefsScreen = lazy(() => import("@/features/profile/NotificationPrefsScreen"));
const HelpScreen = lazy(() => import("@/features/profile/HelpScreen"));
const AboutScreen = lazy(() => import("@/features/profile/AboutScreen"));
const TripChatScreen = lazy(() => import("@/features/chat/TripChatScreen"));
const DemoScreen = lazy(() => import("@/features/demo/DemoScreen"));
const RegistrationFlow = lazy(() => import("@/features/registration/RegistrationFlow"));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<RegistrationFlow />} />
      {/* Demo panel is also reachable while signed out (from the registration header). */}
      <Route path="/demo" element={<DemoScreen />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/trip/chat" element={<TripChatScreen />} />
        <Route path="/history" element={<HistoryScreen />} />
        <Route path="/history/:tripId" element={<TripDetailScreen />} />
        {/* Old "Buyurtmalar" links. */}
        <Route path="/orders/*" element={<Navigate to="/history" replace />} />
        <Route path="/wallet" element={<WalletScreen />} />
        <Route path="/wallet/topup" element={<TopupScreen />} />
        <Route path="/wallet/cards" element={<CardsScreen />} />
        <Route path="/wallet/cards/link" element={<CardLinkScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/personal" element={<PersonalScreen />} />
        <Route path="/profile/bonus" element={<BonusScreen />} />
        <Route path="/profile/capabilities" element={<CapabilitiesScreen />} />
        <Route path="/profile/notifications" element={<NotificationPrefsScreen />} />
        <Route path="/profile/help" element={<HelpScreen />} />
        <Route path="/profile/about" element={<AboutScreen />} />
        <Route path="/profile/demo" element={<DemoScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
