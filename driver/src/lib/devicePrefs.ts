// Settings that belong to this phone, not the account: the navigator app
// and the new-request sound. Kept in localStorage (safe to lose).
import { create } from "zustand";

export type NavigatorApp = "system" | "yandex" | "google";
export type DevicePrefs = { navigator: NavigatorApp; requestSound: boolean };

const KEY = "izgo_driver_device_prefs";
const DEFAULTS: DevicePrefs = { navigator: "system", requestSound: true };

function load(): DevicePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* defaults */
  }
  return DEFAULTS;
}

type Store = DevicePrefs & { set: (patch: Partial<DevicePrefs>) => void };

export const useDevicePrefs = create<Store>((set, get) => ({
  ...load(),
  set: (patch) => {
    const next = { navigator: get().navigator, requestSound: get().requestSound, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* not kept */
    }
    set(next);
  },
}));

export const getDevicePrefs = (): DevicePrefs => {
  const s = useDevicePrefs.getState();
  return { navigator: s.navigator, requestSound: s.requestSound };
};
