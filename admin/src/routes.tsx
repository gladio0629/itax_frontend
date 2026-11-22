import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { AccountScreen } from "@/features/account/AccountScreen";
import { RequireSection } from "@/components/RequireSection";
import { usePermissions } from "@/hooks/usePermissions";
import { Skeleton } from "@/components/Skeleton";

const DashboardScreen = lazy(() => import("@/features/dashboard/DashboardScreen").then((m) => ({ default: m.DashboardScreen })));
const DriversScreen = lazy(() => import("@/features/drivers/DriversScreen").then((m) => ({ default: m.DriversScreen })));
const DriverPage = lazy(() => import("@/features/drivers/DriverPage").then((m) => ({ default: m.DriverPage })));
const PassengersScreen = lazy(() => import("@/features/passengers/PassengersScreen").then((m) => ({ default: m.PassengersScreen })));
const OrdersScreen = lazy(() => import("@/features/orders/OrdersScreen").then((m) => ({ default: m.OrdersScreen })));
const WalletScreen = lazy(() => import("@/features/wallet/WalletScreen").then((m) => ({ default: m.WalletScreen })));
const TariffsScreen = lazy(() => import("@/features/tariffs/TariffsScreen").then((m) => ({ default: m.TariffsScreen })));
const ComplaintsScreen = lazy(() => import("@/features/complaints/ComplaintsScreen").then((m) => ({ default: m.ComplaintsScreen })));
const StaffScreen = lazy(() => import("@/features/staff/StaffScreen").then((m) => ({ default: m.StaffScreen })));
const OperatorsScreen = lazy(() => import("@/features/operators/OperatorsScreen").then((m) => ({ default: m.OperatorsScreen })));
const AuditScreen = lazy(() => import("@/features/audit/AuditScreen").then((m) => ({ default: m.AuditScreen })));

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RouteFallback() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

function RootRedirect() {
  const { me, loading } = usePermissions();
  if (loading || !me) return null;
  return <Navigate to={me.landingPath} replace />;
}

export function AppRoutes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginScreen />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/dashboard"
          element={
            <RequireSection section="stats">
              <Lazy>
                <DashboardScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/drivers"
          element={
            <RequireSection section="drivers">
              <Lazy>
                <DriversScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/drivers/:driverId/*"
          element={
            <RequireSection section="drivers">
              <Lazy>
                <DriverPage />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/passengers"
          element={
            <RequireSection section="passengers">
              <Lazy>
                <PassengersScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/orders/*"
          element={
            <RequireSection section="orders">
              <Lazy>
                <OrdersScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/wallet"
          element={
            <RequireSection section="wallet">
              <Lazy>
                <WalletScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/tariffs"
          element={
            <RequireSection section="tariffs">
              <Lazy>
                <TariffsScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/complaints"
          element={
            <RequireSection section="complaints">
              <Lazy>
                <ComplaintsScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/staff"
          element={
            <RequireSection section="staff">
              <Lazy>
                <StaffScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/operators"
          element={
            <RequireSection section="operators">
              <Lazy>
                <OperatorsScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireSection section="audit">
              <Lazy>
                <AuditScreen />
              </Lazy>
            </RequireSection>
          }
        />
        <Route path="/account" element={<AccountScreen />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
