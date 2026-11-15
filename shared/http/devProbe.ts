import { DEV_BACKEND_PROBE_PATH } from "./config.ts";

/** Dev only: asks the Vite dev server whether the proxy target accepts
 * connections. The dev server answers 200 either way, so the browser
 * console stays clean when the backend is stopped. */
export async function probeDevBackend(timeoutMs = 4000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(DEV_BACKEND_PROBE_PATH, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { reachable?: unknown };
    return body.reachable === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
