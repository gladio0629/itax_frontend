import { useState } from "react";
import { Lock, MessageSquare, RotateCw } from "lucide-react";
import { api } from "@/api/client";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { FilterSelect } from "@/components/FilterSelect";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { KvRows, Notice, Section } from "./cardParts";
import { SMS_RESULT, SMS_TYPE } from "./labels";
import { OpTable } from "./OpTable";
import { useOpData } from "./useOpData";
import type { OpSmsInfo, OpSmsPeriod, OpSmsResult, OpSmsRow, OpSubject } from "@/api/opCards/types";

const PERIODS: { value: OpSmsPeriod; label: string }[] = [
  { value: "7d", label: "Oxirgi 7 kun" },
  { value: "14d", label: "Oxirgi 14 kun" },
  { value: "30d", label: "Oxirgi 30 kun" },
];

function ResultBadge({ result, limit }: { result: OpSmsResult; limit?: OpSmsRow["limit"] }) {
  const r = SMS_RESULT[result];
  return <Badge tone={r.tone}>{result === "limit" && limit ? `${r.label}: ${limit.used}/${limit.max}` : r.label}</Badge>;
}

/** "Kirish (SMS)" tab of both cards (designs OpPassengerSms, OpDriverSms).
 * "Limitni ochish" and "Kodni qayta yuborish" appear only when the server
 * lists them; after either, the screen shows what the server returns. */
export function SmsTab({ subject, defaultPeriod, onChanged }: { subject: OpSubject; defaultPeriod: OpSmsPeriod; onChanged?: () => void }) {
  const [period, setPeriod] = useState<OpSmsPeriod>(defaultPeriod);
  const { data, error, loading, reload, setData } = useOpData(() => api.getOpSms(subject, period), `${subject.kind}:${subject.id}:${period}`);
  const [busy, setBusy] = useState<"unlock" | "resend" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function act(kind: "unlock" | "resend") {
    setBusy(kind);
    setActionError(null);
    try {
      const next: OpSmsInfo = kind === "unlock" ? await api.unlockOpSms(subject, period) : await api.resendOpSmsCode(subject, period);
      setData(next);
      setToast(kind === "unlock" ? "Limit ochildi" : "Kod qayta yuborildi");
      onChanged?.();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setBusy(null);
    }
  }

  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data)
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,425px)_minmax(0,1fr)]" aria-busy>
        <Skeleton className="h-[260px] rounded-card" />
        <Skeleton className="h-[320px] rounded-card" />
      </div>
    );

  const canUnlock = data.actions.includes("sms_unlock");
  const canResend = data.actions.includes("sms_resend");
  const over = data.attempts.used >= data.attempts.max;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,425px)_minmax(0,1fr)]">
      <Section title="Kirish holati (SMS)">
        <KvRows
          rows={[
            ["Oxirgi SMS", data.lastAt ? formatShortDateTime(data.lastAt) : "—"],
            ["Natija", data.lastResult ? <ResultBadge result={data.lastResult} /> : "—"],
            [
              "Urinishlar, so'nggi 1 soat",
              <span key="a" className={cn(over && "text-error")}>
                {data.attempts.used} / {data.attempts.max}
              </span>,
            ],
          ]}
        />
        {data.lock && (
          <Notice tone="warning" icon={<Lock />}>
            Kod {data.lock.wrongAttempts} marta noto'g'ri kiritilgan: {data.lock.minutes} daqiqaga bloklangan. Odam ekanini tasdiqlab, limitni ochishingiz mumkin.
          </Notice>
        )}
        {actionError && (
          <p role="alert" className="text-13 font-semibold text-error">
            {actionError}
          </p>
        )}
        {(canUnlock || canResend) && (
          <div className="flex flex-wrap gap-2.5">
            {canUnlock && (
              <Button variant="dark" onClick={() => act("unlock")} loading={busy === "unlock"} disabled={busy !== null}>
                <RotateCw className="h-4 w-4 text-green" aria-hidden /> Limitni ochish
              </Button>
            )}
            {canResend && (
              <Button variant="soft" onClick={() => act("resend")} loading={busy === "resend"} disabled={busy !== null}>
                <MessageSquare className="h-4 w-4" aria-hidden /> Kodni qayta yuborish
              </Button>
            )}
          </div>
        )}
      </Section>

      <Section
        title="SMS jurnali"
        right={<FilterSelect label="Sana" aria-label="SMS jurnali davri" value={period} onChange={setPeriod} options={PERIODS} />}
      >
        <OpTable
          columns={[
            { key: "at", header: "Vaqt", render: (r) => formatShortDateTime(r.at) },
            { key: "type", header: "Turi", render: (r) => SMS_TYPE[r.type] },
            { key: "provider", header: "Provayder", render: (r) => r.provider },
            { key: "result", header: "Natija", render: (r) => <ResultBadge result={r.result} limit={r.limit} /> },
          ]}
          rows={data.log}
          rowKey={(r) => r.id}
          loading={loading}
          empty={<p className="py-6 text-center text-13 font-semibold text-muted">Bu davrda SMS yuborilmagan.</p>}
        />
      </Section>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
