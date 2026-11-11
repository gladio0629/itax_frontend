import { WifiOff } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { Button } from "./Button";
import { errorMessage } from "@/lib/errors";

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
        <WifiOff className="h-6 w-6" />
      </span>
      <p className="text-lg font-bold text-ink">{t("error.loadTitle")}</p>
      <p className="mt-2 max-w-[280px] text-sm text-muted">{errorMessage(error, t)}</p>
      <Button variant="secondary" className="mt-6" onClick={onRetry}>
        {t("common.retry")}
      </Button>
    </div>
  );
}
