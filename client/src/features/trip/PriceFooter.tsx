import type { Quote } from "@/api/types";
import { formatSom } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { Icon, PrimaryButton } from "@/ui";

type Load<T> = { status: "loading" } | { status: "error" } | { status: "success"; data: T };

/**
 * Bottom of the order steps (design: Trip, Cargo, CargoTerms): the server's
 * price on the left, the step's main button on the right. A failed quote
 * offers a retry (or names the rule the server refused, e.g. a drop-off in
 * another city on "Shahar ichi").
 */
export function PriceFooter({
  quote,
  ready,
  label,
  onNext,
  disabled,
  hint,
  error,
  onRetry,
}: {
  quote: Load<Quote>;
  /** The quote matches the screen (false while re-pricing). */
  ready: boolean;
  label: string;
  onNext: () => void;
  disabled?: boolean;
  hint?: string;
  /** A rule the server refused, already translated; null: generic failure with retry. */
  error?: string | null;
  onRetry: () => void;
}) {
  const { t, intlTag } = useT();
  return (
    <div className="flex flex-col gap-1">
      {hint && <span className="text-center text-[13px] font-semibold text-iz-muted">{hint}</span>}
      <div className="flex items-center gap-4">
        <div className="flex shrink-0 flex-col gap-0.5" aria-live="polite">
          <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("trip.price")}</span>
          <span className="whitespace-nowrap text-[20px] font-extrabold tabular-nums text-iz-ink">
            {quote.status === "success" ? formatSom(quote.data.total, intlTag) : quote.status === "error" ? "—" : "…"}
          </span>
        </div>
        <PrimaryButton className="flex-1" disabled={disabled || quote.status !== "success" || !ready} onClick={onNext}>
          {label}
        </PrimaryButton>
      </div>
      {quote.status === "error" &&
        (error ? (
          <p role="alert" className="text-center text-[13px] font-semibold text-iz-danger">
            {error}
          </p>
        ) : (
          <button type="button" onClick={onRetry} role="alert" className="flex h-11 items-center justify-center gap-2 text-[13px] font-bold text-iz-danger">
            <Icon name="refresh" size={16} />
            {t("trip.priceFailed")} · {t("common.retry")}
          </button>
        ))}
    </div>
  );
}
