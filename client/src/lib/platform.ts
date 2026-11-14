/**
 * Platform layer — the ONLY place the app looks at the user agent.
 *
 * Resolved once at startup (initPlatform, called from main.tsx before React
 * renders) and written to <html> as `data-platform="ios" | "standard"` and
 * `data-standalone="true" | "false"`. Everything iOS-specific keys off those
 * attributes: the iOS token set in design/ios.css, the `ios:` / `standalone:`
 * Tailwind variants, and useIsIOS() for the few iOS-only components.
 *
 * The demo control panel can force a platform ("Platforma: Avto / iOS /
 * Standart"); the choice is stored and applied with a reload, because nav
 * bars, transitions and gestures are wired once at startup.
 */

export type Platform = "ios" | "standard";
export type PlatformOverride = "auto" | Platform;

const OVERRIDE_KEY = "izgo_client_platform";

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

function detectIOS(): boolean {
  const nav = navigator as NavigatorWithStandalone;
  const ua = nav.userAgent || "";
  if (/iPhone|iPod|iPad/.test(ua)) return true;
  // iPadOS 13+ reports a desktop Mac UA; a touch-capable "Mac" is an iPad.
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

function detectStandalone(): boolean {
  const nav = navigator as NavigatorWithStandalone;
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

export function readPlatformOverride(): PlatformOverride {
  try {
    const v = localStorage.getItem(OVERRIDE_KEY);
    return v === "ios" || v === "standard" ? v : "auto";
  } catch {
    return "auto";
  }
}

/** Store the demo override and reload so every startup-wired piece re-initialises. */
export function setPlatformOverride(next: PlatformOverride) {
  try {
    if (next === "auto") localStorage.removeItem(OVERRIDE_KEY);
    else localStorage.setItem(OVERRIDE_KEY, next);
  } catch {
    /* ignore — the override just won't persist */
  }
  window.location.reload();
}

const state = {
  detected: "standard" as Platform,
  platform: "standard" as Platform,
  standalone: false,
};

export function initPlatform() {
  state.detected = detectIOS() ? "ios" : "standard";
  const override = readPlatformOverride();
  state.platform = override === "auto" ? state.detected : override;
  state.standalone = detectStandalone();

  const root = document.documentElement;
  root.dataset.platform = state.platform;
  root.dataset.standalone = String(state.standalone);

  if (state.platform === "ios") {
    // iOS Safari only fires :active on elements when the document has a
    // touchstart listener — without it, iOS press states never show.
    document.addEventListener("touchstart", () => {}, { passive: true });
  }
}

/** The platform the device itself reports (ignores the demo override). */
export function detectedPlatform(): Platform {
  return state.detected;
}

export function isIOS(): boolean {
  return state.platform === "ios";
}

export function isStandalone(): boolean {
  return state.standalone;
}

/**
 * Hook form for components. The platform is fixed for the page's lifetime
 * (changing it reloads), so this is a plain read — no subscription needed.
 */
export function useIsIOS(): boolean {
  return state.platform === "ios";
}
