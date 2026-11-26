import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider } from "@/lib/i18n/provider";
import { ServerGate } from "@/components/ServerGate";
import "./index.css";
import { installBackButton } from "@/lib/backButton";

installBackButton().catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ServerGate>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ServerGate>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
