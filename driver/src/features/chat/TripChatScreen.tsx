import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { ChatMessage, ChatSend } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { formatTime } from "@/lib/format";
import { MessageCircle, MessageSquareText, Send } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonList } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { Spinner } from "@/components/Spinner";
import { cn } from "@/lib/cn";

/** Mock chat with the passenger of the active trip: quick replies + free text. */
export default function TripChatScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const q = useQuery(() => api.getTripChat(), [], { pollMs: 2000 });
  const chat = q.data;
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const count = chat?.messages.length ?? 0;

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);

  async function send(message: ChatSend) {
    if (!chat || sending) return;
    setSending(true);
    try {
      q.setData(await api.sendTripMessage(chat.tripId, message));
      if ("text" in message) setDraft("");
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setSending(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (draft.trim()) send({ text: draft });
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={chat?.peerName ?? t("chat.title")} back />
      {q.error && chat === undefined ? (
        <div className="px-4">
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        </div>
      ) : chat === undefined ? (
        <div className="px-4 pt-2">
          <SkeletonList rows={3} label={t("common.loading")} />
        </div>
      ) : chat === null ? (
        <EmptyState
          icon={MessageCircle}
          title={t("chat.noTrip")}
          description={t("chat.noTripDesc")}
          action={
            <Button fullWidth onClick={() => navigate("/", { replace: true })}>
              {t("tab.home")}
            </Button>
          }
        />
      ) : (
        <>
          {chat.textOnly && (
            <p className="mx-4 mb-2 flex shrink-0 items-start gap-2 rounded-card bg-accent/15 px-3 py-2 text-sm text-ink">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {t("chat.textOnlyNote")}
            </p>
          )}
          <ol
            ref={listRef}
            aria-label={t("chat.title")}
            aria-live="polite"
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-2"
          >
            {chat.messages.length === 0 && <li className="py-8 text-center text-sm text-muted">{t("chat.empty")}</li>}
            {chat.messages.map((m) => (
              <Bubble key={m.id} m={m} peer={chat.peerName} />
            ))}
          </ol>

          <div className="shrink-0 border-t border-line bg-bg pb-3 pt-2">
            <div role="group" aria-label={t("chat.quickReplies")} className="no-scrollbar flex gap-2 overflow-x-auto px-4">
              {chat.quickReplies.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={sending}
                  onClick={() => send({ replyKey: k })}
                  className="press focus-inset inline-flex h-10 shrink-0 items-center rounded-full bg-raised px-4 text-sm font-medium text-ink disabled:opacity-50"
                >
                  {isKey(k) ? t(k) : k}
                </button>
              ))}
            </div>
            <form onSubmit={submit} className="mt-2 flex items-center gap-2 px-4">
              <label className="sr-only" htmlFor="chat-input">
                {t("chat.placeholder")}
              </label>
              <input
                id="chat-input"
                name="message"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={chat.maxLength}
                placeholder={t("chat.placeholder")}
                autoComplete="off"
                enterKeyHint="send"
                className="h-12 min-w-0 flex-1 rounded-full bg-surface px-4 text-base text-ink placeholder:text-muted"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label={t("chat.send")}
                className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-yellow text-on-yellow disabled:opacity-40"
              >
                {sending ? <Spinner className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function Bubble({ m, peer }: { m: ChatMessage; peer: string }) {
  const { t } = useT();
  const mine = m.from === "driver";
  const text = m.textKey && isKey(m.textKey) ? t(m.textKey) : m.text ?? "";
  return (
    <li className={cn("flex animate-fade-up", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-card px-3 py-2 text-base",
          mine ? "rounded-br-none bg-yellow text-on-yellow" : "rounded-bl-none bg-surface text-ink shadow-1"
        )}
      >
        <span className="sr-only">{mine ? t("chat.you") : peer}: </span>
        <p className="whitespace-pre-wrap break-words">{text}</p>
        <p className={cn("tabular mt-0.5 text-right text-xs", mine ? "text-on-yellow/70" : "text-muted")}>{formatTime(m.at)}</p>
      </div>
    </li>
  );
}
