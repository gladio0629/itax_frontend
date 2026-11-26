import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { waitForReview } from "@/lib/waitForReview";
import { Field, Icon, PrimaryButton, Screen } from "@/ui";

/**
 * Card linking, design v2. IZGO never collects a card number, expiry or CVV:
 * the passenger names the card and continues to the provider's own page;
 * the provider hands back only the brand and the last 4 digits.
 */
export function CardLinkScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);
  const signal = useRef({ cancelled: false });

  useEffect(() => {
    const s = { cancelled: false };
    signal.current = s;
    return () => {
      s.cancelled = true;
    };
  }, []);

  async function submit() {
    setSubmitting(true);
    setError(false);
    try {
      const review = await api.linkCard({ label: label.trim() || t("cardLink.defaultLabel") });
      const verdict = review.status === "pending" ? await waitForReview(review.id, signal.current) : review.status;
      if (verdict === "cancelled") return;
      if (verdict === "approved") navigate("/cards", { replace: true });
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      title={t("cardLink.title")}
      top={
        <div className="flex items-start gap-3.5 rounded-iz-card bg-iz-head-card p-4">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
            <Icon name="shield" />
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px] font-extrabold text-iz-head-text">{t("cardLink.providerTitle")}</span>
            <span className="text-[13px] leading-[19px] text-iz-head-muted">{t("cardLink.providerDesc")}</span>
          </span>
        </div>
      }
      footer={
        <>
          {error && (
            <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
              {t("cardLink.error")}
            </p>
          )}
          <PrimaryButton loading={submitting} onClick={submit}>
            {t("cardLink.submit")}
          </PrimaryButton>
        </>
      }
    >
      <Field
        label={t("cardLink.labelField")}
        icon="card"
        placeholder={t("cardLink.labelPlaceholder")}
        name="card-label"
        autoComplete="off"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <p className="flex items-center gap-2 px-1 text-[13px] text-iz-muted">
        <Icon name="lock" size={16} className="shrink-0" />
        {t("cardLink.privacyNote")}
      </p>
    </Screen>
  );
}
