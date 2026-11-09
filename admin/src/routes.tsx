import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { DashboardScreen } from "@/features/dashboard/DashboardScreen";
import { VerificationScreen } from "@/features/verification/VerificationScreen";
import { DriversScreen } from "@/features/drivers/DriversScreen";
import { PassengersScreen } from "@/features/passengers/PassengersScreen";
import { OrdersScreen } from "@/features/orders/OrdersScreen";
import { WalletScreen } from "@/features/wallet/WalletScreen";
import { TariffsScreen } from "@/features/tariffs/TariffsScreen";
import { SupportScreen } from "@/features/support/SupportScreen";
import { RiskScreen } from "@/features/risk/RiskScreen";
import { RolesScreen } from "@/features/roles/RolesScreen";
import { AuditScreen } from "@/features/audit/AuditScreen";
import { SettingsScreen } from "@/features/settings/SettingsScreen";

function RequireAuth({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginScreen />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/verification" element={<VerificationScreen />} />
        <Route path="/drivers" element={<DriversScreen />} />
        <Route path="/passengers" element={<PassengersScreen />} />
        <Route path="/orders" element={<OrdersScreen />} />
        <Route path="/wallet" element={<WalletScreen />} />
        <Route path="/tariffs" element={<TariffsScreen />} />
        <Route path="/support" element={<SupportScreen />} />
        <Route path="/risk" element={<RiskScreen />} />
        <Route path="/roles" element={<RolesScreen />} />
        <Route path="/audit" element={<AuditScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
      </Route>
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
