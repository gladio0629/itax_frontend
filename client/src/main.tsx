import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/i18n/provider";
import { initPlatform } from "@/lib/platform";
import "./index.css";

// Platform attributes go on <html> before the first paint (the CSP blocks an
// inline script in index.html, so this is the earliest point).
initPlatform();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <RouterProvider router={router} />
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
