import { useId, useRef } from "react";
import { api } from "@/api/client";
import type { CapabilitiesInput, ChildSeatAge, DriverCapabilities } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { Baby, Car, Luggage, PawPrint, Truck } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/Card";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Switch } from "@/components/Switch";
import { Chip } from "@/components/Chip";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";

/** "Imkoniyatlarim": child seat (with age groups), pets, big luggage; car class and cargo body read-only. */
export default function CapabilitiesScreen() {
  const { t } = useT();
  const q = useQuery(() => api.getCapabilities(), []);
  const caps = q.data;
  const agesId = useId();
  const seq = useRef(0);

  async function update(patch: Partial<CapabilitiesInput>) {
    if (!caps) return;
    const prev = caps;
    const next: DriverCapabilities = { ...caps, ...patch };
    q.setData(next); // optimistic
    const id = ++seq.current;
    try {
      const saved = await api.setCapabilities({
        childSeat: next.childSeat,
        childSeatAges: next.childSeatAges,
        pets: next.pets,
        bigLuggage: next.bigLuggage,
      });
      // The adapter normalises (e.g. last age group cleared → seat off); show its answer.
      if (id === seq.current) q.setData(saved);
    } catch (e) {
      if (id === seq.current) q.setData(prev);
      toast(errorMessage(e, t), "danger");
    }
  }

  function toggleAge(a: ChildSeatAge) {
    if (!caps) return;
    const has = caps.childSeatAges.includes(a);
    update({ childSeatAges: has ? caps.childSeatAges.filter((x) => x !== a) : [...caps.childSeatAges, a] });
  }

  const body = caps?.cargoBody;

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("profile.capabilities")} back="/profile" />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        {q.error && !caps ? (
          <ErrorState error={q.error} onRetry={() => q.reload()} />
        ) : !caps || !body ? (
          <SkeletonList rows={4} label={t("common.loading")} />
        ) : (
          <>
            <p className="mb-4 px-1 text-sm text-muted">{t("caps.intro")}</p>
            <SettingsGroup>
              <SettingsRow
                icon={Baby}
                tile="blue"
                label={t("caps.childSeat")}
                description={t("caps.childSeatHint")}
                trailing={<Switch checked={caps.childSeat} onChange={() => update({ childSeat: !caps.childSeat })} label={t("caps.childSeat")} />}
              />
              {caps.childSeat && (
                <div role="group" aria-labelledby={agesId} className="animate-fade-in px-4 pb-4 pt-3">
                  <p id={agesId} className="mb-2 text-sm text-muted">
                    {t("caps.ages")}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {caps.ageGroups.map((a) => {
                      const on = caps.childSeatAges.includes(a);
                      return (
                        <Chip key={a} selected={on} onClick={() => toggleAge(a)} className="tabular whitespace-nowrap px-2">
                          {t(`childAge.${a}`)}
                        </Chip>
                      );
                    })}
                  </div>
                </div>
              )}
              <SettingsRow
                icon={PawPrint}
                tile="orange"
                label={t("caps.pets")}
                trailing={<Switch checked={caps.pets} onChange={() => update({ pets: !caps.pets })} label={t("caps.pets")} />}
              />
              <SettingsRow
                icon={Luggage}
                tile="purple"
                label={t("caps.bigLuggage")}
                trailing={<Switch checked={caps.bigLuggage} onChange={() => update({ bigLuggage: !caps.bigLuggage })} label={t("caps.bigLuggage")} />}
              />
            </SettingsGroup>

            <SectionLabel className="mt-6">{t("caps.car")}</SectionLabel>
            <SettingsGroup label={t("caps.car")}>
              <SettingsRow icon={Car} tile="slate" label={t("caps.carClass")} description={caps.carModel} value={t(`carClass.${caps.carClass}`)} />
              <SettingsRow
                icon={Truck}
                tile="teal"
                label={t("caps.cargoBody")}
                description={`${t("freight.dims", { w: body.dimensionsCm.width, d: body.dimensionsCm.depth, h: body.dimensionsCm.height })} · ${t("freight.maxKg", { kg: body.maxWeightKg })}`}
                value={body.sizeLabel}
              />
            </SettingsGroup>
            <p className="px-1 text-sm text-muted">{t("caps.readOnly")}</p>
          </>
        )}
      </div>
    </div>
  );
}
