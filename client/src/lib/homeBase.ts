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

export function leaveToHome(navigate: NavigateFunction) {
  let base: number | null = null;
  try {
    const raw = sessionStorage.getItem(KEY);
    base = raw == null ? null : Number(raw);
  } catch {
    base = null;
  }
  const cur = currentIdx();
  if (base != null && Number.isFinite(base) && cur != null && base < cur) navigate(base - cur);
  else navigate("/home", { replace: true });
}
