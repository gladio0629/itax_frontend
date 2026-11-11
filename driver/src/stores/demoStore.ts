import { create } from "zustand";
import { clearAppStorage } from "@/mockDb/storage";

// Network-condition demo toggles. Read by the mock latency layer only.
export type DemoNetwork = { slowInternet: boolean; forceErrors: boolean };
const KEY = "izgo_driver_demo_network";
const defaults: DemoNetwork = { slowInternet: false, forceErrors: false };

function load(): DemoNetwork {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaults;
}

type DemoState = {
  network: DemoNetwork;
  toggle: (key: keyof DemoNetwork) => void;
  resetAll: () => void;
};

export const useDemoStore = create<DemoState>((set, get) => ({
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

export function getDemoNetwork(): DemoNetwork {
  return useDemoStore.getState().network;
}
