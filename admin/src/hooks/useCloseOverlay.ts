import { useLocation, useNavigate } from "react-router-dom";
import { hasInAppHistory } from "@/components/BackButton";

type OverlayState = { listSearch?: string } | null;

/** Router state for a list opening its own overlay route (/orders/:id,
 * /wallet/fix): remembers the list's query string. */
export const overlayFromList = (search: URLSearchParams) => ({ listSearch: search.toString() });

/** Closing an overlay route. Opened from its list with the same filters, it
 * steps back in history, so "Orqaga" on the list never reopens the overlay.
 * Otherwise it goes to `target` (replacing the overlay entry if it came
 * from the list with other filters). */
export function useCloseOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as OverlayState)?.listSearch;
  return (target: { pathname: string; search: string }) => {
    if (from !== undefined && hasInAppHistory() && from === target.search) navigate(-1);
    else navigate(target, { replace: from !== undefined });
  };
}
