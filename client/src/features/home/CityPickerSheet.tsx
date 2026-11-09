import { useMemo, useState } from "react";
import { MapPin, Search, X } from "lucide-react";
import type { City } from "@/api/types";

export function CityPickerSheet({
  cities,
  excludeId,
  onSelect,
  onClose,
  title,
}: {
  cities: City[];
  excludeId?: string;
  onSelect: (cityId: string) => void;
  onClose: () => void;
  title: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      cities.filter(
        (c) => c.id !== excludeId && c.name.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [cities, excludeId, query]
  );

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-ink/40 animate-fade-in" onClick={onClose}>
      <div
        className="mt-auto flex max-h-[75%] flex-col rounded-t-3xl bg-card animate-slide-up"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Yopish" className="flex h-9 w-9 items-center justify-center rounded-full bg-ink/5">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 pt-4">
          <div className="flex h-11 items-center gap-2 rounded-2xl bg-ink/5 px-3">
            <Search className="h-4 w-4 text-ink/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Shaharni qidirish"
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-ink/60"
            />
          </div>
        </div>
        <div className="mt-2 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.map((city) => (
            <button
              key={city.id}
              onClick={() => onSelect(city.id)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-ink/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-5 text-accent">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">{city.name}</p>
                <p className="text-xs text-ink/60">{city.region}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink/60">Shahar topilmadi</p>
          )}
        </div>
      </div>
    </div>
  );
}
