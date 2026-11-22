import { WifiOff, RotateCw } from "lucide-react";
import { Button } from "./Button";

type Props = {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
};

export function ErrorState({ message = "Ulanish uzildi. Internetni tekshirib, qayta urinib ko'ring.", onRetry, retrying }: Props) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 rounded-card bg-white px-8 py-16 text-center shadow-card animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-warn-soft text-warn" aria-hidden>
        <WifiOff className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-extrabold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
        <p className="text-sm font-medium text-muted">{message}</p>
      </div>
      <Button variant="secondary" onClick={onRetry} loading={retrying}>
        <RotateCw className="h-4 w-4" />
        Qayta urinish
      </Button>
    </div>
  );
}

/** A refresh failed but older rows are still on screen: say so instead of
 * silently showing stale data. */
export function StaleNotice({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-box bg-warn-soft px-4 py-2.5 text-13 font-semibold text-warn">
      <span className="flex-1">Ro'yxatni yangilab bo'lmadi. Ko'rinayotgan ma'lumot eskirgan bo'lishi mumkin.</span>
      <button type="button" onClick={onRetry} className="h-11 rounded-full bg-white px-3.5 text-13 font-bold text-ink hover:bg-surface">
        Qayta urinish
      </button>
    </div>
  );
}
