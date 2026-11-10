import { useEffect, useState } from "react";
import { ChevronDown, LifeBuoy, Phone } from "lucide-react";
import { api } from "@/api/client";
import type { HelpRequest, HelpTopic, Profile } from "@/api/types";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ReviewStatus } from "@/components/ReviewStatus";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { formatRelativeDay } from "@/lib/format";
import { cn } from "@/lib/cn";

const FAQ_KEYS = ["help.faq.cancel", "help.faq.payment", "help.faq.noDriver"] as const;

const TOPICS: HelpTopic[] = ["order", "payment", "app", "other"];
const TOPIC_KEY: Record<HelpTopic, TranslationKey> = {
  order: "help.topic.order",
  payment: "help.topic.payment",
  app: "help.topic.app",
  other: "help.topic.other",
};

const STATUS_TONE: Record<HelpRequest["status"], "neutral" | "warning" | "accent"> = {
  pending: "neutral",
  in_review: "warning",
  resolved: "accent",
};

export function HelpScreen() {
  const { t, intlTag } = useT();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [topic, setTopic] = useState<HelpTopic>("order");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [previous, setPrevious] = useState<HelpRequest[]>([]);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
    api.getHelpRequests().then(setPrevious).catch(() => {});
  }, []);

  async function submit() {
    setSubmitting(true);
    setSubmitError(false);
    try {
      const review = await api.submitHelpRequest(topic, message.trim() || undefined);
      setReviewId(review.id);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title={t("history.help")} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="mb-2 px-1 text-xs font-semibold text-ink/60">{t("help.faqTitle")}</p>
        <Card className="mb-5 divide-y divide-border" padded={false}>
          {FAQ_KEYS.map((key, i) => (
            <div key={key}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-ink">{t(`${key}.q` as TranslationKey)}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink/60 transition-transform", openIndex === i && "rotate-180")} />
              </button>
              {openIndex === i && <p className="px-4 pb-4 text-sm text-ink/60">{t(`${key}.a` as TranslationKey)}</p>}
            </div>
          ))}
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/60">{t("help.supportTitle")}</p>
        <Card className="mb-5 p-5">
          {reviewId ? (
            sent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-10 text-accent">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-ink">{t("help.sentTitle")}</p>
                <p className="text-xs text-ink/60">{t("help.sentDesc")}</p>
              </div>
            ) : (
              <ReviewStatus
                reviewId={reviewId}
                title={t("help.sentTitle")}
                description={t("help.reviewingDesc")}
                onApproved={() => setSent(true)}
              />
            )
          ) : (
            <>
              <p className="mb-3 text-sm text-ink/60">{t("help.intro")}</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {TOPICS.map((tp) => (
                  <button
                    key={tp}
                    onClick={() => setTopic(tp)}
                    className={cn(
                      "rounded-xl border-2 px-4 py-2 text-xs font-semibold transition-colors",
                      topic === tp ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
                    )}
                  >
                    {t(TOPIC_KEY[tp])}
                  </button>
                ))}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder={t("help.messagePlaceholder")}
                rows={4}
                maxLength={500}
                className="mb-3 w-full resize-none rounded-xl border border-border bg-bg p-3 text-sm text-ink outline-none focus:border-accent"
              />
              {profile && (
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-ink/5 px-3 py-2.5">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-ink/60" />
                  <span className="text-xs text-ink/70">{t("help.phoneHint", { phone: profile.phoneMasked })}</span>
                </div>
              )}
              {submitError && <p className="mb-3 text-xs font-medium text-danger">{t("order.submitError")}</p>}
              <Button fullWidth loading={submitting} onClick={submit}>
                {t("help.submit")}
              </Button>
            </>
          )}
        </Card>

        {previous.length > 0 && (
          <>
            <p className="mb-2 px-1 text-xs font-semibold text-ink/60">{t("help.previousTitle")}</p>
            <div className="space-y-2">
              {previous.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-2xl bg-card p-4 shadow-softer">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{t(r.topicKey as TranslationKey)}</p>
                    <p className="text-xs text-ink/60">{formatRelativeDay(r.createdAt, intlTag)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[r.status]}>{t(`help.status.${r.status}` as TranslationKey)}</Badge>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
