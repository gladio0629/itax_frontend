import { useEffect, useRef, useState } from "react";
import { Flag, Map as MapIcon, MapPin, PersonStanding, X } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address, AddressSearchResult } from "@/api/types";
import { MapCanvas } from "@/components/MapCanvas";
import { Button } from "@/components/Button";
import { MapButton } from "@/components/ui/MapButton";
import { ArrowLeft } from "@/lib/icons";
import { formatKm } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";

/** Case-insensitive match highlight (works for Cyrillic and apostrophes:
 * plain locale lower-casing, no regex built from the query). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLocaleLowerCase();
  const i = q ? text.toLocaleLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * Full-screen address search (reference search screen): a top card with the
 * pickup row and the field being searched (yellow square, clear X, "Xarita"
 * capsule), then results — match in navy, area underneath, distance on the
 * right. Entrance variants come from the adapter as separate results.
 */
export function SearchScreen({
  title,
  fromLabel,
  fromAddressId,
  excludeCityId,
  onlyCityId,
  onSelect,
  onClose,
}: {
  /** What is being picked ("Qayerga", "1-to'xtash"…). */
  title: string;
  /** Shown in the card's first row (the pickup), when picking a drop-off. */
  fromLabel?: string;
  fromAddressId?: string;
  excludeCityId?: string;
  onlyCityId?: string;
  onSelect: (address: Address, entrance?: string) => void;
  onClose: () => void;
}) {
  const { t, intlTag } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [mapMode, setMapMode] = useState(false);
  const [pin, setPin] = useState({ x: 50, y: 50 });
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const req = useRef(0);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const id = ++req.current;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setError(false);
      api
        .searchAddresses({ query, fromAddressId, excludeCityId, onlyCityId })
        .then((r) => id === req.current && setResults(r))
        .catch(() => {
          if (id === req.current) {
            setResults([]);
            setError(true);
          }
        });
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, fromAddressId, excludeCityId, onlyCityId, reload]);

  async function confirmPin() {
    setConfirming(true);
    try {
      onSelect(await api.reverseGeocode(pin.x, pin.y, excludeCityId, onlyCityId));
    } catch {
      setError(true);
    } finally {
      setConfirming(false);
    }
  }

  if (mapMode) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label={t("address.pickOnMap")}>
        <div
          className="relative flex-1 touch-none"
          role="application"
          tabIndex={0}
          aria-label={t("address.mapHint")}
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
          <span
            className="pointer-events-none absolute flex h-10 w-10 -translate-x-1/2 -translate-y-full items-center justify-center rounded-[11px] bg-brand-yellow text-on-yellow shadow-[0_2px_12px_rgba(0,0,0,0.16)]"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            <Flag className="h-5 w-5" />
          </span>
          <MapButton onClick={() => setMapMode(false)} aria-label={t("common.back")} className="absolute left-4" style={{ top: "calc(var(--safe-top) + 16px)" }}>
            <ArrowLeft className="h-5 w-5" />
          </MapButton>
        </div>
        <div className="rounded-t-sheet bg-card px-2 pt-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}>
          <Button fullWidth loading={confirming} onClick={confirmPin}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      <MapCanvas className="absolute inset-0" />
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" onClick={onClose} />
      {/* Sheet top 13px below the inset, card 16px into the sheet (measured, photo 9). */}
      <div className="relative mt-[calc(var(--safe-top)+13px)] flex min-h-0 flex-1 flex-col rounded-t-sheet bg-card">
        <div className="flex justify-center pt-2" aria-hidden="true">
          <span className="h-[5px] w-9 rounded-full bg-ink/15" />
        </div>
        {/* Top card: pickup row, then the field being searched. */}
        <div className="mx-2 mt-1 rounded-card bg-card shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
          {fromLabel && (
            <div className="flex min-h-[var(--size-row)] items-center gap-3 px-4">
              <PersonStanding className="h-5 w-5 shrink-0 text-ink" />
              <span className="min-w-0 flex-1 truncate border-b border-hairline py-4 text-control text-ink">{fromLabel}</span>
            </div>
          )}
          <div className="flex min-h-[var(--size-row)] items-center gap-3 py-2 pl-2 pr-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-brand-yellow text-on-yellow" aria-hidden="true">
              <Flag className="h-5 w-5" />
            </span>
            <label className="min-w-0 flex-1">
              <span className="block text-sub text-ink/60">{title}</span>
              <input
                ref={inputRef}
                type="search"
                name="address"
                autoComplete="off"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("address.searchPlaceholder")}
                className="w-full bg-transparent text-body text-ink outline-none placeholder:text-ink/60 [&::-webkit-search-cancel-button]:hidden"
              />
            </label>
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label={t("common.clear")} className="flex h-11 w-9 shrink-0 items-center justify-center text-ink">
                <X className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setMapMode(true)}
              className="flex h-[var(--size-chip)] shrink-0 items-center gap-1.5 rounded-chip bg-fill px-3.5 text-sub font-medium text-ink hover:bg-ink/10"
            >
              <MapIcon className="h-4 w-4" /> {t("address.map")}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-1" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
          {results.map((r, i) => {
            const name = r.entrance ? `${r.address.label}, ${t("details.short.entrance", { v: r.entrance })}` : r.address.label;
            return (
              <button
                key={`${r.address.id}-${r.entrance ?? ""}`}
                type="button"
                onClick={() => onSelect(r.address, r.entrance)}
                className="flex w-full items-center gap-3 text-left"
              >
                <MapPin className="h-6 w-6 shrink-0 text-ink/45" />
                <span className={cn("flex min-h-[var(--size-row)] min-w-0 flex-1 items-center gap-3 py-2", i < results.length - 1 && "border-b border-hairline")}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-ink">
                      <Highlight text={name} query={query} />
                    </span>
                    <span className="block truncate text-sub text-ink/60">{r.area}</span>
                  </span>
                  {fromAddressId && <span className="shrink-0 text-sub text-ink/60 tabular">{formatKm(r.distanceKm, intlTag)}</span>}
                </span>
              </button>
            );
          })}
          {error && (
            <div className="py-4 text-center">
              <button onClick={() => setReload((n) => n + 1)} className="inline-flex min-h-[44px] items-center text-sub font-semibold text-danger underline">
                {t("common.loadFailedRetry")}
              </button>
            </div>
          )}
          {query.trim() && !error && results.length === 0 && <p className="py-6 text-center text-control text-ink/60">{t("address.notFound")}</p>}
        </div>
      </div>
    </div>
  );
}
