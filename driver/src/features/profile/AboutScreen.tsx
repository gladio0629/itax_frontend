import { api } from "@/api/client";
import { SITE_URL } from "@/config";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { FileText, ShieldCheck, Receipt } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Skeleton } from "@/components/Skeleton";

export default function AboutScreen() {
  const { t } = useT();
  const info = useQuery(() => api.getAppInfo(), []);
  const soon = () => toast(t("about.soon"));

  return (
    <Screen title={t("about.title")} back={"/profile/settings"}>
      <div className="mb-6 flex flex-col items-center py-6 text-center">
        <img src="/izgo-logo.png" alt="IZGO" width={88} height={88} className="h-[88px] w-[88px] rounded-card bg-white object-contain p-2 ring-1 ring-line" />
        <p translate="no" className="mt-4 text-xl font-bold text-ink">{t("app.name")}</p>
        <p className="mt-1 text-sm text-muted">{t("about.tagline")}</p>
        {info.data ? (
          <p className="tabular mt-2 text-sm text-muted">{t("about.version", { version: info.data.version, build: info.data.build })}</p>
        ) : (
          <Skeleton className="mt-2 h-4 w-32" />
        )}
      </div>
      <SettingsGroup>
        {SITE_URL && <SettingsRow icon={FileText} label={t("about.terms")} href={`${SITE_URL}/terms`} />}
        {SITE_URL && <SettingsRow icon={ShieldCheck} label={t("about.privacy")} href={`${SITE_URL}/privacy`} />}
        <SettingsRow icon={Receipt} label={t("about.offer")} onClick={soon} />
      </SettingsGroup>
      <p className="mt-6 text-center text-sm text-muted">{t("about.copyright")}</p>
    </Screen>
  );
}
