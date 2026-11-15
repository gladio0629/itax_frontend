import { useLayoutEffect, type RefObject } from "react";
import { create } from "zustand";

/**
 * Where the floating test-panel button may sit on a full-screen phone (it
 * only exists when VITE_DEMO_MODE=true; otherwise nothing reads this). Screens
 * register their footers here so the button never covers their buttons.
 */
type FloatingControlState = {
  fabHidden: boolean;
  fabBottomPx: number | null;
  setFabPlacement: (placement: { hidden?: boolean; bottomPx?: number | null }) => void;
};

export const useFloatingControl = create<FloatingControlState>((set) => ({
  fabHidden: false,
  fabBottomPx: null,
  setFabPlacement: ({ hidden, bottomPx }) =>
    set((s) => ({ fabHidden: hidden ?? s.fabHidden, fabBottomPx: bottomPx === undefined ? s.fabBottomPx : bottomPx })),
}));

/**
 * Registers a bottom-anchored footer (BottomBar, a screen's CTA row) so the
 * floating control sits just above it instead of on top of its buttons.
 */
export function useLiftFloatingControl(ref: RefObject<HTMLElement>) {
  const setFabPlacement = useFloatingControl((s) => s.setFabPlacement);
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
