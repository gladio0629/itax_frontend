import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/api/client";
import type { HelpRequest, HelpTopic, Profile } from "@/api/types";
import { ReviewStatus } from "@/components/ReviewStatus";
import { formatRelativeDay } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { rich } from "@/lib/i18n/rich";
import { cn } from "@/lib/cn";
import { Badge, Chip, Icon, PrimaryButton, Screen, SectionLabel, TextAreaField } from "@/ui";

const TOPICS: HelpTopic[] = ["trip", "payment", "driver", "account", "other"];
const FAQ_KEYS = ["help.faq.cancel", "help.faq.payment", "help.faq.noDriver"] as const;
const STATUS_TONE: Record<HelpRequest["status"], "muted" | "warn" | "green"> = { pending: "muted", in_review: "warn", resolved: "green" };
const MESSAGE_MAX = 500;

/**
 * Yordam (design v2: Help / KbHelp): a reason, a short message and the number
 * the operator will call; "Zayavka qoldirish" goes to review. Below: the
 * frequent questions and earlier requests (current app). A trip's "Yordam"
 * opens this with the Safar reason picked (?topic=trip).
 */
export function HelpScreen() {
  const { t, intlTag } = useT();
  const [params] = useSearchParams();
  const initial = params.get("topic") as HelpTopic | null;
  const [topic, setTopic] = useState<HelpTopic>(initial && TOPICS.includes(initial) ? initial : "trip");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [previous, setPrevious] = useState<HelpRequest[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  function loadPrevious() {
    api.getHelpRequests().then(setPrevious).catch(() => setPrevious([]));
  }
  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => setProfile(null));
    loadPrevious();
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

  function again() {
    setReviewId(null);
    setSent(false);
    setMessage("");
  }

  return (
    <Screen
      title={t("history.help")}
      top={
        <div className="flex flex-col gap-2">
          <h2 className="text-[28px] font-extrabold leading-9 text-iz-head-text">{rich(t("help.headline"), { green: <span className="text-iz-green">{t("help.headlineGreen")}</span> })}</h2>
          <p className="text-[14px] leading-[21px] text-iz-head-muted">{t("help.headlineDesc")}</p>
        </div>
      }
      bodyClassName="gap-3.5 pt-6 kb:pt-5"
      footer={
        reviewId ? (
          sent ? (
            <PrimaryButton icon="edit" onClick={again}>
              {t("help.again")}
            </PrimaryButton>
          ) : undefined
        ) : (
          <>
            {submitError && (
              <p role="alert" className="pb-1 text-[13px] font-semibold text-iz-danger">
                {t("help.submitError")}
              </p>
            )}
            <PrimaryButton loading={submitting} onClick={submit}>
              {t("help.submit")}
            </PrimaryButton>
          </>
        )
      }
    >
      {reviewId ? (
        sent ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center" role="status">
            <span aria-hidden className="flex h-14 w-14 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
              <Icon name="check" size={26} strokeWidth={2.6} />
            </span>
            <span className="text-[18px] font-extrabold text-iz-ink">{t("help.sentTitle")}</span>
            <span className="max-w-[280px] text-[14px] text-iz-muted">{t("help.sentDesc")}</span>
          </div>
        ) : (
          <ReviewStatus
            reviewId={reviewId}
            title={t("help.sentTitle")}
            description={t("help.reviewingDesc")}
            onApproved={() => {
              setSent(true);
              loadPrevious();
            }}
            onRejected={() => {
              setSent(true);
              loadPrevious();
            }}
          />
        )
      ) : (
        <>
          <section className="flex flex-col gap-2.5 kb:contents" aria-labelledby="help-reason">
            <SectionLabel id="help-reason" as="h3" className="kb:hidden">
              {t("help.reason")}
            </SectionLabel>
            <div role="group" aria-labelledby="help-reason" className="-mx-5 flex flex-wrap gap-2 px-5 kb:flex-nowrap kb:overflow-x-auto kb:no-scrollbar">
              {TOPICS.map((tp) => (
                <Chip key={tp} selected={topic === tp} onClick={() => setTopic(tp)}>
                  {t(`help.topic.${tp}` as TranslationKey)}
                </Chip>
              ))}
            </div>
          </section>
          <TextAreaField
            className="kb:flex-1 [&>label]:kb:flex-1"
            label={t("help.messageLabel")}
            placeholder={t("help.messagePlaceholder")}
            rows={4}
            maxLength={MESSAGE_MAX}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value.slice(0, MESSAGE_MAX));
              setSubmitError(false);
            }}
          />
          {profile && (
            <div className="flex h-[68px] shrink-0 items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 kb:hidden">
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink">
                <Icon name="phone" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{t("help.callNumber")}</span>
                <span className="truncate text-[16px] font-extrabold text-iz-ink">{profile.phoneMasked}</span>
              </span>
            </div>
          )}
        </>
      )}

      <section className="mt-3 flex flex-col kb:hidden" aria-labelledby="help-faq">
        <SectionLabel id="help-faq" as="h3">
          {t("help.faqTitle")}
        </SectionLabel>
        {FAQ_KEYS.map((key, i) => {
          const open = openFaq === i;
          return (
            <div key={key} className={cn(i < FAQ_KEYS.length - 1 && "border-b border-iz-border")}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenFaq(open ? null : i)}
                className="flex min-h-[60px] w-full items-center justify-between gap-3 py-2 text-left"
              >
                <span className="text-[15px] font-bold text-iz-ink">{t(`${key}.q` as TranslationKey)}</span>
                <Icon name="chevronDown" size={18} className={cn("shrink-0 text-iz-muted transition-transform", open && "rotate-180")} />
              </button>
              {open && <p className="pb-4 text-[14px] leading-[21px] text-iz-muted">{t(`${key}.a` as TranslationKey)}</p>}
            </div>
          );
        })}
      </section>

      {previous.length > 0 && (
        <section className="mt-3 flex flex-col kb:hidden" aria-labelledby="help-prev">
          <SectionLabel id="help-prev" as="h3">
            {t("help.previousTitle")}
          </SectionLabel>
          {previous.map((r, i) => (
            <div key={r.id} className={cn("flex min-h-[60px] items-center justify-between gap-3 py-2", i < previous.length - 1 && "border-b border-iz-border")}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-[15px] font-bold text-iz-ink">{t(r.topicKey as TranslationKey)}</span>
                <span className="text-[12px] text-iz-muted">{formatRelativeDay(r.createdAt, intlTag)}</span>
              </span>
              <Badge tone={STATUS_TONE[r.status]}>{t(`help.status.${r.status}` as TranslationKey)}</Badge>
            </div>
          ))}
        </section>
      )}
    </Screen>
  );
}
