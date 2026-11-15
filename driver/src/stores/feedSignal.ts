import { create } from "zustand";

/** Bumped when something changes the Asosiy badge (alert arrived, feed seen), so the shell refetches it. */
export const useFeedSignal = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
