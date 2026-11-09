import { create } from "zustand";
import { api } from "@/api/client";

type AuthState = {
  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: api.isAuthenticated(),
  setAuthenticated: (v) => set({ isAuthenticated: v }),
  logout: async () => {
    await api.logout();
    set({ isAuthenticated: false });
  },
}));
