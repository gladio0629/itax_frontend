import { useCallback, useEffect, useRef, useState } from "react";
import { useDebouncedValue } from "./useDebouncedValue";

type BaseQuery = { search?: string } & Record<string, string | boolean | undefined>;

/**
 * Fetches a list through an adapter method that itself does the filtering
 * (search + any other query params) — screens never filter business data
 * client-side. `search` is debounced; every other field in `query` applies
 * immediately. A request counter drops stale responses, since withLatency's
 * randomized delay means an older query can resolve after a newer one.
 */
export function useAdapterList<Q extends BaseQuery, T>(fetcher: (query: Q) => Promise<T[]>, query: Q) {
  const { search, ...rest } = query;
  const debouncedSearch = useDebouncedValue(search ?? "", 300);
  const restKey = JSON.stringify(rest);

  const [items, setItems] = useState<T[] | null>(null);
  const [error, setError] = useState(false);
  const requestRef = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(() => {
    const reqId = ++requestRef.current;
    setError(false);
    const effectiveQuery = { ...JSON.parse(restKey), search: debouncedSearch } as Q;
    fetcherRef.current(effectiveQuery).then(
      (res) => {
        if (reqId === requestRef.current) setItems(res);
      },
      () => {
        if (reqId === requestRef.current) setError(true);
      }
    );
    // restKey already encodes every filter value; debouncedSearch is the other half.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, restKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, error, reload: load };
}
