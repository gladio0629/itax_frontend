import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | undefined; error: unknown; loading: boolean };

/**
 * Minimal data hook: runs `fn` on mount and whenever `deps` change, exposes
 * reload(). Optional polling interval. Keeps previous data while refetching
 * so polled screens never flash a skeleton.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], opts?: { pollMs?: number | null }) {
  const [state, setState] = useState<State<T>>({ data: undefined, error: null, loading: true });
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef.current();
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      // A failed silent poll keeps the last good data on screen.
      if (id === seq.current) setState((s) => ({ data: s.data, error: silent && s.data !== undefined ? null : error, loading: false }));
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const pollMs = opts?.pollMs;
  useEffect(() => {
    if (!pollMs) return;
    const timer = setInterval(() => run(true), pollMs);
    return () => clearInterval(timer);
  }, [pollMs, run]);

  return { ...state, reload: run, setData: (d: T) => setState({ data: d, error: null, loading: false }) };
}
