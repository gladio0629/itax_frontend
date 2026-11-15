import { create } from "zustand";

/** "Slow connection" hint for LowConnectionBanner. Set by the test panel's
 * "Sekin internet" scenario (VITE_DEMO_MODE=true); a real network layer can
 * set it too. */
export const useNetworkHint = create<{ slow: boolean; setSlow: (slow: boolean) => void }>((set) => ({
  slow: false,
  setSlow: (slow) => set({ slow }),
}));
