import { useState } from "react";
import { api } from "@/api/client";
import type { DocumentStatus } from "@/api/types";
import { isKey, useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { errorMessage } from "@/lib/errors";
import { Car, FileText, IdCard, Pencil, ShieldCheck, Timer } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Card, SectionLabel } from "@/components/Card";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { ReviewStatus } from "@/components/ReviewStatus";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { cn } from "@/lib/cn";

type Field = "name" | "phone" | "car";

export default function PersonalScreen() {
  const { t } = useT();
  const profile = useQuery(() => api.getProfile(), []);
  const [edit, setEdit] = useState<Field | null>(null);
  const p = profile.data;
  const fieldLabel: Record<Field, string> = { name: t("personal.name"), phone: t("personal.phone"), car: t("personal.car") };

  return (
    <Screen title={t("personal.title")} back={"/profile"}>
      {profile.error && !p ? (
        <ErrorState error={profile.error} onRetry={() => profile.reload()} />
      ) : !p ? (
        <SkeletonList rows={4} label={t("common.loading")} />
      ) : (
        <div className="animate-fade-up space-y-5">
          <Card className="divide-y divide-line">
            <InfoRow label={t("personal.name")} value={p.name} onEdit={() => setEdit("name")} editLabel={`${t("common.edit")}: ${t("personal.name")}`} />
            <InfoRow
              label={t("personal.phone")}
              value={p.phoneMasked}
              onEdit={api.capabilities.profileChangePhone ? () => setEdit("phone") : undefined}
              editLabel={`${t("common.edit")}: ${t("personal.phone")}`}
            />
            {p.city && <InfoRow label={t("personal.city")} value={p.city.name} />}
          </Card>

          {p.car && (
          <section aria-labelledby="car-h">
            <SectionLabel id="car-h">{t("personal.car")}</SectionLabel>
            <Card className="divide-y divide-line">
              <InfoRow
                label={t("personal.carModel")}
                value={p.car.model}
                onEdit={api.capabilities.profileChangeCar ? () => setEdit("car") : undefined}
                editLabel={`${t("common.edit")}: ${t("personal.car")}`}
              />
              <InfoRow
                label={t("personal.carColor")}
                value={
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="h-3.5 w-3.5 rounded-full ring-1 ring-ink/20" style={{ background: p.car.colorHex }} />
                    {isKey(`color.${p.car.color}`) ? t(`color.${p.car.color}` as never) : p.car.color}
                  </span>
                }
              />
              <InfoRow label={t("personal.plate")} value={<span className="tabular">{p.car.plate}</span>} />
              <InfoRow label={t("personal.year")} value={<span className="tabular">{p.car.year}</span>} />
            </Card>
          </section>
          )}

          {p.documents.length > 0 && (
          <section aria-labelledby="docs-h">
            <SectionLabel id="docs-h">{t("personal.documents")}</SectionLabel>
            <Card className="divide-y divide-line">
              {p.documents.map((d) => (
                <div key={d.kind} className="flex min-h-[64px] items-center gap-3 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-raised text-muted">
                    {d.kind === "license" ? <IdCard className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <span className="min-w-0 flex-1 text-base text-ink">{t(`personal.doc.${d.kind}`)}</span>
                  <DocBadge status={d.status} />
                </div>
              ))}
            </Card>
          </section>
          )}

          <p className="flex gap-2 px-1 text-sm text-muted">
            <Car className="mt-0.5 h-4 w-4 shrink-0" />
            {t("personal.readOnlyNote")}
          </p>
        </div>
      )}

      {edit && <EditSheet field={edit} label={fieldLabel[edit]} onClose={() => setEdit(null)} onDone={() => profile.reload(true)} />}
    </Screen>
  );
}

function InfoRow({ label, value, onEdit, editLabel }: { label: string; value: React.ReactNode; onEdit?: () => void; editLabel?: string }) {
  return (
    <div className="flex min-h-[64px] items-center gap-3 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{label}</p>
        <p className="truncate text-base text-ink">{value}</p>
      </div>
      {onEdit && (
        <button type="button" onClick={onEdit} aria-label={editLabel} className="press -mr-2 flex h-12 w-12 items-center justify-center rounded-button text-muted">
          <Pencil className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function DocBadge({ status }: { status: DocumentStatus }) {
  const { t } = useT();
  return (
    <span
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-button px-3 text-sm font-medium",
        status === "approved" && "bg-success/15 text-success",
        status === "auto_review" && "bg-warning/15 text-warning",
        status === "none" && "bg-raised text-muted"
      )}
    >
      {status === "approved" ? <ShieldCheck className="h-4 w-4" /> : status === "auto_review" ? <Timer className="h-4 w-4" /> : null}
      {t(`personal.docStatus.${status}`)}
    </span>
  );
}

function EditSheet({ field, label, onClose, onDone }: { field: Field; label: string; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [reviewId, setReviewId] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await api.requestProfileChange(field, value);
      setReviewId(r.id);
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={t("personal.editTitle", { field: label })}>
      {reviewId ? (
        <ReviewStatus
          compact
          reviewId={reviewId}
          title={t("personal.reviewTitle")}
          description={t("personal.reviewDesc")}
          onApproved={() => {
            onDone();
            onClose();
          }}
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <TextField
            label={t("personal.newValue")}
            name={field}
            autoComplete={field === "name" ? "name" : field === "phone" ? "tel" : "off"}
            inputMode={field === "phone" ? "tel" : undefined}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={error}
            data-autofocus
          />
          <p className="mt-3 text-sm text-muted">{t("personal.readOnlyNote")}</p>
          <Button type="submit" size="lg" fullWidth className="mt-5" loading={busy}>
            {t("personal.sendRequest")}
          </Button>
        </form>
      )}
    </Sheet>
  );
}
