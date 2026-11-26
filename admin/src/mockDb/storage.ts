// Namespaced storage helpers. Every key for this app is prefixed so the
// "reset DB" demo action can wipe exactly this app's data and nothing else.
//
// Two stores, on purpose:
// - localStorage ("mock server" data) — the dataset the mock adapter plays
//   the role of a real backend for: drivers, orders, staff, audit log,
//   tariff settings. This must survive logout/login so staff created as one role
//   are still there after switching users.
// - sessionStorage (session data) — who is currently logged in. This is
//   cleared on logout and never persisted across browser restarts, which is
//   also what gives us "no remember me" for free.
const PREFIX = "izgo_admin_";

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

export function removeJSON(name: string): void {
  localStorage.removeItem(storageKey(name));
}

export function clearAppStorage(): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}

export function readSessionJSON<T>(name: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(storageKey(name));
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeSessionJSON<T>(name: string, value: T): void {
  sessionStorage.setItem(storageKey(name), JSON.stringify(value));
}

export function clearSessionStorage(): void {
  Object.keys(sessionStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => sessionStorage.removeItem(k));
}
