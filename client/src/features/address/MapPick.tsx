import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { Address, AddressDetails } from "@/api/types";
import { MapCanvas } from "@/components/MapCanvas";
import { useLiftFloatingControl } from "@/stores/floatingControlStore";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { serverErrorKey } from "@/lib/apiError";
import { Icon, PrimaryButton, SectionLabel, useShellChrome, useStatusBar } from "@/ui";
import { detailsSummary } from "@/features/order/addressDetails";
import type { AddressTarget } from "./AddressSearch";

/** The design's pin: caption bubble, stem, green ring, needle, shadow. */
function Pin({ caption }: { caption: string }) {
  return (
    <span className="flex flex-col items-center">
      <span className="flex h-9 items-center gap-2 whitespace-nowrap rounded-[18px] bg-iz-map-pin px-3.5 text-[13px] font-bold text-iz-head-text shadow-[0_6px_16px_var(--iz-shadow-strong)]">
        <span className="h-2 w-2 rounded-full bg-iz-green" />
        {caption}
      </span>
      <span className="h-2.5 w-0.5 bg-iz-map-pin" />
      <span className="flex h-11 w-11 items-center justify-center rounded-full border-[5px] border-iz-map-pin bg-iz-green">
        <span className="h-2.5 w-2.5 rounded-full bg-iz-map-pin" />
      </span>
      <span className="h-[22px] w-[3px] rounded-b-sm bg-iz-map-pin" />
      <span className="h-1.5 w-[18px] rounded-full bg-[var(--iz-shadow-strong)]" />
    </span>
  );
}

/**
 * Pick a point on the map (design: MapPick). The sample-data map is a drawn
 * plane: tap (or arrow keys) moves the pin and the adapter names the point
 * (reverseGeocode). Only offered where capabilities.mapPick is on.
 */
