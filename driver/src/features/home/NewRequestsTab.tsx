import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { FeedPage, FeedType, RideRequest } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { waitReview } from "@/lib/waitReview";
import { CalendarDays, ChevronDown, Inbox, RefreshCw } from "@/lib/icons";
import { Chip } from "@/components/Chip";
import { Sheet } from "@/components/Sheet";
import { PullList } from "@/components/PullList";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/Button";
import { DebtBanner } from "@/features/wallet/DebtBanner";
import type { HomeSummary } from "@/api/types";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { RequestCard } from "./RequestCard";
import { RejectSheet } from "./RejectSheet";
import { NotifyPrompt } from "./NotifyPrompt";
import { dayText } from "./whenText";

type Q = { data: FeedPage | undefined; error: unknown; loading: boolean; reload: (silent?: boolean) => Promise<void> | void };

type Props = {
  feed: Q;
  date: string;
  type: FeedType;
  highlightId: string | null;
  summary: HomeSummary | undefined;
  onFilter: (patch: { date?: string; type?: FeedType }) => void;
  onAccepted: () => void;
};

export function NewRequestsTab({ feed, date, type, highlightId, summary, onFilter, onAccepted }: Props) {
  const { t } = useT();
  const navigate = useNavigate();
  const page = feed.data;
  const [accepting, setAccepting] = useState<string | null>(null);
  const [leaving, setLeaving] = useState<Record<string, "taken" | "out">>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [rejecting, setRejecting] = useState<RideRequest | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Opened from a banner: bring the card into view.
  useEffect(() => {
    if (!highlightId || !page) return;
    // Scroll only the list: scrollIntoView would also move the swipeable tab track.
    const el = document.getElementById(`req-${highlightId}`);
    const sc = scroller.current;
    if (!el || !sc) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 12;
    sc.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [highlightId, page]);

  async function accept(r: RideRequest) {
    setAccepting(r.id);
    try {
      const done = await waitReview(await api.acceptRequest(r.id));
      if (done.status === "approved") {
        setLeaving((m) => ({ ...m, [r.id]: "out" }));
        toast(t("feed.accepted"), "success");
        onAccepted();
      } else if (done.resultKey === "request.taken") {
        setLeaving((m) => ({ ...m, [r.id]: "taken" }));
      } else {
        toast(done.resultKey && isKey(done.resultKey) ? t(done.resultKey) : t("error.generic"), "danger");
        feed.reload(true);
      }
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      feed.reload(true);
    } finally {
      setAccepting(null);
    }
  }

  async function reject(reasonKey?: string) {
    if (!rejecting) return;
    const id = rejecting.id;
    setRejectBusy(true);
    try {
      await api.rejectRequest(id, reasonKey);
      setRejecting(null);
      setLeaving((m) => ({ ...m, [id]: "out" }));
      toast(t("feed.rejected"));
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setRejectBusy(false);
    }
  }

  const items = page?.items.filter((r) => !gone.has(r.id)) ?? [];
  const dateChoice = date === "today" || date === "tomorrow" ? null : page?.dates.find((d) => d.date === date) ?? null;

  return (
    <>
      <PullList ref={scroller} onRefresh={() => feed.reload(true)} pullLabel={t("feed.pull")} releaseLabel={t("feed.release")}>
        <div className="space-y-3 px-4 pb-6 pt-3">
          <div className="space-y-2" role="group" aria-label={t("feed.filters")}>
            <div className="flex items-center gap-2">
              <Chip selected={date === "today"} onClick={() => onFilter({ date: "today" })} className="h-10 px-3">
                {t("common.today")}
              </Chip>
              <Chip selected={date === "tomorrow"} onClick={() => onFilter({ date: "tomorrow" })} className="h-10 px-3">
                {t("common.tomorrow")}
              </Chip>
              <Chip selected={!!dateChoice} onClick={() => setDateOpen(true)} className="h-10 min-w-0 px-3" aria-haspopup="dialog">
                <CalendarDays className="h-4 w-4 shrink-0" />
                <span className="truncate">{dateChoice ? formatDate(dateChoice.dayStart, t) : t("feed.pickDate")}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Chip>
              <button
                type="button"
                onClick={() => feed.reload()}
                aria-label={t("feed.refresh")}
                className="press ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-button bg-raised text-ink"
              >
                <RefreshCw className={cn("h-4 w-4", feed.loading && "animate-spin")} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {(["all", "passengers", "delivery"] as const).map((k) => (
                <Chip key={k} selected={type === k} onClick={() => onFilter({ type: k })} className="h-10 px-3">
                  {k === "all" ? t("common.all") : k === "passengers" ? t("feed.type.passengers") : t("feed.type.cargo")}
                </Chip>
              ))}
            </div>
          </div>

          {summary && summary.debt.level !== "ok" && <DebtBanner level={summary.debt.level} onTopup={() => navigate("/wallet/topup")} />}
          <NotifyPrompt />

          <div aria-busy={feed.loading} className="space-y-3">
            {feed.error && !page ? (
              <ErrorState error={feed.error} onRetry={() => feed.reload()} />
            ) : !page ? (
              <div role="status" aria-label={t("common.loading")} className="space-y-3">
                <Skeleton className="h-72 rounded-card" />
                <Skeleton className="h-72 rounded-card" />
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title={t("feed.empty")}
                description={t("feed.emptyDesc", { day: dayText(page.seats.when, t) })}
                action={
                  <Button variant="secondary" fullWidth onClick={() => feed.reload()}>
                    <RefreshCw className="h-5 w-5" />
                    {t("feed.refresh")}
                  </Button>
                }
              />
            ) : (
              items.map((r) => (
                <RequestCard
                  key={r.id}
                  request={r}
                  accepting={accepting === r.id}
                  leaving={leaving[r.id] ?? null}
                  highlight={highlightId === r.id}
                  onAccept={() => accept(r)}
                  onReject={() => setRejecting(r)}
                  onGone={() => {
                    setGone((s) => new Set(s).add(r.id));
                    feed.reload(true);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </PullList>

      <RejectSheet open={!!rejecting} busy={rejectBusy} onClose={() => setRejecting(null)} onConfirm={reject} />

      <Sheet open={dateOpen} onClose={() => setDateOpen(false)} title={t("feed.pickDate")}>
        <div className="grid grid-cols-2 gap-2 pb-1">
          {page?.dates.map((d) => (
            <Chip
              key={d.date}
              selected={date === d.date || (d.dayOffset === 0 && date === "today") || (d.dayOffset === 1 && date === "tomorrow")}
              onClick={() => {
                onFilter({ date: d.dayOffset === 0 ? "today" : d.dayOffset === 1 ? "tomorrow" : d.date });
                setDateOpen(false);
              }}
            >
              {d.dayOffset <= 1 ? `${dayText(d, t)}, ${formatDate(d.dayStart, t)}` : formatDate(d.dayStart, t)}
            </Chip>
          ))}
        </div>
      </Sheet>
    </>
  );
}
