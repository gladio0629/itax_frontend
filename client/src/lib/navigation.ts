import { useCallback } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";

// Named-group CSS in index.css (`app-content`) is keyed off this attribute
// to pick slide-forward / slide-back / cross-fade for the next transition.
export type TransitionKind = "push" | "pop" | "fade";

type ViewTransitionDocumentElement = HTMLElement & { dataset: { transition?: TransitionKind } };

function supportsViewTransitions() {
  return typeof document !== "undefined" && typeof (document as unknown as {
    startViewTransition?: unknown;
  }).startViewTransition === "function";
}

export function setTransitionKind(kind: TransitionKind) {
  if (!supportsViewTransitions()) return;
  (document.documentElement as ViewTransitionDocumentElement).dataset.transition = kind;
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
