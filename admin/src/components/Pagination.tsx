import { Button } from "./Button";

/** v2 table footer: "1–7, jami 1 284" on the left, Oldingi / Keyingi pills
 * on the right. Works for page-number and cursor lists alike: the caller
 * says whether a previous/next page exists. */
export function Pagination({
  summary,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  loading,
}: {
  summary: string;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  loading?: boolean;
}) {
  return (
    <nav aria-label="Sahifalar" className="flex flex-wrap items-center justify-between gap-3 text-13 font-semibold text-muted">
      <span className="tabular" aria-live="polite">
        {summary}
      </span>
      <span className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={onPrev} disabled={!hasPrev || loading}>
          Oldingi
        </Button>
        <Button variant="dark" size="sm" onClick={onNext} disabled={!hasNext || loading}>
          Keyingi
        </Button>
      </span>
    </nav>
  );
}
