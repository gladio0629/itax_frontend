import { create } from "zustand";
import { DEMO_MODE } from "@/config";

/** Test scenarios for the sample-data build (VITE_DEMO_MODE=true), toggled
 * from the "Sinov paneli". With the real backend they are always off. */
export type TestScenarios = {
  noDriverFound: boolean;
  slowInternet: boolean;
  forceErrors: boolean;
  walletLimit: boolean;
  fastForward: boolean;
  shortSession: boolean;
};

export const SCENARIOS_KEY = "izgo_admin_scenarios";

const defaultScenarios: TestScenarios = {
  noDriverFound: false,
  slowInternet: false,
  forceErrors: false,
  walletLimit: false,
  fastForward: false,
  shortSession: false,
};

function loadScenarios(): TestScenarios {
  if (!DEMO_MODE) return defaultScenarios;
  try {
    const raw = localStorage.getItem(SCENARIOS_KEY);
    if (raw) return { ...defaultScenarios, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultScenarios;
}

type ScenarioState = {
  scenarios: TestScenarios;
  toggle: (key: keyof TestScenarios) => void;
};

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: loadScenarios(),
  toggle: (key) => {
    const next = { ...get().scenarios, [key]: !get().scenarios[key] };
    try {
      localStorage.setItem(SCENARIOS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    set({ scenarios: next });
  },
}));

// Non-reactive accessor for the mock adapter (outside React).
export function getScenarios(): TestScenarios {
  return useScenarioStore.getState().scenarios;
}
