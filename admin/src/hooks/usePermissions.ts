import { useEffect } from "react";
import { useMeStore } from "@/stores/meStore";

export function usePermissions() {
  const me = useMeStore((s) => s.me);
  const loading = useMeStore((s) => s.loading);
  const error = useMeStore((s) => s.error);
  const load = useMeStore((s) => s.load);

  useEffect(() => {
    if (!me && !loading) load();
  }, [me, loading, load]);

  return { me, loading, error };
}
