import { useEffect, useState } from "react";
import { MapPin, Search, Map as MapIcon } from "@/lib/icons";
import { api } from "@/api/client";
import type { Address } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { FakeMap } from "@/components/FakeMap";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n/provider";

export function AddressPickerSheet({
  title,
  excludeCityId,
  onSelect,
  onClose,
}: {
  title: string;
  excludeCityId?: string;
  onSelect: (address: Address) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Address[]>([]);
  const [searchError, setSearchError] = useState(false);
  const [searchReload, setSearchReload] = useState(0);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [pin, setPin] = useState({ x: 50, y: 50 });
  const [confirming, setConfirming] = useState(false);

  // Suggestions only appear once the user types — no default/"recent" list
  // auto-shown on open, per spec.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      setSearchError(false);
      api
        .getAddressSuggestions(query, excludeCityId)
        .then(setResults)
        .catch(() => {
          setResults([]);
          setSearchError(true);
        });
    }, 200);
    return () => clearTimeout(id);
  }, [query, excludeCityId, searchReload]);

  async function confirmMapPin() {
    setConfirming(true);
    try {
      const addr = await api.reverseGeocode(pin.x, pin.y, excludeCityId);
      onSelect(addr);
    } finally {
      setConfirming(false);
    }
  }

  if (pickingOnMap) {
    return (
      <Sheet open onClose={() => setPickingOnMap(false)} ariaLabel={t("address.pickOnMap")}>
        <div className="flex items-center justify-between px-5 pt-3">
          <h2 className="text-sm font-semibold text-ink">{t("address.pickOnMap")}</h2>
        </div>
        <div
          className="relative mx-4 mt-3 h-64 overflow-hidden rounded-2xl"
          role="application"
          tabIndex={0}
          aria-label={t("address.mapHint")}
          onKeyDown={(e) => {
            const step = 4;
            const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
            const move = d[e.key];
            if (move) {
              e.preventDefault();
              setPin((p) => ({ x: Math.min(100, Math.max(0, p.x + move[0])), y: Math.min(100, Math.max(0, p.y + move[1])) }));
            } else if (e.key === "Enter") {
              e.preventDefault();
              confirmMapPin();
            }
          }}
          onPointerDown={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setPin({
              x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
              y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
            });
          }}
        >
          <FakeMap className="absolute inset-0" />
          <div
            className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
          >
            <div className="h-5 w-5 rounded-full border-2 border-on-yellow bg-brand-yellow shadow-soft" />
            <div className="h-3 w-0.5 bg-on-yellow" />
          </div>
        </div>
        <div className="px-5 pb-4 pt-4">
          <Button fullWidth loading={confirming} onClick={confirmMapPin}>
            {t("common.confirm")}
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} ariaLabel={title}>
      <div className="px-5 pt-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      <div className="px-5 pt-3">
        <div className="flex h-12 items-center gap-2 rounded-xl bg-ink/5 px-3 focus-within:ring-2 focus-within:ring-accent ios:h-9 ios:gap-1.5 ios:rounded-[10px] ios:bg-[var(--ios-fill-tertiary)] ios:px-2 ios:focus-within:ring-0">
          <Search className="h-4 w-4 text-ink/60 ios:text-[color:var(--ios-label-secondary)]" />
          <input
            autoFocus
            type="search"
            name="address"
            autoComplete="off"
            enterKeyHint="search"
            aria-label={title}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("address.searchPlaceholder")}
            className="h-full w-full bg-transparent text-sm outline-none placeholder:text-ink/60"
          />
        </div>
      </div>

      <button
        onClick={() => setPickingOnMap(true)}
        className="mx-5 mt-3 flex min-h-[48px] items-center gap-2 rounded-xl bg-accent-5 px-4 py-3 text-sm font-semibold text-accent"
      >
        <MapIcon className="h-4 w-4" /> {t("address.pickOnMap")}
      </button>

      <div className="mt-2 max-h-72 flex-1 divide-y divide-border overflow-y-auto overscroll-contain px-4 pb-2">
        {results.map((addr) => (
          <button
            key={addr.id}
            onClick={() => onSelect(addr)}
            className="flex min-h-[56px] w-full items-center gap-3 px-1 py-2 text-left hover:bg-ink/5"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent">
              <MapPin className="h-4 w-4" />
            </div>
            <p className="min-w-0 truncate text-sm font-semibold text-ink">{addr.label}</p>
          </button>
        ))}
        {searchError && (
          <div className="py-4 text-center">
            <button onClick={() => setSearchReload((n) => n + 1)} className="inline-flex min-h-[44px] items-center text-xs font-semibold text-danger underline">
              {t("common.loadFailedRetry")}
            </button>
          </div>
        )}
        {query.trim() && !searchError && results.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-ink/60">{t("address.notFound")}</p>
        )}
      </div>
    </Sheet>
  );
}
