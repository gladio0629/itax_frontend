// Namespaced localStorage helpers. Every key for this app is prefixed so the
// test panel's "reset" action can wipe exactly this app's data and nothing else.
const PREFIX = "izgo_driver_";

export function storageKey(name: string): string {
  return `${PREFIX}${name}`;
}

export function readJSON<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON<T>(name: string, value: T): void {
  localStorage.setItem(storageKey(name), JSON.stringify(value));
}

export function clearAppStorage(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}
