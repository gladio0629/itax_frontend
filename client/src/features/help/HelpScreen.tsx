import { useState } from "react";
import { ChevronDown, LifeBuoy } from "lucide-react";
import { api } from "@/api/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ReviewStatus } from "@/components/ReviewStatus";
import { cn } from "@/lib/cn";

const FAQ = [
  {
    q: "Buyurtmani qanday bekor qilsam bo'ladi?",
    a: "Buyurtma kuzatish sahifasida \"Bekor qilish\" tugmasini bosib, sababni tanlang.",
  },
  {
    q: "To'lov qanday amalga oshiriladi?",
    a: "Naqd pul yoki bog'langan karta orqali to'lashingiz mumkin. Narx yo'l boshlanishidan oldin ko'rsatiladi.",
  },
  {
    q: "Haydovchi topilmasa nima bo'ladi?",
    a: "5 daqiqa ichida haydovchi topilmasa, qayta urinish yoki boshqa vaqtni tanlash imkoniyati beriladi.",
  },
];

export function HelpScreen() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [message, setMessage] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  async function submit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      const review = await api.submitSupportTicket(message.trim());
      setReviewId(review.id);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Yordam" />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="mb-2 px-1 text-xs font-semibold text-ink/60">TEZ-TEZ SO'RALADIGAN SAVOLLAR</p>
        <Card className="mb-5 divide-y divide-border" padded={false}>
          {FAQ.map((item, i) => (
            <div key={item.q}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between p-4 text-left"
              >
                <span className="text-sm font-medium text-ink">{item.q}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink/60 transition-transform", openIndex === i && "rotate-180")} />
              </button>
              {openIndex === i && <p className="px-4 pb-4 text-sm text-ink/60">{item.a}</p>}
            </div>
          ))}
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/60">QO'LLAB-QUVVATLASH XIZMATI</p>
        <Card className="p-5">
          {reviewId ? (
            sent ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-10 text-accent">
                  <LifeBuoy className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold text-ink">So'rovingiz qabul qilindi</p>
                <p className="text-xs text-ink/60">Operatorlarimiz tez orada siz bilan bog'lanadi.</p>
              </div>
            ) : (
              <ReviewStatus
                reviewId={reviewId}
                title="So'rov yuborildi"
                description="Qo'llab-quvvatlash xizmati tomonidan ko'rib chiqilmoqda."
                onApproved={() => setSent(true)}
              />
            )
          ) : (
            <>
              <p className="mb-3 text-sm text-ink/60">Savolingiz bormi? Xabar yozing, tez orada javob beramiz.</p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Muammoni tasvirlab bering..."
                rows={4}
                className="mb-3 w-full resize-none rounded-xl border border-border bg-bg p-3 text-sm outline-none focus:border-accent"
              />
              {submitError && <p className="mb-3 text-xs font-medium text-danger">Xabar yuborilmadi. Qaytadan urining.</p>}
              <Button fullWidth disabled={!message.trim()} loading={submitting} onClick={submit}>
                Yuborish
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
