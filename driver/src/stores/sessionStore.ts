import { create } from "zustand";
import { api } from "@/api/client";
import type { Session } from "@/api/types";

// Caches the adapter's session so route guards don't refetch on every page.
type S = { session: Session | null; refresh: () => Promise<Session>; set: (s: Session) => void };

export const useSession = create<S>((set) => ({
  session: null,
  refresh: async () => {
    const s = await api.getSession();
    set({ session: s });
    return s;
  },
  set: (s) => set({ session: s }),
}));
