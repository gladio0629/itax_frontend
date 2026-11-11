import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { FileText, ShieldCheck, Receipt } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Skeleton } from "@/components/Skeleton";

export default function AboutScreen() {
  const { t } = useT();
  const info = useQuery(() => api.getAppInfo(), []);
  const soon = () => toast(t("about.soon"));

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("about.title")} back="/profile" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        <div className="mb-6 flex flex-col items-center py-6 text-center">
          <img src="/izgo-logo.png" alt="IZGO" width={88} height={88} className="h-[88px] w-[88px] rounded-card bg-white object-contain p-2 shadow-2" />
          <p className="mt-4 text-xl font-bold text-ink">{t("app.name")}</p>
          <p className="mt-1 text-sm text-muted">{t("about.tagline")}</p>
          {info.data ? (
            <p className="tabular mt-2 text-sm text-muted">{t("about.version", { version: info.data.version, build: info.data.build })}</p>
          ) : (
            <Skeleton className="mt-2 h-4 w-32" />
          )}
        </div>
        <SettingsGroup>
          <SettingsRow icon={FileText} tile="slate" label={t("about.terms")} onClick={soon} />
          <SettingsRow icon={ShieldCheck} tile="green" label={t("about.privacy")} onClick={soon} />
          <SettingsRow icon={Receipt} tile="blue" label={t("about.offer")} onClick={soon} />
        </SettingsGroup>
        <p className="mt-6 text-center text-sm text-muted">{t("about.copyright")}</p>
      </div>
    </div>
  );
}
