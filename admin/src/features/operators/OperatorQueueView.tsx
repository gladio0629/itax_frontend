import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Headset, Phone, Search } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { SearchInput, TextArea } from "@/components/Input";
import { FilterSelect } from "@/components/FilterSelect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { MiniStat } from "@/components/Cells";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { orderNo } from "@/features/orders/labels";
import { REASON, REASON_CHIPS, RESULT, SUBJECT_LABEL, Tag, since } from "./labels";
import { useCallResults } from "@/features/ops/useCallResults";
import type { ActiveTask, HistoryResult, OperatorMyStats, QueueReason } from "@/api/types";
import type { CallResultOption } from "@/api/ops/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

/** The operator's "Navbat" (design OperatorView): the current task with
 * result, comment, postpone and finish; the day's numbers; the queue with
 * Boshlash / Rad etish. All rules (one active task, who may act) are the
 * server's; the UI only sends the operator's choices. */
export function OperatorQueueView() {
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState<QueueReason | "all">("all");
  const { items: queue, error, reload } = useAdapterList(api.getQueue, caps.queueFilters ? { search, reason } : {});
  const [active, setActive] = useState<ActiveTask | null | undefined>(undefined);
  const [activeError, setActiveError] = useState(false);
  const [stats, setStats] = useState<OperatorMyStats | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const results = useCallResults();

  // Every change of the active task bumps this, so a late answer from an
  // older getActiveTask() (e.g. the refresh after "Yakunlash") can't
  // overwrite a task that "Boshlash" has started since.
  const activeSeq = useRef(0);
  const putActive = (t: ActiveTask | null) => {
    activeSeq.current++;
    setActive(t);
  };
  const loadActive = useCallback(() => {
    const my = ++activeSeq.current;
    setActiveError(false);
    api
      .getActiveTask()
      .then((t) => my === activeSeq.current && setActive(t))
      .catch(() => my === activeSeq.current && setActiveError(true));
  }, []);
  const loadStats = useCallback(() => {
    if (caps.operatorMyStats)
      api
        .getOperatorMyStats()
        .then(setStats)
        .catch(() => setStats(null));
  }, []);
  useEffect(() => {
    loadActive();
    loadStats();
  }, [loadActive, loadStats]);

  const refresh = () => {
    reload();
    loadActive();
    loadStats();
  };

  async function start(id: string) {
    setBusyId(id);
    setActionError(null);
    try {
      putActive(await api.startTask(id));
      reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(reasonText?: string) {
    if (!rejecting || !reasonText) return;
    setBusyId(rejecting);
    setActionError(null);
    try {
      await api.rejectQueueItem(rejecting, reasonText);
      setRejecting(null);
      setToast("Rad etildi");
      refresh();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader subtitle="Operator oynasi" title="Navbat" />
      <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          {activeError && active === undefined ? (
            <ErrorState onRetry={loadActive} />
          ) : active === undefined ? (
            <Skeleton className="h-[360px] rounded-card" />
          ) : active ? (
            <CurrentTask
              task={active}
              key={active.id}
              results={results}
              onDone={(msg) => {
                putActive(null);
                setToast(msg);
                refresh();
              }}
            />
          ) : (
            <Card className="flex items-center gap-4 py-8">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-ink">
                <Headset className="h-6 w-6" aria-hidden />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-extrabold">Faol vazifa yo'q</span>
                <span className="text-13 font-semibold text-muted">Navbatdan eng eskisini "Boshlash" bilan oling.</span>
              </span>
            </Card>
          )}
          {stats && (
            <div className="grid grid-cols-3 gap-4">
              <MiniStat label="Bugun hal qildim" value={formatNumber(stats.resolvedToday)} />
              <MiniStat label="Javob yo'q" value={formatNumber(stats.noAnswerToday)} />
              <MiniStat label="O'rtacha vaqt" value={stats.avgHandleSec === null ? "—" : mmss(stats.avgHandleSec)} />
            </div>
          )}
        </div>

        <Card className="flex min-w-0 flex-col gap-2">
          <CardTitle sub="Eng eskisi tepada" right={queue && <Badge tone="warning">{queue.length} ta</Badge>}>
            Navbat
          </CardTitle>
          {caps.queueFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              <SearchInput className="min-w-[160px] flex-1" tone="surface" label="Telefon" value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="h-4 w-4" aria-hidden />} />
              <FilterSelect
                label="Sabab"
                aria-label="Sabab"
                value={reason}
                onChange={setReason}
                options={[{ value: "all", label: "Hammasi" }, ...REASON_CHIPS.map((r) => ({ value: r, label: REASON[r].label }))]}
              />
            </div>
          )}
          {actionError && (
            <p role="alert" className="text-13 font-semibold text-error">
              {actionError}
            </p>
          )}
          {error && queue && <StaleNotice onRetry={reload} />}
          {error && !queue ? (
            <ErrorState onRetry={reload} />
          ) : !queue ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)
          ) : queue.length === 0 ? (
            <p className="py-6 text-center text-13 font-semibold text-muted">Navbat bo'sh</p>
          ) : (
            <ul className="flex flex-col">
              {queue.map((q) => (
                <li key={q.id} className="flex flex-wrap items-center gap-3 border-b border-line py-3 last:border-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-2">
                      <span className="tabular text-15 font-extrabold">{q.phone ?? q.subjectLabel}</span>
                      <span className="text-xs font-bold text-muted">{since(q.waitingSinceAt)}</span>
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      <Tag className={REASON[q.reason].tag}>{REASON[q.reason].label}</Tag>
                      {q.subjectKind && <Tag className="bg-surface text-ink">{SUBJECT_LABEL[q.subjectKind]}</Tag>}
                    </span>
                  </span>
                  <span className="flex gap-2">
                    <Button variant="soft" onClick={() => setRejecting(q.id)} disabled={!!busyId}>
                      Rad etish
                    </Button>
                    <Button variant="dark" onClick={() => start(q.id)} loading={busyId === q.id} disabled={active !== null || (!!busyId && busyId !== q.id)}>
                      Boshlash
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!rejecting}
        title="Vazifani rad etish"
        description="Vazifa navbatdan olinadi va tarixingizga 'Rad etildi' bo'lib yoziladi."
        confirmLabel="Rad etish"
        reasonLabel="Rad etish sababi (majburiy)"
        loading={!!busyId}
        error={rejecting ? actionError : null}
        onConfirm={reject}
        onCancel={() => setRejecting(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function CurrentTask({ task, results, onDone }: { task: ActiveTask; results: CallResultOption[] | null; onDone: (message: string) => void }) {
  const [result, setResult] = useState<HistoryResult | null>(null);
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState<"finish" | "postpone" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const sending = useRef(false);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsed = task.startedAt ? Math.max(0, Math.floor((now - task.startedAt) / 1000)) : null;
  const needReason = !!results?.find((r) => r.result === result)?.reasonRequired;
  const canFinish = !!result && (!needReason || rejectReason.trim().length > 0);

  async function finish() {
    if (!result || !canFinish || sending.current) return;
    sending.current = true;
    setBusy("finish");
    setError(null);
    try {
      await api.finishTask(task.id, result, note.trim(), needReason ? rejectReason.trim() : undefined);
      onDone(`Yakunlandi: ${RESULT[result].label}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  async function postpone() {
    if (sending.current) return;
    sending.current = true;
    setBusy("postpone");
    setError(null);
    try {
      await api.postponeTask(task.id);
      onDone("Vazifa navbatga qaytarildi");
    } catch (e) {
      setError(errorText(e));
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  const who = [task.subjectName, task.subjectKind && SUBJECT_LABEL[task.subjectKind].toLowerCase(), task.orderId && `buyurtma ${orderNo(task.orderId)}`]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex flex-col gap-4 px-6 py-[22px]">
      <div className="flex items-center justify-between gap-3">
        <span className="label-caps text-muted">Joriy vazifa</span>
        <Badge tone="info">Jarayonda{elapsed !== null ? ` · ${mmss(elapsed)}` : ""}</Badge>
      </div>
      <div className="flex flex-wrap items-center gap-[18px]">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-green text-ink">
          <Phone className="h-7 w-7" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="tabular text-[30px] font-extrabold leading-9 tracking-[0.5px]">{task.phone ?? task.subjectLabel}</span>
          {who && <span className="text-sm font-semibold text-muted">{who}</span>}
        </span>
        {task.phone && (
          <a
            href={`tel:${task.phone.replace(/\s/g, "")}`}
            className="inline-flex h-[52px] shrink-0 items-center gap-2 rounded-full bg-green px-[18px] text-sm font-extrabold text-ink hover:bg-green-hover"
          >
            <Phone className="h-4 w-4" aria-hidden /> Qo'ng'iroq qilish
          </a>
        )}
      </div>
      {task.requestText && (
        <div className="flex flex-col gap-1.5 rounded-field bg-surface px-4 py-3.5">
          <span className="label-caps text-muted">Zayavka</span>
          <span className="text-15 font-semibold leading-[22px]">"{task.requestText}"</span>
          <span className="text-xs font-semibold text-muted">
            {REASON[task.reason].label} · {formatTime(task.waitingSinceAt)}
          </span>
        </div>
      )}
      {!task.requestText && (
        <span className="flex gap-1.5">
          <Tag className={REASON[task.reason].tag}>{REASON[task.reason].label}</Tag>
          <span className="text-xs font-semibold text-muted">kutmoqda {since(task.waitingSinceAt)}</span>
        </span>
      )}
      <div className="flex flex-col gap-2" role="group" aria-label="Natija">
        <span className="label-caps text-muted">Natija</span>
        <div className="flex flex-wrap gap-2">
          {!results && <Skeleton className="h-11 w-full max-w-[420px] rounded-full" />}
          {results?.map(({ result: r }) => (
            <button
              key={r}
              type="button"
              aria-pressed={result === r}
              onClick={() => setResult(r)}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-3.5 text-13 font-bold transition-colors",
                result === r ? (r === "rejected" ? "bg-error text-white" : "bg-ink text-white") : "bg-white text-ink shadow-hairline hover:bg-surface"
              )}
            >
              {r === "rejected" ? "Rad etish" : RESULT[r].label}
            </button>
          ))}
        </div>
      </div>
      {needReason && <TextArea label="Rad etish sababi (majburiy)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} maxLength={500} />}
      <TextArea label="Izoh" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
      {error && (
        <p role="alert" className="text-13 font-semibold text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2.5">
        {caps.queuePostpone && (
          <Button variant="soft" onClick={postpone} loading={busy === "postpone"} disabled={!!busy}>
            Keyinga qoldirish
          </Button>
        )}
        <Button onClick={finish} loading={busy === "finish"} disabled={!canFinish || !!busy}>
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Yakunlash
        </Button>
      </div>
    </Card>
  );
}
