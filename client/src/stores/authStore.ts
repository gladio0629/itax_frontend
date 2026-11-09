import { create } from "zustand";
import { readJSON, writeJSON } from "@/mockDb/storage";

type AuthState = {
  isAuthenticated: boolean;
  phone: string;
  onboardingSeen: boolean;
  setPhone: (phone: string) => void;
  completeAuth: () => void;
  completeOnboarding: () => void;
  logout: () => void;
};

const KEY = "auth";

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: readJSON(KEY, { isAuthenticated: false }).isAuthenticated,
  phone: readJSON(KEY, { phone: "" }).phone,
  onboardingSeen: readJSON(KEY, { onboardingSeen: false }).onboardingSeen,
  setPhone: (phone) => set({ phone }),
  completeAuth: () => {
    const next = { isAuthenticated: true, phone: get().phone, onboardingSeen: true };
    writeJSON(KEY, next);
    set(next);
  },
  completeOnboarding: () => {
    const next = { isAuthenticated: get().isAuthenticated, phone: get().phone, onboardingSeen: true };
    writeJSON(KEY, next);
    set({ onboardingSeen: true });
  },
  logout: () => {
    writeJSON(KEY, { isAuthenticated: false, phone: "", onboardingSeen: true });
    set({ isAuthenticated: false });
  },
}));
