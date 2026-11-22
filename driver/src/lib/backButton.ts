// The phone's back button (Android). @capacitor/app reports it; the app
// closes the top sheet first, then goes back in history (registration steps,
// sub-pages), and leaves the app from Asosiy or when there is no history.
import { Capacitor } from "@capacitor/core";

const handlers: Array<() => void> = [];

/** While registered, the back button calls `fn` instead (open sheets close themselves). */
export function pushBackHandler(fn: () => void): () => void {
  handlers.push(fn);
  return () => {
    const i = handlers.lastIndexOf(fn);
    if (i >= 0) handlers.splice(i, 1);
  };
}

/** Call once at start-up. No-op in the browser (it has its own back button). */
export async function installBackButton() {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import("@capacitor/app");
  await App.addListener("backButton", ({ canGoBack }) => {
    const top = handlers[handlers.length - 1];
    if (top) return top();
    // Home (Asosiy) is the last stop: back from there leaves the app, as on any Android app.
    if (window.location.pathname === "/" || !canGoBack) App.exitApp();
    else window.history.back();
  });
}
