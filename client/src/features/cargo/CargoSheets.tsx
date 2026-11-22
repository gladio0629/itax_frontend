import { useEffect, useState } from "react";
import { api } from "@/api/client";
import type { CargoInfo, CargoInfoTopic, Warehouse } from "@/api/types";
import { formatKm } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { BottomSheet, Icon, StateError, StateLoading } from "@/ui";

/** "Yetkazish / Yukchilar / Kuzov / Sug'urta haqida" — the server's text. */
export function CargoInfoSheet({ topic, onClose }: { topic: CargoInfoTopic; onClose: () => void }) {
  const { t } = useT();
  const [info, setInfo] = useState<CargoInfo | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    api.getCargoInfo(topic).then(setInfo).catch(() => setError(true));
  };
  useEffect(load, [topic]);
  return (
    <BottomSheet open onClose={onClose} title={info ? t(info.titleKey as TranslationKey) : t(`kargo.info.${topic}.chip` as TranslationKey)} closeLabel={t("common.close")}>
      {error ? (
        <StateError onRetry={load} />
      ) : !info ? (
        <StateLoading rows={1} />
      ) : (
        <div className="flex flex-col gap-2 pb-4 text-[15px] leading-[22px] text-iz-ink">
          {info.paragraphKeys.map((k) => (
            <p key={k}>{t(k as TranslationKey)}</p>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

/** "Marketpleys": the drop-off is a marketplace warehouse, nearest first. */
export function WarehouseSheet({ fromAddressId, onSelect, onClose }: { fromAddressId: string; onSelect: (w: Warehouse) => void; onClose: () => void }) {
  const { t, intlTag } = useT();
  const [list, setList] = useState<Warehouse[] | null>(null);
  const [error, setError] = useState(false);
  const load = () => {
    setError(false);
    api.getMarketplaceWarehouses(fromAddressId).then(setList).catch(() => setError(true));
  };
  useEffect(load, [fromAddressId]);
  return (
    <BottomSheet open onClose={onClose} title={t("kargo.warehouses.title")} closeLabel={t("common.close")}>
      {error ? (
        <StateError onRetry={load} />
      ) : !list ? (
        <StateLoading rows={2} />
      ) : (
        <ul className="flex flex-col pb-2">
          {list.map((w, i) => (
            <li key={w.address.id}>
              <button
                type="button"
                onClick={() => onSelect(w)}
                className={"flex min-h-[68px] w-full items-center gap-3.5 py-2 text-left active:opacity-70" + (i < list.length - 1 ? " border-b border-iz-border" : "")}
              >
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-green-soft text-iz-green-text">
                  <Icon name="box" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-extrabold text-iz-ink" translate="no">
                    {w.address.label}
                  </span>
                  <span className="text-[13px] tabular-nums text-iz-muted">{formatKm(w.distanceKm, intlTag)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}

/** Small round "i" next to a section label. */
export function InfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="-my-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-iz-muted active:bg-iz-field">
      <Icon name="info" size={18} />
    </button>
  );
}
