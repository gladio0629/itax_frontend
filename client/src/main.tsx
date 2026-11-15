import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/i18n/provider";
import { initPlatform } from "@/lib/platform";
import { installIOSTransitions } from "@/lib/navigation";
import { ServerGate } from "@/components/ServerGate";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/authStore";
import { useOrderStore } from "@/stores/orderStore";
import "./index.css";

// The backend ended the session (refresh rejected, revoked, or logout):
// clear what this tab holds and go to login.
api.onSessionEnd(() => {
  useAuthStore.getState().clearSession();
  useOrderStore.getState().reset();
  useOrderStore.getState().setActiveOrderId(null);
  void router.navigate("/auth/phone", { replace: true });
});
// After a reload: refresh the tokens and reconnect the WebSocket.
if (useAuthStore.getState().isAuthenticated) void api.resumeSession();

// Platform attributes go on <html> before the first paint (the CSP blocks an
// inline script in index.html, so this is the earliest point).
initPlatform();
// iOS: push/pop slide transitions for every navigation (no-op elsewhere).
installIOSTransitions(router as unknown as Parameters<typeof installIOSTransitions>[0]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ServerGate>
          <RouterProvider router={router} />
        </ServerGate>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
