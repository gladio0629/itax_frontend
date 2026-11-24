import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { CallResultOption } from "@/api/ops/types";

/** Server list of call results (doc 2.5); null while loading or on error. */
export function useCallResults(): CallResultOption[] | null {
  const [results, setResults] = useState<CallResultOption[] | null>(null);
  useEffect(() => {
    let live = true;
    api
      .getCallResults()
      .then((r) => live && setResults(r))
      .catch(() => live && setResults(null));
    return () => {
      live = false;
    };
  }, []);
  return results;
}
