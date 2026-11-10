import { useCallback, useEffect, useRef, useState } from "react";

type QueryState<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "success"; data: T };

/**
 * Minimal fetch hook with a request-id guard: under slow/flaky demo
 * scenarios (1.8-3.2s latency, random failures) an older in-flight call can
 * resolve after a newer one — this drops any response that isn't the most
 * recent request for the current deps.
 */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<QueryState<T>>({ status: "loading" });
  const requestId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(() => {
    const id = ++requestId.current;
    setState({ status: "loading" });
    fnRef.current().then(
      (data) => {
        if (id === requestId.current) setState({ status: "success", data });
      },
      (error) => {
        if (id === requestId.current) setState({ status: "error", error });
      }
    );
  }, []);

  // deps is an intentionally dynamic dependency list supplied by the caller
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(run, deps);

  return { ...state, refetch: run };
}
