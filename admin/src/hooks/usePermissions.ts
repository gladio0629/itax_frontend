import { useEffect } from "react";
import { useMeStore } from "@/stores/meStore";

export function usePermissions() {
  const me = useMeStore((s) => s.me);
  const loading = useMeStore((s) => s.loading);
  const error = useMeStore((s) => s.error);
  const load = useMeStore((s) => s.load);

  // Load once; after a failure wait for an explicit retry instead of looping.
  useEffect(() => {
    if (!me && !loading && !error) load();
  }, [me, loading, error, load]);

  return { me, loading, error, retry: load };
}
