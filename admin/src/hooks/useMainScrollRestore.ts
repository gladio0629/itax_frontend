import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** Last scroll offset of the layout's <main> per history entry. */
const offsets = new Map<string, number>();
/** Give up waiting for a list to load after this long. */
const RESTORE_TIMEOUT_MS = 3000;

/**
 * The admin scrolls inside <main>, not the window, so the browser does not
 * restore it. On Back/Forward ("Orqaga" or the browser button) this puts the
 * page back where it was, waiting for the list to load if it re-fetches.
 * Other navigations are left alone (a drawer over a list keeps its scroll).
 */
export function useMainScrollRestore(mainRef: RefObject<HTMLElement>) {
  const location = useLocation();
  const navType = useNavigationType();
  const keyRef = useRef(location.key);

  // Remember the offset of the entry being viewed.
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const onScroll = () => offsets.set(keyRef.current, main.scrollTop);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [mainRef]);

  useLayoutEffect(() => {
    keyRef.current = location.key;
    const main = mainRef.current;
    const target = offsets.get(location.key);
    if (!main || navType !== "POP" || !target) return;

    const content = main.firstElementChild;
    let done = false;
    const finish = () => {
      done = true;
      observer.disconnect();
      clearTimeout(timer);
      for (const ev of USER_SCROLL) main.removeEventListener(ev, finish);
    };
    const attempt = () => {
      if (done) return;
      if (main.scrollHeight - main.clientHeight >= target) {
        main.scrollTop = target;
        finish();
      }
    };
    const observer = new ResizeObserver(attempt);
    if (content) observer.observe(content);
    const timer = setTimeout(finish, RESTORE_TIMEOUT_MS);
    // The user scrolling first wins.
    for (const ev of USER_SCROLL) main.addEventListener(ev, finish, { passive: true });
    attempt();
    return finish;
  }, [location.key, navType, mainRef]);
}

const USER_SCROLL = ["wheel", "touchmove", "keydown"] as const;
