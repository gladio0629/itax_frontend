import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FormEvent } from "react";
import { api } from "@/api/client";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Section } from "./cardParts";
import { REQUEST_STATUS, REQUEST_TYPE } from "@/features/ops/requestLabels";
import { REQUEST_PARAM } from "@/features/ops/requestParam";
import { NOTE_CATEGORY } from "./labels";
import { OpTable } from "./OpTable";
import { useOpData } from "./useOpData";
import type { OpSubject } from "@/api/opCards/types";

/** "Murojaatlar" tab of both cards (designs OpPassengerNotes,
 * OpDriverNotes): notes with "add a note", and the manager requests about
 * this person. */
export function NotesTab({ subject, onChanged }: { subject: OpSubject; onChanged?: () => void }) {
  // Refetched when "Menejerga so'rov" closes, so a request just sent shows here.
  const [params] = useSearchParams();
  const requestOpen = params.has(REQUEST_PARAM);
  const { data, error, loading, reload, setData } = useOpData(() => api.getOpNotes(subject), `${subject.kind}:${subject.id}:${requestOpen}`);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const note = await api.addOpNote(subject, text);
      setData((d) => (d ? { ...d, notes: [note, ...d.notes] } : d));
      setText("");
      onChanged?.();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  if (error && !data) return <ErrorState message={error} onRetry={reload} retrying={loading} />;
  if (!data)
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]" aria-busy>
        <Skeleton className="h-[320px] rounded-card" />
        <Skeleton className="h-[180px] rounded-card" />
      </div>
    );

  const who = subject.kind === "passenger" ? "yo'lovchi" : "haydovchi";
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Section
        title="Murojaatlar va izohlar"
        right={<span className="tabular inline-flex h-6 items-center rounded-lg bg-surface px-2 text-xs font-extrabold text-ink">{data.notes.length} ta</span>}
      >
        {data.notes.length === 0 ? (
          <p className="py-4 text-13 font-semibold text-muted">Hali izoh yo'q.</p>
        ) : (
          <ul className="-mt-1 flex flex-col">
            {data.notes.map((n) => (
              <li key={n.id} className="flex gap-3 border-b border-line py-3 animate-fade-in">
                <Avatar name={n.authorName} size={32} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-13 font-extrabold text-ink">{n.authorName}</span>
                    <span className={cn("inline-flex h-6 items-center rounded-lg px-2 text-xs font-bold", NOTE_CATEGORY[n.category].className)}>
                      {NOTE_CATEGORY[n.category].label}
                    </span>
                    <span className="tabular ml-auto text-xs font-semibold text-muted">{formatShortDateTime(n.at)}</span>
                  </div>
                  <p className="whitespace-pre-line text-sm font-medium leading-[19px] text-ink">{n.text}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data.actions.includes("add_note") && (
          <form onSubmit={save} className="flex flex-col gap-2">
            <div className="flex gap-2.5">
              <label className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-surface px-4 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]">
                <span className="sr-only">Izoh</span>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={1000}
                  placeholder="Izoh yozing: nima qilindi, nima kelishildi"
                  className="min-w-0 flex-1 bg-transparent text-13 font-semibold text-ink outline-none focus-visible:shadow-none placeholder:text-muted"
                />
              </label>
              <Button type="submit" variant="dark" loading={saving} disabled={!text.trim()}>
                Saqlash
              </Button>
            </div>
            {saveError && (
              <p role="alert" className="px-1 text-13 font-semibold text-error">
                {saveError}
              </p>
            )}
          </form>
        )}
      </Section>

      <Section title={`Shu ${who} bo'yicha so'rovlar`}>
        <OpTable
          columns={[
            { key: "id", header: "So'rov", render: (r) => <span className="font-extrabold">{r.displayId}</span> },
            { key: "type", header: "Turi", render: (r) => REQUEST_TYPE[r.type] },
            { key: "amount", header: "Summa", align: "right", render: (r) => (r.amount === null ? "—" : formatNumber(r.amount)) },
            { key: "status", header: "Holat", render: (r) => <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge> },
          ]}
          rows={data.requests}
          rowKey={(r) => r.id}
          empty={<p className="py-4 text-13 font-semibold text-muted">Bu {who} bo'yicha so'rov yo'q.</p>}
        />
      </Section>
    </div>
  );
}
