import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Car, MapPin, Users, Wallet, Clock3 } from "lucide-react";
import { api } from "@/api/client";
import type { DriverProfile, OrderWithDetails } from "@/api/types";
import { Card } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { BottomNav } from "@/components/BottomNav";
import { LowConnectionBanner } from "@/components/LowConnectionBanner";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState as EmptyStateComponent } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Toast } from "@/components/Toast";
import { formatSom, formatKm } from "@/lib/format";
import { cn } from "@/lib/cn";

type LoadState = "loading" | "error" | "ready";

export function OffersScreen() {
  const navigate = useNavigate();
  const [state, setState] = useState<LoadState>("loading");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [offers, setOffers] = useState<OrderWithDetails[]>([]);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const pollRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async () => {
    setState("loading");
    try {
      const [p, activeTrip] = await Promise.all([api.getProfile(), api.getActiveTrip()]);
      if (activeTrip) {
        navigate(`/trip/${activeTrip.id}`, { replace: true });
        return;
      }
      setProfile(p);
      if (p.online) {
        const list = await api.getOffers();
        setOffers(list);
      } else {
        setOffers([]);
      }
      setState("ready");
    } catch {
      setState("error");
    }
  }, [navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!profile?.online || state !== "ready") return;
    pollRef.current = setTimeout(async () => {
      try {
        const list = await api.getOffers();
        setOffers(list);
      } catch {
        /* keep showing stale offers on a transient poll failure */
      }
    }, 4000);
    return () => clearTimeout(pollRef.current);
  }, [profile?.online, state, offers]);

  async function toggleOnline() {
    if (!profile) return;
    setTogglingOnline(true);
    try {
      const next = await api.setOnline(!profile.online);
      setProfile(next);
      if (next.online) {
        const list = await api.getOffers();
        setOffers(list);
      } else {
        setOffers([]);
      }
    } catch {
      setToast("Holatni o'zgartirishda xatolik yuz berdi");
    } finally {
      setTogglingOnline(false);
    }
  }

  async function accept(orderId: string) {
    setAcceptingId(orderId);
    try {
      const trip = await api.acceptOffer(orderId);
      navigate(`/trip/${trip.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Xatolik yuz berdi";
      setToast(message);
      const list = await api.getOffers();
      setOffers(list);
    } finally {
      setAcceptingId(null);
    }
  }

  async function decline(orderId: string) {
    setOffers((prev) => prev.filter((o) => o.id !== orderId));
    try {
      await api.declineOffer(orderId);
    } catch {
      /* already removed from the list optimistically */
    }
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(var(--safe-top) + 20px)" }}>
        <div>
          <p className="text-xs text-ink/60">Xayrli kun</p>
          <p className="text-lg font-semibold text-ink">{profile?.name.split(" ")[0] ?? "Haydovchi"} 👋</p>
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

        <Card className="mx-4 mt-3 flex items-center justify-between p-5">
          <div className="flex items-center gap-3">
            <span className={cn("h-2.5 w-2.5 rounded-full", profile?.online ? "bg-accent" : "bg-ink/30")} />
            <div>
              <p className="text-sm font-semibold text-ink">{profile?.online ? "Onlayn" : "Oflayn"}</p>
              <p className="text-xs text-ink/60">
                {profile?.online ? "Buyurtmalar qabul qilinmoqda" : "Buyurtmalar ko'rsatilmaydi"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleOnline}
            disabled={togglingOnline}
            aria-label="Holatni almashtirish"
            className={cn(
              "relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-60",
              profile?.online ? "bg-accent" : "bg-ink/15"
            )}
          >
            <span
              className={cn(
                "absolute top-1 h-6 w-6 rounded-full bg-white shadow-soft transition-transform",
                profile?.online ? "translate-x-7" : "translate-x-1"
              )}
            />
          </button>
        </Card>

        <button
          onClick={() => navigate("/wallet")}
          className="mx-4 mt-3 flex w-[calc(100%-32px)] items-center justify-between rounded-2xl bg-accent-5 px-4 py-3"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-accent">
            <Wallet className="h-4 w-4" /> Hamyon
          </span>
          <span className="text-sm font-semibold tabular text-accent">{formatSom(profile?.walletBalance ?? 0)}</span>
        </button>

        <div className="mt-5 px-5 pb-4">
          <p className="mb-3 text-sm font-semibold text-ink">Kiruvchi buyurtmalar</p>

          {state === "error" && <ErrorState onRetry={load} />}

          {state === "loading" && <SkeletonList count={3} />}

          {state === "ready" && !profile?.online && (
            <EmptyStateComponent
              icon={<Car className="h-7 w-7" />}
              title="Siz hozir oflaynsiz"
              description="Buyurtmalarni ko'rish va qabul qilish uchun onlayn holatiga o'ting."
              actionLabel="Onlayn bo'lish"
              onAction={toggleOnline}
            />
          )}

          {state === "ready" && profile?.online && offers.length === 0 && (
            <EmptyStateComponent
              icon={<Clock3 className="h-7 w-7" />}
              title="Hozircha buyurtma yo'q"
              description="Yangi buyurtmalar paydo bo'lganda bu yerda ko'rinadi."
            />
          )}

          {state === "ready" && profile?.online && offers.length > 0 && (
            <div className="space-y-3">
              {offers.map((o) => {
                const remainingMs = (o.timeline?.searchResolvesAt ?? now) - now;
                const remainingS = Math.max(0, Math.round(remainingMs / 1000));
                return (
                  <Card key={o.id} className="space-y-3 p-4 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <Badge tone={o.mode === "seat" ? "accent" : "neutral"}>
                        {o.mode === "seat" ? (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" /> O'rindiq
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Car className="h-3 w-3" /> Butun mashina
                          </span>
                        )}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs font-medium text-warning">
                        <Clock3 className="h-3.5 w-3.5" /> {remainingS}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-ink/50" />
                      <p className="text-sm font-semibold text-ink">
                        {o.fromCity.name} &rarr; {o.toCity.name}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-ink/60">
                      <span>{formatKm(o.distanceKm)}</span>
                      <span className="text-sm font-semibold tabular text-ink">{formatSom(o.price)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" className="flex-1" onClick={() => decline(o.id)}>
                        Rad etish
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        loading={acceptingId === o.id}
                        onClick={() => accept(o.id)}
                      >
                        Qabul qilish
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