export function MapPick({
  target,
  excludeCityId,
  onlyCityId,
  details,
  allowDetails,
  onDetails,
  onSearch,
  onConfirm,
  onMoved,
  initialPin,
  onPin,
}: {
  target: AddressTarget;
  excludeCityId?: string;
  onlyCityId?: string;
  /** Tafsilotlar already filled for this point (shown under the name). */
  details?: AddressDetails;
  /** Show the "Podyezd, qavat, kvartira" row. */
  allowDetails: boolean;
  onDetails: (address: Address) => void;
  /** Back to the text search (top-left arrow and the search pill). */
  onSearch: () => void;
  onConfirm: (address: Address) => void;
  /** The pin moved to another point (details typed for the old one no longer apply). */
  onMoved?: () => void;
  /** Where the pin starts (kept by the parent across the details step). */
  initialPin?: { x: number; y: number };
  onPin?: (pin: { x: number; y: number }) => void;
}) {
  const { t } = useT();
  useShellChrome();
  useStatusBar("map");
  const [pin, setPin] = useState(initialPin ?? { x: 50, y: 42 });
  const onPinRef = useRef(onPin);
  onPinRef.current = onPin;
  useEffect(() => onPinRef.current?.(pin), [pin]);
  const [address, setAddress] = useState<Address | null>(null);
  const [resolving, setResolving] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetH, setSheetH] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const req = useRef(0);
  const lastId = useRef<string | null>(null);
  const onMovedRef = useRef(onMoved);
  onMovedRef.current = onMoved;
  useLiftFloatingControl(sheetRef);

  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSheetH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Name the point under the pin (debounced while it moves).
  useEffect(() => {
    const id = ++req.current;
    setResolving(true);
    setError(null);
    // The old name is not under the pin any more: nothing to confirm until
    // the server names the new point.
    setAddress(null);
    const timer = window.setTimeout(() => {
      api
        .reverseGeocode(pin.x, pin.y, excludeCityId, onlyCityId)
        .then((a) => {
          if (id !== req.current) return;
          setAddress(a);
          if (lastId.current && lastId.current !== a.id) onMovedRef.current?.();
          lastId.current = a.id;
        })
        .catch((e) => {
          if (id !== req.current) return;
          setAddress(null);
          setError(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey));
        })
        .finally(() => id === req.current && setResolving(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pin, excludeCityId, onlyCityId, t]);

  function locate() {
    api
      .locateMe()
      .then((a) => {
        if (a.x != null && a.y != null) setPin({ x: a.x, y: a.y });
        else {
          req.current++;
          setResolving(false);
          setError(null);
          setAddress(a);
        }
      })
      .catch((e) => {
        setAddress(null);
        setError(t((serverErrorKey(e) ?? "common.errorMessage") as TranslationKey));
      });
  }

  const caption = target === "from" ? t("address.pinFrom") : target === "save" ? t("address.pinSave") : t("address.pinTo");
  const pointLabel = target === "from" ? t("address.pointFrom") : target === "save" ? t("address.pointSave") : t("address.pointTo");
  const summary = detailsSummary(details, t);

  return (
    <div className="absolute inset-0 z-50 overflow-hidden bg-iz-map" role="dialog" aria-modal="true" aria-label={t("address.pickOnMap")}>
      <div
        className="absolute inset-0 touch-none outline-none"
        role="application"
        tabIndex={0}
        aria-label={t("address.mapHint")}
        style={{ bottom: sheetH }}
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setPin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
        }}
        onKeyDown={(e) => {
          const d: Record<string, [number, number]> = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, -4], ArrowDown: [0, 4] };
          const m = d[e.key];
          if (m) {
            e.preventDefault();
            setPin((p) => ({ x: Math.min(100, Math.max(0, p.x + m[0])), y: Math.min(100, Math.max(0, p.y + m[1])) }));
          }
        }}
      >
        <MapCanvas className="absolute inset-0" />
        <span aria-hidden className="pointer-events-none absolute -translate-x-1/2 -translate-y-full" style={{ left: `${pin.x}%`, top: `${pin.y}%` }}>
          <Pin caption={caption} />
        </span>
      </div>

      <div className="absolute inset-x-5 z-10 flex items-center gap-2.5" style={{ top: "calc(var(--safe-top) + 12px)" }}>
        <button
          type="button"
          onClick={onSearch}
          aria-label={t("common.back")}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-iz-map-pin text-iz-head-text shadow-[0_8px_20px_var(--iz-shadow-strong)] active:scale-95"
        >
          <Icon name="back" />
        </button>
        <button
          type="button"
          onClick={onSearch}
          className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-iz-sheet px-4 text-[14px] font-semibold text-iz-muted shadow-[0_8px_20px_var(--iz-shadow)]"
        >
          <Icon name="search" size={18} />
          <span className="truncate">{t("address.searchOnMap")}</span>
        </button>
      </div>

      <button
        type="button"
        onClick={locate}
        aria-label={t("home.myLocation")}
        className="absolute right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-iz-sheet text-iz-ink shadow-[0_8px_20px_var(--iz-shadow)] active:scale-95"
        style={{ bottom: sheetH + 16 }}
      >
        <Icon name="locate" size={22} />
      </button>

      <div
        ref={sheetRef}
        className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3.5 rounded-t-iz-sheet bg-iz-sheet px-5 pb-[calc(max(var(--safe-bottom),16px)+8px)] pt-3 shadow-[0_-10px_40px_var(--iz-shadow)]"
      >
        <span aria-hidden className="h-[5px] w-10 self-center rounded-full bg-iz-chip-border" />
        <div className="flex flex-col gap-1" aria-live="polite">
          <SectionLabel>{pointLabel}</SectionLabel>
          <h1 className="truncate text-[22px] font-extrabold leading-[30px] text-iz-ink">
            {resolving ? t("address.locating") : address?.label ?? "—"}
          </h1>
          {error ? (
            <span role="alert" className="text-[14px] font-semibold text-iz-danger">
              {error}
            </span>
          ) : (
            summary && <span className="truncate text-[14px] text-iz-muted">{summary}</span>
          )}
        </div>
        {allowDetails && (
          <button
            type="button"
            disabled={!address || resolving}
            onClick={() => address && onDetails(address)}
            className="flex h-[68px] items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 text-left active:opacity-80 disabled:opacity-50"
          >
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-sheet text-iz-ink">
              <Icon name="building" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-extrabold text-iz-ink">{t("address.detailsRow")}</span>
              <span className="truncate text-[13px] text-iz-muted">{t("address.detailsRowHint")}</span>
            </span>
            <Icon name="chevronRight" size={18} className="text-iz-muted" />
          </button>
        )}
        <PrimaryButton disabled={!address || resolving} onClick={() => address && onConfirm(address)}>
          {t("address.thisPlace")}
        </PrimaryButton>
      </div>
    </div>
  );
}
