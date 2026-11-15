import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RoutesEditor } from "@/features/routes/RoutesEditor";

/** Profil > Yo'nalishlarim. */
export default function RoutesScreen() {
  const { t } = useT();
  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("routes.title")} back="/profile" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        <p className="mb-4 px-1 text-sm text-muted">{t(api.capabilities.profileMatching ? "routes.intro" : "routes.introSaved")}</p>
        <RoutesEditor />
      </div>
    </div>
  );
}
