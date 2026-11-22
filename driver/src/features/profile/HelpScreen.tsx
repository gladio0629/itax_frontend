import { useState } from "react";
import { api } from "@/api/client";
import type { HelpRequest, HelpTopic } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { relativeTime } from "@/lib/relative";
import { Check, ChevronDown, Phone } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card, SectionLabel } from "@/components/Card";
import { Button } from "@/components/Button";
import { Chip } from "@/components/Chip";
import { ReviewStatus } from "@/components/ReviewStatus";
import { cn } from "@/lib/cn";

const FAQ = ["commission", "debt", "docs"] as const;
const TOPICS: HelpTopic[] = ["order", "payment", "app", "docs"];

/** `back`: where the header arrow goes (Profil, or the registration step). */
export default function HelpScreen({ back = "/profile" }: { back?: string }) {
  const { t } = useT();
  const [open, setOpen] = useState<number | null>(0);
  const [topic, setTopic] = useState<HelpTopic>("order");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const profile = useQuery(() => api.getProfile(), []);
  const previous = useQuery(() => api.getHelpRequests(), [sent]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.submitHelpRequest(topic, message.trim() || undefined);
      setReviewId(r.id);
      previous.reload(true);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("help.title")} back={back} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        <SectionLabel>{t("help.faqTitle")}</SectionLabel>
        <Card className="mb-6 divide-y divide-line">
          {FAQ.map((k, i) => {
            const expanded = open === i;
            return (
              <div key={k}>
                <h3>
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`faq-${k}`}
                    onClick={() => setOpen(expanded ? null : i)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="text-base text-ink">{t(`help.faq.${k}.q`)}</span>
                    <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform", expanded && "rotate-180")} />
                  </button>
                </h3>
                {expanded && (
                  <p id={`faq-${k}`} className="animate-fade-in px-4 pb-4 text-sm text-muted">
                    {t(`help.faq.${k}.a`)}
                  </p>
                )}
              </div>
            );
          })}
        </Card>

        <SectionLabel>{t("help.supportTitle")}</SectionLabel>
        <Card className="mb-6 p-4">
          {reviewId ? (
            sent ? (
              <div className="flex animate-fade-up flex-col items-center py-4 text-center">
                <span className="mb-3 flex h-14 w-14 animate-check-pop items-center justify-center rounded-full bg-success text-bg">
                  <Check className="h-6 w-6" />
                </span>
                <p className="text-lg font-bold text-ink">{t("help.sentTitle")}</p>
                <p className="mt-1 text-sm text-muted">{t("help.sentDesc")}</p>
                <Button
                  variant="secondary"
                  className="mt-5"
                  onClick={() => {
                    setReviewId(null);
                    setSent(false);
                    setMessage("");
                  }}
                >
                  {t("help.newRequest")}
                </Button>
              </div>
            ) : (
              <ReviewStatus compact reviewId={reviewId} title={t("help.reviewTitle")} description={t("help.reviewDesc")} onApproved={() => setSent(true)} />
            )
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <p className="mb-3 text-sm text-muted">{t("help.intro")}</p>
              <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label={t("help.topicsLabel")}>
                {TOPICS.map((tp) => (
                  <Chip key={tp} selected={topic === tp} onClick={() => setTopic(tp)}>
                    {t(`help.topic.${tp}`)}
                  </Chip>
                ))}
              </div>
              <label htmlFor="help-msg" className="mb-2 block text-sm text-muted">
                {t("help.messageLabel")}
              </label>
              <textarea
                id="help-msg"
                name="message"
                rows={4}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("help.messagePlaceholder")}
                className="block w-full resize-none rounded-button bg-raised p-4 text-base text-ink outline-none placeholder:text-muted/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand focus-visible:outline-none"
              />
              <p className="tabular mt-1 text-right text-xs text-muted">{message.length}/500</p>
              {profile.data && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted">
                  <Phone className="h-4 w-4 shrink-0" />
                  {t("help.phoneHint", { phone: profile.data.phoneMasked })}
                </p>
              )}
              {error && (
                <p role="alert" className="mt-3 text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" size="lg" fullWidth className="mt-4" loading={busy}>
                {t("help.submit")}
              </Button>
            </form>
          )}
        </Card>

        {!!previous.data?.length && (
          <section aria-labelledby="prev-h">
            <SectionLabel id="prev-h">{t("help.previousTitle")}</SectionLabel>
            <ul className="space-y-2">
              {previous.data.map((r) => (
                <PrevRow key={r.id} r={r} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function PrevRow({ r }: { r: HelpRequest }) {
  const { t } = useT();
  return (
    <li className="flex min-h-[64px] items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-1">
      <div className="min-w-0">
        <p className="truncate text-base text-ink">{t(`help.topic.${r.topic}`)}</p>
        <p className="tabular text-sm text-muted">{relativeTime(r.createdAt, t)}</p>
      </div>
      <span className={cn("inline-flex h-8 shrink-0 items-center rounded-button px-3 text-sm font-medium", r.status === "resolved" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
        {t(`help.status.${r.status}`)}
      </span>
    </li>
  );
}
