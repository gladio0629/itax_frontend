import { create } from "zustand";
import { clearAppStorage } from "@/mockDb/storage";

export type DemoScenarios = {
  noDriverFound: boolean;
  slowInternet: boolean;
  forceErrors: boolean;
  walletLimit: boolean;
  fastForward: boolean;
  shortSession: boolean;
};

const SCENARIOS_KEY = "izgo_admin_demo_scenarios";

const defaultScenarios: DemoScenarios = {
  noDriverFound: false,
  slowInternet: false,
  forceErrors: false,
  walletLimit: false,
  fastForward: false,
  shortSession: false,
};

function loadScenarios(): DemoScenarios {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (raw) return { ...defaultScenarios, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultScenarios;
}

type DemoState = {
  isDemo: boolean;
  scenarios: DemoScenarios;
  toggle: (key: keyof DemoScenarios) => void;
  resetDb: () => void;
};

export const useDemoStore = create<DemoState>((set, get) => ({
  isDemo: import.meta.env.VITE_DEMO_MODE !== "false",
  scenarios: loadScenarios(),
  toggle: (key) => {
    const next = { ...get().scenarios, [key]: !get().scenarios[key] };
    localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next));
    set({ scenarios: next });
  },
  resetDb: () => {
    clearAppStorage();
    localStorage.removeItem(SCENARIOS_KEY);
    window.location.reload();
  },
}));

// Non-reactive accessor for use inside the mock adapter (outside React).
export function getDemoScenarios(): DemoScenarios {
  return useDemoStore.getState().scenarios;
}
