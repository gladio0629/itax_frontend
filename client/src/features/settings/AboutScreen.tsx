import { ChevronRight, Mail } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/Card";
import { useT } from "@/lib/i18n/provider";

const APP_VERSION = "1.1.0";

export function AboutScreen() {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title={t("settings.about")} />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="mb-5 flex flex-col items-center gap-3 py-4 text-center">
          <Logo size={64} />
          <p className="text-sm font-semibold text-ink">IZGO</p>
          <p className="max-w-[280px] text-xs text-ink/60">{t("about.description")}</p>
          <p className="text-xs text-ink/40 tabular">{t("about.version", { version: APP_VERSION })}</p>
        </div>

        <Card className="mb-3 divide-y divide-border" padded={false}>
          <button className="flex w-full items-center justify-between p-4 text-left">
            <span className="text-sm font-medium text-ink">{t("about.terms")}</span>
            <ChevronRight className="h-4 w-4 text-ink/40" />
          </button>
          <button className="flex w-full items-center justify-between p-4 text-left">
            <span className="text-sm font-medium text-ink">{t("about.privacy")}</span>
            <ChevronRight className="h-4 w-4 text-ink/40" />
          </button>
        </Card>

        <Card className="p-4">
          <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-ink/60">
            <Mail className="h-3.5 w-3.5" /> {t("about.contact")}
          </p>
          <p className="text-sm text-ink/80">{t("about.contactPlaceholder")}</p>
        </Card>

        <p className="mt-4 text-center text-[11px] text-ink/40">{t("about.placeholderNote")}</p>
      </div>
    </div>
  );
}
