import { useState } from "react";
import { api } from "@/api/client";
import type { CapabilitiesInput, DriverCapabilities } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { Truck } from "@/lib/icons";
import { Screen } from "@/components/Screen";
import { Chip } from "@/components/Chip";
import { Switch } from "@/components/Switch";
import { SettingsRow } from "@/components/SettingsRow";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { SectionLabel } from "@/components/Card";

/**
 * Imkoniyatlarim (decision 2026-11-22): only the cargo body sizes the car
 * takes and "Yukchi sifatida yordam". Each change is saved right away and
 * the server's answer is shown.
 */
export default function CapabilitiesScreen() {
  const { t } = useT();
  const q = useQuery(() => api.getCapabilities(), []);
  const [saving, setSaving] = useState(false);
  const c = q.data;

  async function save(next: CapabilitiesInput) {
    if (!c) return;
    const prev = c;
    q.setData({ ...c, ...next } as DriverCapabilities);
    setSaving(true);
    try {
      q.setData(await api.setCapabilities(next));
    } catch (e) {
      q.setData(prev);
      toast(errorMessage(e, t), "danger");
    } finally {
      setSaving(false);
    }
  }

  const toggleSize = (size: string) => {
    if (!c) return;
    const on = c.bodySizes.includes(size);
    save({ bodySizes: on ? c.bodySizes.filter((x) => x !== size) : [...c.bodySizes, size], loaderHelp: c.loaderHelp });
  };

  return (
    <Screen back="/profile" title={t("profile.capabilities")} top={<p className="text-sm leading-[21px] text-night-muted">{t("caps.desc")}</p>}>
      {q.error && !c ? (
        <ErrorState error={q.error} onRetry={() => q.reload()} />
      ) : !c ? (
        <SkeletonList rows={2} label={t("common.loading")} />
      ) : (
        <div className="flex flex-col gap-3" aria-busy={saving}>
          <SectionLabel className="mb-0">{t("caps.delivery")}</SectionLabel>
          <div className="flex flex-col gap-2.5" role="group" aria-labelledby="caps-body">
            <h2 id="caps-body" className="text-15 font-extrabold text-ink">
              {t("caps.bodySize")}
            </h2>
            <div className="flex flex-wrap gap-2">
              {c.availableBodySizes.map((size) => (
                <Chip key={size} selected={c.bodySizes.includes(size)} onClick={() => toggleSize(size)} className="min-w-[48px]">
                  {size}
                </Chip>
              ))}
            </div>
            <p className="text-13 font-semibold text-muted">{t("caps.bodyHint")}</p>
          </div>
          <div className="mt-2">
            <SettingsRow
              icon={Truck}
              label={t("caps.loader")}
              description={t("caps.loaderHint")}
              trailing={<Switch checked={c.loaderHelp} onChange={() => save({ bodySizes: c.bodySizes, loaderHelp: !c.loaderHelp })} label={t("caps.loader")} />}
            />
          </div>
        </div>
      )}
    </Screen>
  );
}
