import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ServerGate } from "@/components/ServerGate";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ServerGate>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ServerGate>
  </React.StrictMode>
);
