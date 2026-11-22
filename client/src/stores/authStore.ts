import { create } from "zustand";
import { readJSON, writeJSON } from "@/mockDb/storage";
import { api } from "@/api/client";

type AuthState = {
  isAuthenticated: boolean;
  phone: string;
  setPhone: (phone: string) => void;
  completeAuth: () => void;
  /** User action: revoke the session on the server, then sign out here. */
  logout: () => void;
  /** The session already ended (expired / revoked): local state only. */
  clearSession: () => void;
};

const KEY = "auth";

// The http adapter knows whether a session exists (a stored refresh token);
// the sample-data adapter returns null and the stored flag decides.
const sessionNow = api.hasSession();

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: sessionNow ?? readJSON(KEY, { isAuthenticated: false }).isAuthenticated,
  // The phone is only kept in memory (never written to storage).
  phone: "",
  setPhone: (phone) => set({ phone }),
  completeAuth: () => {
    writeJSON(KEY, { isAuthenticated: true });
    set({ isAuthenticated: true });
  },
  logout: () => {
    get().clearSession();
    void api.logout();
  },
  clearSession: () => {
    writeJSON(KEY, { isAuthenticated: false });
    set({ isAuthenticated: false, phone: "" });
  },
}));
