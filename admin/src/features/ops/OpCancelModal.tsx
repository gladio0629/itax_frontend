import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Ban, Info } from "lucide-react";
import { api } from "@/api/client";
import { Modal, ModalNote } from "@/components/Modal";
import { Button } from "@/components/Button";
import { TextArea } from "@/components/Input";
import { ORDER_STATUS, orderNo } from "@/features/orders/labels";
import { RadioCards } from "./RadioCards";
import type { OpCancelReason, OpOrderDetail } from "@/api/ops/types";

const REASONS: { value: OpCancelReason; label: string }[] = [
  { value: "passenger_asked", label: "Yo'lovchi so'radi" },
  { value: "driver_asked", label: "Haydovchi so'radi" },
  { value: "driver_no_show", label: "Haydovchi kelmadi" },
  { value: "passenger_no_show", label: "Yo'lovchi chiqmadi" },
  { value: "technical", label: "Texnik xato" },
  { value: "other", label: "Boshqa sabab" },
];

/** OpCancel: the operator cancels an order. A reason is required; the
 * server checks whether the order may still be cancelled. */
export function OpCancelModal({
  order,
  onClose,
  onCancelled,
}: {
  /** Open while set. */
  order: OpOrderDetail | null;
  onClose: () => void;
  onCancelled: (o: OpOrderDetail) => void;
}) {
  const [reason, setReason] = useState<OpCancelReason | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sending = useRef(false);
  const open = !!order;

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setComment("");
    setError(null);
  }, [open]);

  async function submit() {
    if (!order || !reason || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      onCancelled(await api.opCancelOrder(order.id, reason, comment.trim() || undefined));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const who = order?.kind === "delivery" ? "Jo'natuvchi" : "Yo'lovchi";
  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={busy}
      width={600}
      title="Buyurtmani bekor qilish"
      description={order ? `Buyurtma ${orderNo(order.id)} · ${ORDER_STATUS[order.status].label}. ${who}${order.driver ? " va haydovchiga" : "ga"} xabar boradi.` : undefined}
      icon={<AlertTriangle className="h-6 w-6" aria-hidden />}
      iconTone="danger"
      footer={
        <>
          <Button variant="soft" onClick={onClose} disabled={busy}>
            Orqaga
          </Button>
          <Button variant="danger" onClick={submit} loading={busy} disabled={!reason}>
            <Ban className="h-4 w-4" aria-hidden /> Bekor qilish
          </Button>
        </>
      }
    >
      <span className="label-caps text-muted">Sabab (majburiy)</span>
      <RadioCards label="Bekor qilish sababi" items={REASONS} value={reason} onChange={setReason} />
      <TextArea label="Izoh" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} />
      <ModalNote icon={<Info className="h-4 w-4" aria-hidden />}>
        Jarima yoki pul qaytarish kerak bo'lsa, bekor qilgandan keyin "Menejerga so'rov" yuboring: operator pulni o'zi o'zgartira olmaydi.
      </ModalNote>
      {error && (
        <p role="alert" className="text-13 font-semibold text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
