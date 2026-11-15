import { useLayoutEffect, type RefObject } from "react";
import { DEMO_MODE } from "@/config";
import { create } from "zustand";
import { clearAppStorage } from "@/mockDb/storage";

export type DemoScenarios = {
  noDriverFound: boolean;
  slowInternet: boolean;
  forceErrors: boolean;
  walletLimit: boolean;
  fastForward: boolean;
  bonusBelowMin: boolean;
};

const SCENARIOS_KEY = "izgo_client_demo_scenarios";

const defaultScenarios: DemoScenarios = {
  noDriverFound: false,
  slowInternet: false,
  forceErrors: false,
  walletLimit: false,
  fastForward: false,
  bonusBelowMin: false,
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
  /** Placement of the floating demo control on a full-screen phone (see DemoControlPanel). */
  fabHidden: boolean;
  fabBottomPx: number | null;
  setFabPlacement: (placement: { hidden?: boolean; bottomPx?: number | null }) => void;
};

export const useDemoStore = create<DemoState>((set, get) => ({
  isDemo: DEMO_MODE,
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
  fabHidden: false,
  fabBottomPx: null,
  setFabPlacement: ({ hidden, bottomPx }) =>
    set((s) => ({ fabHidden: hidden ?? s.fabHidden, fabBottomPx: bottomPx === undefined ? s.fabBottomPx : bottomPx })),
}));

// Non-reactive accessor for use inside the mock adapter (outside React).
export function getDemoScenarios(): DemoScenarios {
  return useDemoStore.getState().scenarios;
}

/**
 * Registers a bottom-anchored footer (BottomBar, a screen's CTA row) so the
 * floating demo control sits just above it instead of on top of its buttons.
 */
export function useLiftDemoFab(ref: RefObject<HTMLElement>) {
  const setFabPlacement = useDemoStore((s) => s.setFabPlacement);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setFabPlacement({ bottomPx: el.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      setFabPlacement({ bottomPx: null });
    };
  }, [ref, setFabPlacement]);
}
