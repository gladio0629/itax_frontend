import { create } from "zustand";
import { api } from "@/api/client";
import { useMeStore } from "./meStore";

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
    useMeStore.getState().clear();
    set({ isAuthenticated: false });
  },
}));

// The server ended the session (token expired or rejected): back to login.
// The routes redirect to /login as soon as isAuthenticated is false.
api.onSessionEnd(() => {
  useMeStore.getState().clear();
  useAuthStore.setState({ isAuthenticated: false });
});
