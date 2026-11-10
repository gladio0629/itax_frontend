import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, Bell, MapPin, Clock3, TrendingUp } from "lucide-react";
import { api } from "@/api/client";
import type { City, RouteSuggestion } from "@/api/types";
import { MapView } from "@/components/MapView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { LowConnectionBanner } from "@/components/LowConnectionBanner";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { formatSom, formatKm } from "@/lib/format";
import { useOrderStore } from "@/stores/orderStore";
import { CityPickerSheet } from "./CityPickerSheet";

type LoadState = "loading" | "error" | "ready";

export function HomeScreen() {
  const navigate = useNavigate();
  const { draft, setField } = useOrderStore();
  const [state, setState] = useState<LoadState>("loading");
  const [cities, setCities] = useState<City[]>([]);
  const [popular, setPopular] = useState<RouteSuggestion[]>([]);
  const [recent, setRecent] = useState<RouteSuggestion[]>([]);
  const [profileName, setProfileName] = useState("");
  const [picker, setPicker] = useState<"from" | "to" | null>(null);

  async function load() {
    setState("loading");
    try {
      const [c, pop, rec, profile] = await Promise.all([
        api.getCities(),
        api.getPopularRoutes(),
        api.getRecentRoutes(),
        api.getProfile(),
      ]);
      setCities(c);
      setPopular(pop);
      setRecent(rec);
      setProfileName(profile.name.split(" ")[0]);
      if (!draft.fromCityId) setField("fromCityId", "tsh");
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cityName(id: string) {
    return cities.find((c) => c.id === id)?.name ?? "";
  }

  function goConfigure(fromId: string, toId: string) {
    setField("fromCityId", fromId);
    setField("toCityId", toId);
    navigate("/order/configure");
  }

  const canSearch = !!draft.fromCityId && !!draft.toCityId && draft.fromCityId !== draft.toCityId;

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <div
        className="flex items-center justify-between pl-16 pr-5"
        style={{ paddingTop: "calc(var(--safe-top) + 20px)" }}
      >
        <div>
          <p className="text-xs text-ink/60">Xayrli kun{profileName ? "," : ""}</p>
          <p className="text-lg font-semibold text-ink">{profileName || "Mehmon"} 👋</p>
        </div>
        <button
          onClick={() => navigate("/notifications")}
          aria-label="Bildirishnomalar"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-softer"
        >
          <Bell className="h-5 w-5 text-ink/80" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <LowConnectionBanner />

        <div className="relative mx-4 mt-3 h-40 overflow-hidden rounded-2xl">
          <MapView />
          <div className="absolute inset-0 bg-gradient-to-t from-bg/40 to-transparent" />
        </div>

        <Card className="relative z-10 mx-4 -mt-10 space-y-1 p-4">
          <button
            onClick={() => setPicker("from")}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-ink/5"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-ink" />
            <div className="flex-1">
              <p className="text-[11px] text-ink/60">Qayerdan</p>
              <p className="text-sm font-semibold text-ink">{cityName(draft.fromCityId) || "Shaharni tanlang"}</p>
            </div>
          </button>
          <div className="mx-2 h-px bg-border" />
          <button
            onClick={() => setPicker("to")}
            className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-ink/5"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            <div className="flex-1">
              <p className="text-[11px] text-ink/60">Qayerga</p>
              <p className="text-sm font-semibold text-ink">{cityName(draft.toCityId) || "Shaharni tanlang"}</p>
            </div>
          </button>
          <button
            onClick={() => {
              const f = draft.fromCityId;
              setField("fromCityId", draft.toCityId);
              setField("toCityId", f);
            }}
            aria-label="Almashtirish"
            className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-accent-5 text-accent"
          >
            <ArrowUpDown className="h-4 w-4" />
          </button>
        </Card>

        {state === "error" ? (
          <ErrorState onRetry={load} />
        ) : (
          <>
            <section className="mt-6 px-5">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Clock3 className="h-4 w-4 text-ink/60" /> So'nggi yo'nalishlar
              </p>
              {state === "loading" ? (
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-32 rounded-full" />
                  <Skeleton className="h-9 w-28 rounded-full" />
                </div>
              ) : recent.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {recent.map((r) => (
                    <button
                      key={`${r.fromCityId}-${r.toCityId}`}
                      onClick={() => goConfigure(r.fromCityId, r.toCityId)}
                      className="shrink-0 rounded-full border border-border bg-card px-4 py-2.5 text-xs font-semibold text-ink/80"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ink/60">Hali buyurtmalar yo'q — mashhur yo'nalishlardan birini tanlang.</p>
              )}
            </section>

            <section className="mt-6 px-5 pb-6">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <TrendingUp className="h-4 w-4 text-ink/60" /> Mashhur yo'nalishlar
              </p>
              {state === "loading" ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full rounded-2xl" />
                  <Skeleton className="h-16 w-full rounded-2xl" />
                </div>
              ) : (
                <div className="space-y-2">
                  {popular.map((r) => (
                    <button
                      key={`${r.fromCityId}-${r.toCityId}`}
                      onClick={() => goConfigure(r.fromCityId, r.toCityId)}
                      className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3.5 text-left shadow-softer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-5 text-accent">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink">{r.label}</p>
                          <p className="text-xs text-ink/60">{formatKm(r.distanceKm)}</p>
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-ink/80 tabular">dan {formatSom(r.fromPrice)}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <div className="px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }}>
        <Button fullWidth disabled={!canSearch} onClick={() => navigate("/order/configure")}>
          Buyurtma berish
        </Button>
      </div>

      {picker && (
        <CityPickerSheet
          title={picker === "from" ? "Qayerdan" : "Qayerga"}
          cities={cities}
          excludeId={picker === "from" ? draft.toCityId : draft.fromCityId}
          onClose={() => setPicker(null)}
          onSelect={(id) => {
            setField(picker === "from" ? "fromCityId" : "toCityId", id);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
