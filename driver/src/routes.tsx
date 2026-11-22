import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import { ComingSoon } from "@/components/ComingSoon";
import { api } from "@/api/client";
import type { TranslationKey } from "@/lib/i18n/provider";
import { DEMO_MODE } from "@/config";
import { TEST_PANEL_PATH, TEST_PANEL_PROFILE_PATH, TEST_PANEL_UI_PATH } from "@/features/testPanel/paths";

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
const UiGalleryScreen = DEMO_MODE ? lazy(() => import("@/features/testPanel/UiGalleryScreen")) : null;
const RegistrationFlow = lazy(() => import("@/features/registration/RegistrationFlow"));

/** A screen whose backend endpoints don't exist yet shows "Tez orada" instead. */
const when = (supported: boolean, screen: JSX.Element, titleKey: TranslationKey, back?: string | true) =>
  supported ? screen : <ComingSoon titleKey={titleKey} back={back} />;

export function AppRoutes() {
  const c = api.capabilities;
  return (
    <Routes>
      <Route path="/register" element={<RegistrationFlow />} />
      {/* The test panel is also reachable while signed out (from the registration header). */}
      {TestPanelScreen && <Route path={TEST_PANEL_PATH} element={<TestPanelScreen />} />}
      {UiGalleryScreen && <Route path={TEST_PANEL_UI_PATH} element={<UiGalleryScreen />} />}
      <Route element={<AppShell />}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/trip/chat/:bookingId" element={when(c.tripChat, <TripChatScreen />, "chat.title", true)} />
        <Route path="/history" element={when(c.history, <HistoryScreen />, "orders.title")} />
        <Route path="/history/:tripId" element={when(c.history, <TripDetailScreen />, "detail.title", "/history")} />
        {/* Old "Buyurtmalar" links. */}
        <Route path="/orders/*" element={<Navigate to="/history" replace />} />
        <Route path="/wallet" element={<WalletScreen />} />
        <Route path="/wallet/topup" element={<TopupScreen />} />
        <Route path="/wallet/cards" element={<CardsScreen />} />
        <Route path="/wallet/cards/link" element={<CardLinkScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/profile/personal" element={<PersonalScreen />} />
        <Route path="/profile/bonus" element={when(c.bonus, <BonusScreen />, "bonus.title", "/profile")} />
        <Route path="/profile/capabilities" element={when(c.driverCapabilities, <CapabilitiesScreen />, "profile.capabilities", "/profile")} />
        <Route path="/profile/routes" element={when(c.routes, <RoutesScreen />, "routes.title", "/profile")} />
        <Route path="/profile/notifications" element={<NotificationPrefsScreen />} />
        <Route path="/profile/help" element={when(c.help, <HelpScreen />, "help.title", "/profile")} />
        <Route path="/profile/about" element={<AboutScreen />} />
        {TestPanelScreen && <Route path={TEST_PANEL_PROFILE_PATH} element={<TestPanelScreen />} />}
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
