import type { NavigateFunction } from "react-router-dom";

// The history entry of Home that an order was placed from (react-router keeps
// an index in history.state). Leaving the order — cancelled, no driver, rated —
// goes back to it, so the back button never lands on a second copy of Home.
const KEY = "izgo_client_home_base";

const currentIdx = () => (window.history.state as { idx?: number } | null)?.idx;

export function rememberHomeBase(idx: number | null) {
  try {
    if (idx == null) sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, String(idx));
  } catch {
    /* storage unavailable: leaving falls back to replacing */
  }
}

function homeBase(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const base = raw == null ? null : Number(raw);
    const cur = currentIdx();
    return base != null && Number.isFinite(base) && cur != null && base < cur ? base : null;
  } catch {
    return null;
  }
}

/** Whether there is an earlier Home entry to go back to. */
export const hasHomeBase = () => homeBase() != null;

export function leaveToHome(navigate: NavigateFunction) {
  const base = homeBase();
  const cur = currentIdx();
  if (base != null && cur != null) navigate(base - cur);
  else navigate("/home", { replace: true });
}
