import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads one server resource for an operator window. `key` changes refetch
 * it; older answers that arrive late are dropped. The previous data stays
 * on screen while a new page or filter loads (`loading` is true then).
 */
export function useOpData<T>(fetcher: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reqRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    const id = ++reqRef.current;
    setLoading(true);
    setError(null);
    fetcherRef.current().then(
      (r) => {
        if (id !== reqRef.current) return;
        setData(r);
        setLoading(false);
      },
      (e: unknown) => {
        if (id !== reqRef.current) return;
        setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
        setLoading(false);
      }
    );
  }, []);

  useEffect(load, [key, load]);

  return { data, error, loading, reload: load, setData };
}
