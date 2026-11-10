import { WifiOff, RotateCw } from "@/lib/icons";
import { Button } from "./Button";
import { useT } from "@/lib/i18n/provider";

type Props = {
  message?: string;
  onRetry: () => void;
  retrying?: boolean;
};

export function ErrorState({ message, onRetry, retrying }: Props) {
  const { t } = useT();
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
        <WifiOff className="h-7 w-7" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{t("common.errorTitle")}</p>
        <p className="text-sm text-ink/60">{message ?? t("common.errorMessage")}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
        <RotateCw className="h-4 w-4" />
        {t("common.retry")}
      </Button>
    </div>
  );
}
