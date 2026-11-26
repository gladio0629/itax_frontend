/**
 * Status-bar text colour (iOS / Android, @capacitor/status-bar).
 *
 * capacitor.config.ts starts the app with light text over the web view:
 * every screen has the Ink top in both themes. A screen with something light
 * under the status bar (the Trip map, light in both themes) asks for dark
 * text with `useStatusBar("dark")`; the most recently mounted request wins
 * and light text comes back when it unmounts.
 */
import { useEffect } from "react";
import { nativeCall } from "@/lib/native";

export type StatusBarText = "light" | "dark";

const stack: { id: number; text: StatusBarText }[] = [];
let seq = 0;
let applied: StatusBarText = "light";

function apply() {
  const text = stack.length ? stack[stack.length - 1].text : "light";
  if (text === applied) return;
  applied = text;
  // Plugin styles: DARK = light text (for dark backgrounds), LIGHT = dark text.
  void nativeCall("StatusBar", "setStyle", { style: text === "light" ? "DARK" : "LIGHT" });
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
