// FEATURE_BONUS — later product stage, kept isolated from core order flow
// so it can be removed by deleting this folder and its two routes.
import { useEffect, useState } from "react";
import { Gift, Share2, Copy, Check } from "lucide-react";
import { api } from "@/api/client";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { SkeletonList } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Toast } from "@/components/Toast";
import { formatSom } from "@/lib/format";

export function ReferralScreen() {
  const [data, setData] = useState<{ code: string; invitedCount: number; bonusSom: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function share(code: string) {
    const text = `IZGO orqali sayohat qilib, bonus olish uchun mening kodimdan foydalaning: ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* user cancelled — not an error */
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(text);
      setToast("Havola nusxalandi");
    } catch {
      setToast("Ulashib bo'lmadi");
    }
  }

  function load() {
    setError(false);
    api.getReferralCode().then(setData).catch(() => setError(true));
  }

  useEffect(load, []);

  if (error) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="Do'stlarni taklif qiling" />
        <ErrorState onRetry={load} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full flex-col bg-bg px-4 pt-16">
        <SkeletonList count={2} />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <ScreenHeader title="Do'stlarni taklif qiling" />
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <div className="mb-5 flex flex-col items-center gap-3 rounded-2xl bg-accent-5 p-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-bg">
            <Gift className="h-6 w-6" />
          </div>
          <p className="text-sm font-semibold text-ink">Har bir taklif uchun bonus oling</p>
          <p className="text-xs text-ink/60">
            Do'stingiz kodingiz bilan ro'yxatdan o'tsa va birinchi safarini yakunlasa, ikkovingiz ham bonus
            olasiz.
          </p>
        </div>

        <Card className="mb-4 flex items-center justify-between p-4">
          <div>
            <p className="text-[11px] text-ink/60">Sizning kodingiz</p>
            <p className="text-lg font-semibold tracking-wide text-ink">{data.code}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(data.code).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-ink/5 text-ink/70"
            aria-label="Nusxalash"
          >
            {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
          </button>
        </Card>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <Card className="p-4 text-center" padded={false}>
            <div className="py-4">
              <p className="text-xl font-semibold tabular text-ink">{data.invitedCount}</p>
              <p className="text-xs text-ink/60">taklif qilingan</p>
            </div>
          </Card>
          <Card className="p-4 text-center" padded={false}>
            <div className="py-4">
              <p className="text-xl font-semibold tabular text-accent">{formatSom(data.bonusSom)}</p>
              <p className="text-xs text-ink/60">to'plangan bonus</p>
            </div>
          </Card>
        </div>

        <button
          onClick={() => share(data.code)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3.5 text-sm font-semibold text-white active:scale-[0.97] transition-transform"
        >
          <Share2 className="h-4 w-4" /> Kodni ulashish
        </button>
      </div>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
