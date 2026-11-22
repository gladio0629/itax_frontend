import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import type { Address, AddressSearchResult } from "@/api/types";
import { formatKm } from "@/lib/format";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/cn";
import { Icon, Screen, SectionLabel } from "@/ui";

export type AddressTarget = "from" | "to" | "stop" | "save";

/** Bold the matched part (locale lower-casing, no regex from the query). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim().toLocaleLowerCase();
  const i = q ? text.toLocaleLowerCase().indexOf(q) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-extrabold">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}

function PointRow({
  label,
  active,
  divider,
  children,
}: {
  label: string;
  active: boolean;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex h-[62px] min-w-0 flex-col justify-center gap-0.5", divider && "border-b border-iz-head-border")}>
      <span className={cn("text-[11px] font-bold uppercase tracking-[0.8px]", active ? "text-iz-green" : "text-iz-head-muted")}>{label}</span>
      {children}
    </div>
  );
}

/**
 * Address search (design: Address / KbAddress). The dark top holds the
 * route card: the field being searched is an input (green label), the other
 * end is shown for context. Results are rows on the white sheet; with the
 * keyboard open the map row and the section label step aside.
 */
export function AddressSearch({
  target,
  title,
  fromLabel,
  toLabel,
  fromAddressId,
  excludeCityId,
  onlyCityId,
  onPick,
  onMap,
  onClose,
  onSwap,
}: {
  target: AddressTarget;
  /** The field's label ("Qayerga", "1-to'xtash", "Manzil saqlash"). */
  title: string;
  fromLabel?: string | null;
  toLabel?: string | null;
  /** Distances in the results are from this point. */
  fromAddressId?: string;
  excludeCityId?: string;
  onlyCityId?: string;
  onPick: (address: Address, entrance?: string) => void;
  /** "Xaritadan belgilash" (only where the map can resolve a point). */
  onMap?: () => void;
  onClose: () => void;
  onSwap?: () => void;
}) {
  const { t, intlTag } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AddressSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const req = useRef(0);

  useEffect(() => {
    // Let the overlay paint first so the keyboard doesn't fight the slide-in.
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const id = ++req.current;
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
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
        })
        .finally(() => id === req.current && setSearching(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, fromAddressId, excludeCityId, onlyCityId, reload]);

  const input = (
    <span className="flex min-w-0 items-center gap-2">
      <input
        ref={inputRef}
        type="search"
        name="address"
        autoComplete="off"
        enterKeyHint="search"
        aria-label={title}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("address.typeToSearch")}
        className="iz-input h-6 min-w-0 flex-1 border-0 bg-transparent p-0 text-[16px] font-bold text-iz-head-text outline-none placeholder:font-semibold placeholder:text-iz-head-muted [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button type="button" onClick={() => setQuery("")} aria-label={t("common.clear")} className="-my-2 flex h-11 w-9 shrink-0 items-center justify-center text-iz-head-muted">
          <Icon name="close" size={18} />
        </button>
      )}
    </span>
  );
  const shown = (v: string | null | undefined, placeholder: string) => (
    <span className={cn("truncate text-[15px]", v ? "font-bold text-iz-head-text" : "font-semibold text-iz-head-muted")}>{v || placeholder}</span>
  );
  const twoEnds = target === "from" || target === "to";

  const card = (
    <div className="flex items-center gap-3.5 rounded-iz-card bg-iz-head-card py-1.5 pl-4 pr-3">
      {twoEnds && (
        <div aria-hidden className="flex flex-col items-center gap-1">
          <span className="h-3.5 w-3.5 rounded-full bg-iz-green" />
          <span className="h-[34px] w-0 border-l-2 border-dotted border-iz-head-border-strong" />
          <span className="h-3 w-3 rounded-[4px] bg-iz-head-text" />
        </div>
      )}
      {!twoEnds && <Icon name={target === "save" ? "plus" : "pin"} className="shrink-0 text-iz-green" />}
      <div className="flex min-w-0 flex-1 flex-col">
        {twoEnds ? (
          <>
            <PointRow label={t("home.fromLabel")} active={target === "from"} divider>
              {target === "from" ? input : shown(fromLabel, t("home.fromPlaceholder"))}
            </PointRow>
            <PointRow label={t("home.toLabel")} active={target === "to"}>
              {target === "to" ? input : shown(toLabel, t("home.toPlaceholder"))}
            </PointRow>
          </>
        ) : (
          <PointRow label={title} active>
            {input}
          </PointRow>
        )}
      </div>
      {onSwap && twoEnds && (
        <button
          type="button"
          onClick={onSwap}
          disabled={!fromLabel || !toLabel}
          aria-label={t("home.swap")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-iz-head-border text-iz-head-text disabled:opacity-40"
        >
          <Icon name="swap" size={18} />
        </button>
      )}
    </div>
  );

  return (
    <div className="absolute inset-0 z-50 animate-fade-in" role="dialog" aria-modal="true" aria-label={title}>
      <Screen title={t("address.routeTitle")} onBack={onClose} topKeep={card} bodyClassName="gap-4">
        {onMap && (
          <button type="button" onClick={onMap} className="flex h-[68px] shrink-0 items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 text-left active:opacity-80 kb:hidden">
            <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile bg-iz-selected text-iz-on-selected">
              <Icon name="map" />
            </span>
            <span className="flex-1 text-[15px] font-extrabold text-iz-ink">{t("address.fromMap")}</span>
            <Icon name="chevronRight" size={18} className="text-iz-muted" />
          </button>
        )}
        {results.length > 0 && <SectionLabel className="kb:hidden">{t("address.results")}</SectionLabel>}
        <div className="flex flex-col" aria-busy={searching || undefined}>
          {results.map((r, i) => {
            const name = r.entrance ? `${r.address.label}, ${t("details.short.entrance", { v: r.entrance })}` : r.address.label;
            return (
              <button
                key={`${r.address.id}-${r.entrance ?? ""}`}
                type="button"
                onClick={() => onPick(r.address, r.entrance)}
                className={cn("flex min-h-[68px] w-full items-center gap-3.5 py-2 text-left active:opacity-70", i < results.length - 1 && "border-b border-iz-border")}
              >
                <span
                  aria-hidden
                  className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile", i === 0 ? "bg-iz-green-soft text-iz-green-text" : "bg-iz-field text-iz-ink")}
                >
                  <Icon name="pin" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold text-iz-ink">
                    <Highlight text={name} query={query} />
                  </span>
                  {r.area && <span className="truncate text-[13px] text-iz-muted">{r.area}</span>}
                </span>
                {fromAddressId && r.distanceKm != null && (
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-iz-muted">{formatKm(r.distanceKm, intlTag)}</span>
                )}
              </button>
            );
          })}
        </div>
        {error && (
          <button type="button" onClick={() => setReload((n) => n + 1)} className="flex h-11 items-center gap-2 self-center text-[14px] font-bold text-iz-danger">
            <Icon name="refresh" size={18} />
            {t("common.loadFailedRetry")}
          </button>
        )}
        {query.trim() && !searching && !error && results.length === 0 && (
          <p className="py-6 text-center text-[15px] font-semibold text-iz-muted">{t("address.notFound")}</p>
        )}
      </Screen>
    </div>
  );
}
