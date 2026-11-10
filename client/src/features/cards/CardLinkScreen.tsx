import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, CreditCard } from "@/lib/icons";
import { api } from "@/api/client";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useT } from "@/lib/i18n/provider";
import { useLiftDemoFab } from "@/stores/demoStore";

/**
 * Simulated provider-hosted card-link page. IZGO never collects a card
 * number, expiry or CVV, even as fake demo data — only a label the user
 * picks for themself. The (simulated) provider is what "tokenizes" a card
 * and hands back a brand + last 4 digits; mock.ts invents those.
 */
export function CardLinkScreen() {
  const footerRef = useRef<HTMLDivElement>(null);
  useLiftDemoFab(footerRef);
  const { t } = useT();
  const navigate = useNavigate();
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState(false);

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const review = await api.linkCard({ label: label.trim() || t("cardLink.defaultLabel") });
      setReviewId(review.id);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewId) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title={t("cardLink.title")} />
        <div className="flex flex-1 items-center justify-center">
          <ReviewStatus reviewId={reviewId} onApproved={() => navigate("/cards", { replace: true })} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title={t("cardLink.title")} />
      <div className="scroll-pb-bar flex-1 overflow-y-auto overscroll-contain px-4">
        <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl bg-on-yellow p-6 text-center text-white shadow-soft">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <CreditCard className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold">{t("cardLink.providerTitle")}</p>
          <p className="text-xs text-white/80">{t("cardLink.providerDesc")}</p>
        </div>

        <div className="space-y-4 rounded-2xl bg-card p-5 shadow-softer">
          <Input
            label={t("cardLink.labelField")}
            placeholder={t("cardLink.labelPlaceholder")}
            name="card-label"
            autoComplete="off"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <p className="mt-4 flex items-center gap-2 text-xs text-ink/60">
          <ShieldCheck className="h-3.5 w-3.5" /> {t("cardLink.privacyNote")}
        </p>
      </div>
      <div ref={footerRef} className="px-4 pt-3" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        {submitError && <p className="mb-3 text-xs font-normal text-danger">{t("cardLink.error")}</p>}
        <Button fullWidth loading={submitting} onClick={submit}>
          {t("cardLink.submit")}
        </Button>
      </div>
    </div>
  );
}
