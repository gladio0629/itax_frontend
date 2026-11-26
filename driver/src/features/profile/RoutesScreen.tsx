import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { Screen } from "@/components/Screen";
import { RoutesEditor } from "@/features/routes/RoutesEditor";

/** Profil > Yo'nalishlarim. */
export default function RoutesScreen() {
  const { t } = useT();
  return (
    <Screen title={t("routes.title")} back={"/profile"}>
      <p className="mb-4 px-1 text-sm text-muted">{t(api.capabilities.profileMatching ? "routes.intro" : "routes.introSaved")}</p>
      <RoutesEditor />
    </Screen>
  );
}
