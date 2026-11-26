import { Link } from "react-router-dom";
import { isApiError } from "@shared/http/errors";
import { AlertTriangle, RefreshCw, WifiOff } from "@/lib/icons";
import { useT } from "@/lib/i18n/provider";
import { errorMessage } from "@/lib/errors";
import { useOnline } from "@/lib/useOnline";
import { Button } from "./Button";
import { StateBlock } from "./StateBlock";

/**
 * Load failed. Offline (no network, or a network error) shows the
 * "Tarmoqqa ulanmagansiz" state; anything else the warning state with the
 * translated server error. `helpTo`: a "Yordamga yozish" link under Retry.
 */
export function ErrorState({ error, onRetry, helpTo }: { error: unknown; onRetry: () => void; helpTo?: string }) {
  const { t } = useT();
  const online = useOnline();
  const offline = !online || (error as { code?: string } | null)?.code === "NETWORK_ERROR";
  const retry = (
    <Button variant="primary" size="lg" fullWidth onClick={onRetry} trailing={<RefreshCw className="h-5 w-5" />}>
      {t("common.retry")}
    </Button>
  );
  const help = helpTo ? (
    <Link to={helpTo} className="press flex h-11 items-center px-3 text-sm font-bold text-muted">
      {t("state.writeHelp")}
    </Link>
  ) : undefined;
  if (offline) {
    return <StateBlock role="alert" icon={WifiOff} title={t("state.offlineTitle")} description={t("state.offlineDesc")} action={retry} />;
  }
  return (
    <StateBlock
      role="alert"
      icon={AlertTriangle}
      tone="warning"
      title={t("error.loadTitle")}
      description={isApiError(error) && error.status >= 500 ? t("state.serverDesc") : errorMessage(error, t)}
      action={retry}
      secondary={help}
    />
  );
}
