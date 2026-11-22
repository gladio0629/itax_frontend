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
      <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
        <RotateCw className="h-4 w-4" />
        Qayta urinish
      </Button>
    </div>
  );
}
