import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | undefined; error: unknown; loading: boolean };

/**
 * Minimal data hook: runs `fn` on mount and when `deps` change; reload().
 * Optional polling: the next poll is scheduled only after the previous
 * request settles, so slow responses are never discarded as stale. Keeps
 * previous data while refetching so polled screens never flash a skeleton.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], opts?: { pollMs?: number | null }) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);
  const inFlight = useRef(false);

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    inFlight.current = true;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      // A failed silent refresh keeps the last good data on screen.
      if (id === seq.current) setState((s) => ({ data: s.data, error: silent && s.data !== undefined ? null : error, loading: false }));
    } finally {
      if (id === seq.current) inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const pollMs = opts?.pollMs;
  useEffect(() => {
    if (!pollMs) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      if (!inFlight.current) await run(true);
      if (!stopped) timer = setTimeout(tick, pollMs);
    };
    timer = setTimeout(tick, pollMs);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [pollMs, run]);

  const setData = useCallback((d: T) => {
    seq.current++; // supersede any in-flight request
    inFlight.current = false;
    setState({ data: d, error: null, loading: false });
  }, []);

  return { ...state, reload: run, setData };
}
