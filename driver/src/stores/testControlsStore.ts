import { create } from "zustand";
import { clearAppStorage } from "@/mockDb/storage";

// Network-condition toggles of the test panel (sample-data mode only).
// Read by the mock latency layer and the slow-connection banner.
export type TestNetwork = { slowInternet: boolean; forceErrors: boolean };
const KEY = "izgo_driver_test_network";
const defaults: TestNetwork = { slowInternet: false, forceErrors: false };

function load(): TestNetwork {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

type TestControlsState = {
  network: TestNetwork;
  toggle: (key: keyof TestNetwork) => void;
  resetAll: () => void;
};

export const useTestControls = create<TestControlsState>((set, get) => ({
  network: load(),
  toggle: (key) => {
    const next = { ...get().network, [key]: !get().network[key] };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    set({ network: next });
  },
  resetAll: () => {
    clearAppStorage();
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    window.location.assign("/");
  },
}));

export function getTestNetwork(): TestNetwork {
  return useTestControls.getState().network;
}
