import { Spinner } from "./Spinner";
import { useT } from "@/lib/i18n/provider";

export function RouteFallback() {
  const { t } = useT();
  return (
    <div className="flex h-full items-center justify-center text-gold" role="status" aria-label={t("common.loading")}>
      <Spinner className="h-8 w-8" />
    </div>
  );
}
