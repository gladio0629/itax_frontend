import { useCallback } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import { isIOS } from "@/lib/platform";

// Named-group CSS in index.css (`app-content`) is keyed off this attribute
// to pick slide-forward / slide-back / cross-fade for the next transition.
// "none" switches the transition off (design/ios.css).
export type TransitionKind = "push" | "pop" | "fade" | "none";

type ViewTransitionDocumentElement = HTMLElement & { dataset: { transition?: TransitionKind } };

export function supportsViewTransitions() {
  return typeof document !== "undefined" && typeof (document as unknown as {
    startViewTransition?: unknown;
  }).startViewTransition === "function";
}

/** Kind requested for the next push/replace (iOS: consumed by the navigate wrapper). */
let pendingKind: TransitionKind | null = null;
/** Kind for the next history pop, armed by in-app back controls (iOS). */
let armedPop: TransitionKind | null = null;

export function setTransitionKind(kind: TransitionKind) {
  if (!supportsViewTransitions()) return;
  (document.documentElement as ViewTransitionDocumentElement).dataset.transition = kind;
  pendingKind = kind;
}

/** Forget a requested kind that no navigation used (e.g. drawer closed). */
export function clearPendingTransition() {
  pendingKind = null;
}

/**
 * Arm the animation for the next history pop. Only in-app back controls do
 * this; a pop nobody armed (Safari's own back swipe, which already animated)
 * gets no transition, so the page never slides twice.
 */
export function armPop(kind: TransitionKind = "pop") {
  armedPop = kind;
}

type NavigateFn = (to: To | number | null, opts?: NavigateOptions & { viewTransition?: boolean }) => Promise<void>;

/**
 * iOS: every navigation becomes a view transition with UIKit timing — push
 * slides in from the right, pop slides back (design/ios.css). Installed once
 * on the data router, so plain <Link>s animate too, without touching each
 * call site. React Router replays the push's transition on the matching pop.
 */
export function installIOSTransitions(router: { navigate: NavigateFn }) {
  if (!isIOS() || !supportsViewTransitions()) return;
  const root = document.documentElement as ViewTransitionDocumentElement;
  const original = router.navigate.bind(router);

  router.navigate = ((to, opts) => {
    if (typeof to === "number") return original(to, opts);
    const kind = pendingKind ?? (opts?.replace ? "fade" : "push");
    pendingKind = null;
    root.dataset.transition = kind;
    return original(to, { ...opts, viewTransition: opts?.viewTransition ?? kind !== "none" });
  }) as NavigateFn;

  // Capture phase on window runs before the router's own popstate listener.
  window.addEventListener(
    "popstate",
    () => {
      root.dataset.transition = armedPop ?? "none";
      armedPop = null;
    },
    true
  );
}

/**
 * Drop-in replacement for react-router's `useNavigate` that also arms a
 * View Transition (slide for push/pop, fade for drawer-style jumps), with
 * no-op fallback on browsers/`prefers-reduced-motion` that don't support it.
 */
export function useAppNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: To, kind: TransitionKind = "push", options?: NavigateOptions) => {
      const viewTransition = supportsViewTransitions();
      if (viewTransition) setTransitionKind(kind);
      navigate(to, { viewTransition, ...options });
    },
    [navigate]
  );
}
