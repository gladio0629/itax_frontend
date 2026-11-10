import { createContext, useContext, useLayoutEffect } from "react";

/**
 * What sits behind AppShell's floating hamburger/back arrow. Screens with a
 * dark header (e.g. Bonuslar's navy hero, navy in both themes) declare
 * "onDark" so the icon switches to white; everything else is "auto" and the
 * icon follows the theme's ink colour.
 */
export type HeaderTone = "auto" | "onDark";

export const HeaderToneContext = createContext<(tone: HeaderTone) => void>(() => {});

export function useHeaderTone(tone: HeaderTone) {
  const setTone = useContext(HeaderToneContext);
  useLayoutEffect(() => {
    setTone(tone);
    return () => setTone("auto");
  }, [tone, setTone]);
}
