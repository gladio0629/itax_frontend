import { createContext } from "react";

/**
 * What AppShell offers an iOS navigation bar: the leading control for this
 * screen (drawer menu on top-level screens, back on sub-pages), the previous
 * screen's title for the "‹ Back" label, and a way to register the bar so the
 * shell hides its own floating control while a bar is shown.
 *
 * Null outside AppShell (auth screens): the bar then has no leading control.
 */
export type ShellNav = {
  leading: "menu" | "back";
  openDrawer: () => void;
  goBack: () => void;
  /** Title of the screen a back tap returns to, or null when unknown. */
  backTitle: string | null;
  /** Register this screen's bar title; returns the unregister cleanup. */
  registerBar: (title: string) => () => void;
};

export const ShellNavContext = createContext<ShellNav | null>(null);
