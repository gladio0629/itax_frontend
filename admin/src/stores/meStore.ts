import { create } from "zustand";
import { api } from "@/api/client";
import type { Me } from "@/api/types";

type MeState = {
  me: Me | null;
  loading: boolean;
  error: boolean;
  load: () => Promise<void>;
  clear: () => void;
};

/** The current admin's permissions, fetched once after login. Every screen,
 * the sidebar, route guards and the header account menu read from this —
 * nothing branches on a raw role comparison of its own. */
export const useMeStore = create<MeState>((set) => ({
  me: null,
  loading: false,
  error: false,
  load: async () => {
    set({ loading: true, error: false });
    try {
      const me = await api.getMe();
      set({ me, loading: false });
    } catch {
      set({ me: null, loading: false, error: true });
    }
  },
  clear: () => set({ me: null, error: false }),
}));
