/**
 * Status bar text colour (iOS / Android, via @capacitor/status-bar).
 *
 * Design v2: screens with the dark top get light text; map screens (light
 * map at the top) get dark text. A screen declares what it needs with
 * `useStatusBar("light" | "dark")`; the most recently mounted one wins.
 * With none declared (screens not yet moved to v2) the text follows the
 * theme: dark text on the light theme, light text on the dark one.
 */
import { useEffect } from "react";
import { nativeCall } from "@/lib/nativeBridge";

export type StatusBarText = "light" | "dark";

const stack: { id: number; text: StatusBarText }[] = [];
let seq = 0;
let applied: StatusBarText | null = null;

function themeDefault(): StatusBarText {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
}

function apply() {
  const text = stack.length ? stack[stack.length - 1].text : themeDefault();
  if (text === applied) return;
  applied = text;
  // Plugin styles: DARK = light text (for dark backgrounds), LIGHT = dark text.
  void nativeCall("StatusBar", "setStyle", { style: text === "light" ? "DARK" : "LIGHT" });
}

/** Re-apply after the theme changes (theme.tsx calls it). */
export function refreshStatusBar() {
  apply();
}

export function useStatusBar(text: StatusBarText) {
  useEffect(() => {
    const id = ++seq;
    stack.push({ id, text });
    apply();
    return () => {
      const i = stack.findIndex((e) => e.id === id);
      if (i >= 0) stack.splice(i, 1);
      apply();
    };
  }, [text]);
}
