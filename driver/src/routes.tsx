import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { DEMO_MODE } from "@/config";
import { TEST_PANEL_PATH, TEST_PANEL_PROFILE_PATH } from "@/features/testPanel/paths";

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
const RoutesScreen = lazy(() => import("@/features/profile/RoutesScreen"));
const CapabilitiesScreen = lazy(() => import("@/features/profile/CapabilitiesScreen"));
const NotificationPrefsScreen = lazy(() => import("@/features/profile/NotificationPrefsScreen"));
const HelpScreen = lazy(() => import("@/features/profile/HelpScreen"));
const AboutScreen = lazy(() => import("@/features/profile/AboutScreen"));
const TripChatScreen = lazy(() => import("@/features/chat/TripChatScreen"));
// Test panel: sample-data mode only. DEMO_MODE is a build-time constant, so
// in the http build this branch (and the chunk it imports) is dropped.
const TestPanelScreen = DEMO_MODE ? lazy(() => import("@/features/testPanel/TestPanelScreen")) : null;
const RegistrationFlow = lazy(() => import("@/features/registration/RegistrationFlow"));

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<RegistrationFlow />} />
      {/* The test panel is also reachable while signed out (from the registration header). */}
      {TestPanelScreen && <Route path={TEST_PANEL_PATH} element={<TestPanelScreen />} />}
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/trip/chat/:bookingId" element={<TripChatScreen />} />
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
        <Route path="/profile/routes" element={<RoutesScreen />} />
        <Route path="/profile/notifications" element={<NotificationPrefsScreen />} />
        <Route path="/profile/help" element={<HelpScreen />} />
        <Route path="/profile/about" element={<AboutScreen />} />
        {TestPanelScreen && <Route path={TEST_PANEL_PROFILE_PATH} element={<TestPanelScreen />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
