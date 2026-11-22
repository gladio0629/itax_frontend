/**
 * System keyboard tracking for the "Kb*" layouts of design v2: while the
 * keyboard is open the dark top shrinks and the white sheet with its main
 * button stays above the keyboard.
 *
 * Writes to <html>:
 * - `data-kb="open"` while the keyboard is up (Tailwind variant `kb:`),
 * - `--kb-inset`: how many px of the layout the keyboard still covers.
 *
 * The inset is "keyboard height minus what the web view already shrank":
 * - iOS (Capacitor Keyboard `resize: native`) and Android (adjustResize)
 *   shrink the web view, so the inset ends at ~0 and the flex layout keeps
 *   the sheet above the keyboard by itself;
 * - where nothing resizes (mobile browsers that overlay the keyboard) the
 *   inset is the covered part, and screens pad their bottom by it.
 * The native "will show" event fires before the web view resizes, so the
 * inset is recomputed on window / visualViewport resize as well.
 *
 * Native events: the @capacitor/keyboard plugin (iOS and Android) also
 * fires plain `window` events (keyboardWillShow / keyboardDidShow with
 * `keyboardHeight` in CSS px, keyboardWillHide / keyboardDidHide). Listening
 * to those keeps the Capacitor JS runtime out of the web bundle.
 */
import { useSyncExternalStore } from "react";

type KbState = { open: boolean; inset: number };

let state: KbState = { open: false, inset: 0 };
const listeners = new Set<() => void>();

/** Native keyboard height (px), null when no native event has said. */
let nativeHeight: number | null = null;
/** Layout height with no keyboard, to tell how much the web view shrank. */
let baseHeight = 0;

function emit(next: KbState) {
  if (next.open === state.open && Math.abs(next.inset - state.inset) < 1) return;
  state = next;
  const root = document.documentElement;
  if (next.open) root.setAttribute("data-kb", "open");
  else root.removeAttribute("data-kb");
  root.style.setProperty("--kb-inset", `${Math.round(next.inset)}px`);
  listeners.forEach((l) => l());
}

function recompute() {
  const layoutH = window.innerHeight;
  const vv = window.visualViewport;

  if (nativeHeight !== null) {
    const shrunk = Math.max(0, baseHeight - layoutH);
    emit({ open: nativeHeight > 0, inset: Math.max(0, nativeHeight - shrunk) });
    return;
  }
  if (!vv) return;
  // Web: the visual viewport shrinks under an overlaying keyboard.
  const covered = Math.max(0, layoutH - vv.height - vv.offsetTop);
  // A focused text field + a big drop = keyboard (not just browser chrome).
  const typing = isTextInput(document.activeElement);
  const shrunk = Math.max(0, baseHeight - layoutH);
  const open = typing && (covered > 120 || shrunk > 120);
  emit({ open, inset: open ? covered : 0 });
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  if (el instanceof HTMLTextAreaElement) return !el.readOnly;
  if (el instanceof HTMLInputElement) {
    return !el.readOnly && !["button", "checkbox", "radio", "range", "submit", "reset", "file", "color"].includes(el.type);
  }
  return (el as HTMLElement).isContentEditable === true;
}

let installed = false;

/** Call once at startup (main.tsx). Safe to call again. */
export function installKeyboardTracking() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  baseHeight = window.innerHeight;

  const onResize = () => {
    // With no keyboard up, a resize is rotation / browser chrome: new base.
    if (!state.open && !isTextInput(document.activeElement)) baseHeight = window.innerHeight;
    recompute();
  };
  window.addEventListener("resize", onResize);
  window.visualViewport?.addEventListener("resize", recompute);
  window.visualViewport?.addEventListener("scroll", recompute);
  document.addEventListener("focusin", () => requestAnimationFrame(recompute));
  document.addEventListener("focusout", () => setTimeout(recompute, 50));

  const show = (e: Event) => {
    const height = Number((e as Event & { keyboardHeight?: number }).keyboardHeight ?? 0);
    if (!state.open) baseHeight = Math.max(baseHeight, window.innerHeight);
    nativeHeight = height;
    recompute();
  };
  const hide = () => {
    nativeHeight = 0;
    recompute();
  };
  window.addEventListener("keyboardWillShow", show);
  window.addEventListener("keyboardDidShow", show);
  window.addEventListener("keyboardWillHide", hide);
  window.addEventListener("keyboardDidHide", hide);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The keyboard state, for screens that need it in JS (most use `kb:`). */
export function useKeyboard(): KbState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
