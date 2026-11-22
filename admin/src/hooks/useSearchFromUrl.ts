import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/** A list opened from the header search arrives with `?q=`: copy it into the
 * list's own search box once, then drop it from the URL. */
export function useSearchFromUrl(setSearch: (v: string) => void) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q");
  useEffect(() => {
    if (q === null) return;
    setSearch(q);
    const next = new URLSearchParams(params);
    next.delete("q");
    setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
}
