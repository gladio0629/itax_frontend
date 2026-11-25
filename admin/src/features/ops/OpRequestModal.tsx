import { useEffect, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useCloseOverlay } from "@/hooks/useCloseOverlay";
import { ArrowRight, Send } from "lucide-react";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";
import { Input, SelectField, TextArea } from "@/components/Input";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Toast } from "@/components/Toast";
import { formatNumber } from "@/lib/format";
import { RadioCards } from "./RadioCards";
import { REQUEST_TYPE } from "./requestLabels";
import { REQUEST_PARAM, parseRequestParam } from "./requestParam";
import type { ManagerRequestType, RequestForm, RequestSubjectKind } from "@/api/ops/types";

const ROLE_LABEL = { passenger: "Yo'lovchi", driver: "Haydovchi", sender: "Jo'natuvchi" } as const;

/** Mounted once in the layout: `?request=<kind>:<id>` on any page opens
 * "Menejerga so'rov" for an operator (action operatorWork). Closing removes
 * only that query param. */
export function OpRequestHost() {
  const { me } = usePermissions();
  const [params] = useSearchParams();
  const location = useLocation();
  const closeOverlay = useCloseOverlay();
  const [toast, setToast] = useState<string | null>(null);
  const subject = parseRequestParam(params.get(REQUEST_PARAM));
  const canRequest = !!me?.actions.includes("operatorWork");

  // Opened by a push from the same page: close steps back, so "Orqaga"
  // on that page does not land on a duplicate entry.
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete(REQUEST_PARAM);
    closeOverlay({ pathname: location.pathname, search: next.toString() }, { replace: true });
  };

  return (
    <>
      {canRequest && subject && (
        <OpRequestModal
          key={`${subject.kind}:${subject.id}`}
          kind={subject.kind}
          id={subject.id}
          onClose={close}
          onSent={(code) => {
            close();
            setToast(`${code} menejerga yuborildi. Holati "Tarix → Mening vazifalarim"da.`);
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function OpRequestModal({ kind, id, onClose, onSent }: { kind: RequestSubjectKind; id: string; onClose: () => void; onSent: (code: string) => void }) {
  const [form, setForm] = useState<RequestForm | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [type, setType] = useState<ManagerRequestType | null>(null);
  const [amount, setAmount] = useState("");
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    let live = true;
    setLoadError(false);
    api
      .getRequestForm(kind, id)
      .then((f) => {
        if (!live) return;
        setForm(f);
        setOrderId(f.defaultOrderId ?? "");
      })
      .catch(() => live && setLoadError(true));
    return () => {
      live = false;
    };
  }, [kind, id, reloadTick]);

  const option = form?.types.find((t) => t.type === type) ?? null;
  const amountValue = amount ? Number(amount) : null;
  const ready = !!option && reason.trim().length > 0 && (!option.needsAmount || (amountValue !== null && amountValue > 0));

  async function submit() {
    if (!form || !option || !ready || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const r = await api.createManagerRequest({
        subjectKind: kind,
        subjectId: id,
        type: option.type,
        amount: option.needsAmount && amountValue !== null ? amountValue : undefined,
        orderId: orderId || null,
        reason: reason.trim(),
      });
      onSent(r.code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      width={640}
      title="Menejerga so'rov"
      description={`Pul, bloklash va ma'lumot o'zgarishlarini menejer bajaradi. So'rov holati "Tarix → Mening vazifalarim"da ko'rinadi.`}
      icon={<Send className="h-6 w-6" aria-hidden />}
      iconTone="info"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={submit} loading={busy} disabled={!ready}>
            Yuborish <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
    >
      {loadError && !form ? (
        <ErrorState onRetry={() => setReloadTick((n) => n + 1)} />
      ) : !form ? (
        <div className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-4 w-16" />
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] rounded-[14px]" />
            ))}
          </div>
          <Skeleton className="h-[68px] rounded-field" />
        </div>
      ) : (
        <>
          <span className="label-caps text-muted">Turi</span>
          <RadioCards
            label="So'rov turi"
            items={form.types.map((t) => ({ value: t.type, label: REQUEST_TYPE[t.type], hint: t.hint }))}
            value={type}
            onChange={(t) => {
              setType(t);
              setError(null);
            }}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {option?.needsAmount && (
              <Input
                label="Summa, so'm"
                inputMode="numeric"
                autoComplete="off"
                required
                value={amount ? formatNumber(Number(amount)) : ""}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 10))}
              />
            )}
            {form.orders.length > 0 && (
              <SelectField
                label="Bog'liq buyurtma"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                options={[{ value: "", label: "Bog'lanmagan" }, ...form.orders.map((o) => ({ value: o.id, label: o.label }))]}
              />
            )}
          </div>
          <TextArea label="Sabab" required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={1000} />
          {form.people.length > 0 && (
            <div className="flex flex-col gap-1 rounded-box bg-surface px-4 py-3">
              {form.people.map((p, i) => (
                <span key={i} className="tabular text-13 font-semibold text-muted">
                  {ROLE_LABEL[p.role]}: <span className="font-bold text-ink">{p.name}</span> · {p.phone}
                </span>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-13 font-semibold text-error">
              {error}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
