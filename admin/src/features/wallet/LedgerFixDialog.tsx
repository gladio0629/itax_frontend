import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Info, Scale } from "lucide-react";
import { api } from "@/api/client";
import { Button } from "@/components/Button";
import { Modal, ModalNote } from "@/components/Modal";
import { ChangeConfirmModal } from "@/components/ChangeConfirmModal";
import { SelectField, TextArea } from "@/components/Input";
import { NumberField } from "@/components/NumberField";
import { Segmented } from "@/components/Tabs";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { LEDGER_KIND, entryNo } from "./ledgerLabels";
import type { Driver, WalletLedgerRow } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const REASON_MAX = 500;

/**
 * Tuzatish yozuvi (design LedgerFix), at /wallet/fix?driver=&entry=.
 * Two steps, one person (decision 2026-11-22): "Saqlash" opens the confirm
 * modal (current balance, direction, amount, reason); "Tasdiqlash" sends
 * the one request; "Bekor qilish" discards everything. The old entry is
 * never changed; the new balance is the server's, not computed here.
 */
export function LedgerFixDialog({ onDone }: { onDone: (message: string) => void }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const minReason = Math.max(5, caps.adjustmentReasonMinLength);

  const [drivers, setDrivers] = useState<Driver[] | null>(null);
  const [driverId, setDriverId] = useState(params.get("driver") ?? "");
  const [entries, setEntries] = useState<WalletLedgerRow[]>([]);
  const [entryId, setEntryId] = useState(params.get("entry") ?? "");
  const [direction, setDirection] = useState<"add" | "take">("add");
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [confirming, setConfirming] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);

  useEffect(() => {
    api
      .getDrivers({})
      .then((d) => {
        setDrivers(d);
        setDriverId((cur) => cur || d[0]?.id || "");
      })
      .catch((e) => setLoadError(errorText(e)));
  }, []);

  useEffect(() => {
    if (!driverId || !caps.correctionEntryRef) return;
    let live = true;
    api
      .getWalletLedger({ driverId })
      .then((rows) => live && setEntries(rows.slice(0, 30)))
      .catch(() => live && setEntries([]));
    return () => {
      live = false;
    };
  }, [driverId]);

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("entry");
    navigate({ pathname: "/wallet", search: next.toString() });
  };

  const driver = drivers?.find((d) => d.id === driverId);
  const entry = entries.find((e) => e.id === entryId);
  const reasonOk = reason.trim().length >= minReason && reason.trim().length <= REASON_MAX;
  const canSave = !!driver && amount !== null && amount > 0 && reasonOk;
  const signed = amount === null ? 0 : direction === "add" ? amount : -amount;

  async function save() {
    if (!canSave || !driver) return;
    setError(null);
    setBalance(null);
    setConfirming(true);
    // Current balance for the confirm modal (server value; may stay unknown).
    api
      .getDriverWalletInfo(driver.id)
      .then((w) => setBalance(w.balance))
      .catch(() => setBalance(null));
  }

  async function confirm() {
    if (!driver || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api.createWalletCorrection({
        driverId: driver.id,
        entryId: caps.correctionEntryRef && entryId ? entryId : undefined,
        amount: signed,
        reason: reason.trim(),
      });
      onDone(
        res.applied
          ? "Tuzatish yozuvi qo'shildi"
          : "Server tuzatishni qabul qildi, lekin hali kuchga kiritmadi (tasdiq kutilmoqda). Backend tasdiq bosqichini olib tashlashi kerak."
      );
      close();
    } catch (e) {
      // Keep the modal and the draft; the admin can retry or cancel.
      setError(errorText(e));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={!confirming}
        onClose={close}
        title="Tuzatish yozuvi"
        description="Eski yozuv o'zgarmaydi. Yangi yozuv daftarga alohida qator bo'lib qo'shiladi."
        icon={<Scale className="h-6 w-6" aria-hidden />}
        footer={
          <>
            <Button variant="soft" onClick={close}>
              Bekor qilish
            </Button>
            <Button onClick={save} disabled={!canSave}>
              Saqlash
            </Button>
          </>
        }
      >
        {loadError && (
          <p role="alert" className="text-13 font-semibold text-error">
            Haydovchilar ro'yxatini yuklab bo'lmadi: {loadError}
          </p>
        )}
        <SelectField
          label="Haydovchi"
          required
          value={driverId}
          onChange={(e) => {
            setDriverId(e.target.value);
            setEntryId("");
          }}
          options={(drivers ?? []).map((d) => ({ value: d.id, label: `${d.name} · ${d.phone}` }))}
          disabled={!drivers}
        />
        {caps.correctionEntryRef && (
          <SelectField
            label="Qaysi yozuvga (ixtiyoriy)"
            value={entryId}
            onChange={(e) => setEntryId(e.target.value)}
            options={[
              { value: "", label: "Bog'lanmagan" },
              ...entries.map((e) => ({
                value: e.id,
                label: `${entryNo(e.id)} · ${LEDGER_KIND[e.type].label} ${e.amount > 0 ? "+" : ""}${formatNumber(e.amount)} · ${formatShortDateTime(e.createdAt)}`,
              })),
            ]}
          />
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col gap-1.5">
            <span className="label-caps px-1 text-muted">Yo'nalish</span>
            <Segmented
              label="Yo'nalish"
              value={direction}
              onChange={setDirection}
              items={[
                { key: "add", label: "+ Qo'shish" },
                { key: "take", label: "− Yechish" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label-caps px-1 text-muted">Summa, so'm</span>
            <NumberField label="Summa, so'm" value={amount} onChange={setAmount} unit="so'm" width="full" />
          </div>
        </div>
        <TextArea
          label="Sabab (majburiy)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={REASON_MAX}
          rows={3}
          hint={`${reason.trim().length}/${REASON_MAX}, kamida ${minReason} belgi`}
        />
        <ModalNote icon={<Info className="h-4 w-4" aria-hidden />}>
          "Saqlash" bosilgach tasdiqlash oynasi chiqadi: "Tasdiqlash" bosilgandan keyingina yozuv kuchga kiradi. Kim, qachon, qaysi sabab bilan qo'shgani
          audit jurnaliga yoziladi.
        </ModalNote>
      </Modal>

      <ChangeConfirmModal
        open={confirming}
        title="Tuzatish yozuvini tasdiqlang"
        description="Daftarga yangi qator qo'shiladi. Eski yozuvlar o'zgarmaydi."
        facts={[
          { label: "Haydovchi", value: driver?.name ?? "—" },
          { label: "Joriy balans", value: balance === null ? "—" : `${formatNumber(balance)} so'm` },
          { label: "Yo'nalish", value: direction === "add" ? "Qo'shish" : "Yechish" },
          { label: "Summa", value: `${signed > 0 ? "+" : ""}${formatNumber(signed)} so'm` },
          ...(entry ? [{ label: "Yozuvga", value: `${entryNo(entry.id)} · ${LEDGER_KIND[entry.type].label}` }] : []),
          { label: "Sabab", value: <span className="whitespace-pre-wrap font-semibold">{reason.trim()}</span> },
        ]}
        loading={busy}
        error={error}
        onConfirm={confirm}
        // Cancel discards the pending correction (nothing is sent).
        onCancel={close}
      />
    </>
  );
}
