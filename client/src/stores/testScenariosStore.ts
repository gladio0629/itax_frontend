import { create } from "zustand";
import { clearAppStorage } from "@/mockDb/storage";
import { useNetworkHint } from "./networkHintStore";

// Test-panel scenarios. Imported only by the mock adapter, the mock DB and
// the test panel, so none of this ships when VITE_DEMO_MODE is not "true".
export type TestScenarios = {
  noDriverFound: boolean;
  slowInternet: boolean;
  forceErrors: boolean;
  walletLimit: boolean;
  fastForward: boolean;
  /** A live order stays in its current status (no auto-advance). */
  holdStatus: boolean;
  bonusBelowMin: boolean;
  /** No saved places and no trips yet (Home's new-user layout). */
  newPassenger: boolean;
};

const SCENARIOS_KEY = "izgo_client_test_scenarios";

const defaultScenarios: TestScenarios = {
  noDriverFound: false,
  slowInternet: false,
  forceErrors: false,
  walletLimit: false,
  fastForward: false,
  holdStatus: false,
  bonusBelowMin: false,
  newPassenger: false,
};

function loadScenarios(): TestScenarios {
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (raw) return { ...defaultScenarios, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultScenarios;
}

type TestScenariosState = {
  scenarios: TestScenarios;
  toggle: (key: keyof TestScenarios) => void;
  resetDb: () => void;
};

export const useTestScenarios = create<TestScenariosState>((set, get) => ({
  scenarios: loadScenarios(),
  toggle: (key) => {
    const next = { ...get().scenarios, [key]: !get().scenarios[key] };
    try {
      localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    useNetworkHint.getState().setSlow(next.slowInternet);
    set({ scenarios: next });
  },
  resetDb: () => {
    clearAppStorage();
    try {
      localStorage.removeItem(SCENARIOS_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  },
}));

useNetworkHint.getState().setSlow(useTestScenarios.getState().scenarios.slowInternet);

// Non-reactive accessor for use inside the mock adapter (outside React).
export function getTestScenarios(): TestScenarios {
  return useTestScenarios.getState().scenarios;
}
