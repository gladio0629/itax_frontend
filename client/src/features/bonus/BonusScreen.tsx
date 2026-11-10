// Placeholder for Step 3 (Bonuslar). Reachable from the drawer now so
// navigation/i18n/theme can be verified end-to-end before the real screen
// (hero balance, withdraw flow, sources, history) is built.
import { Gift } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

export function BonusScreen() {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-bg px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-10 text-accent">
        <Gift className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-ink/70">{t("common.comingSoon")}</p>
    </div>
  );
}
