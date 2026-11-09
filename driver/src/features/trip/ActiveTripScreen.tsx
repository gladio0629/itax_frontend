import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapPin, Phone, Star, Users, X } from "lucide-react";
import { api } from "@/api/client";
import type { OrderWithDetails } from "@/api/types";
import { MapView } from "@/components/MapView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { formatSom, formatKm } from "@/lib/format";

type LoadState = "loading" | "error" | "ready";

export function ActiveTripScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderWithDetails | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [finished, setFinished] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!cancelling) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setCancelling(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancelling]);

  async function load() {
    if (!orderId) return;
    setState("loading");
    try {
      const trip = await api.getActiveTrip();
      if (!trip || trip.id !== orderId) {
        const history = await api.getOrderHistory();
        const found = history.find((o) => o.id === orderId);
        if (found) {
          setOrder(found);
          setFinished(true);
          setState("ready");
          return;
        }
        navigate("/offers", { replace: true });
        return;
      }
      setOrder(trip);
      setState("ready");
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleStart() {
    if (!order) return;
    setBusy(true);
    try {
      const next = await api.startTrip(order.id);
      setOrder(next);
    } catch {
      setToast("Safarni boshlashda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!order) return;
    setBusy(true);
    try {
      await api.completeTrip(order.id);
      setFinished(true);
    } catch {
      setToast("Safarni yakunlashda xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setBusy(true);
    try {
      await api.cancelTrip(order.id, "Haydovchi tomonidan bekor qilindi");
      navigate("/offers", { replace: true });
    } catch {
      setToast("Bekor qilishda xatolik yuz berdi");
    } finally {
      setBusy(false);
      setCancelling(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="Faol safar" showBack={false} />
        <div className="flex-1 space-y-3 px-5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (state === "error" || !order) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <ScreenHeader title="Faol safar" showBack={false} />
        <div className="flex flex-1 items-center justify-center">
          <ErrorState onRetry={load} />
        </div>
      </div>
    );
  }

  const inProgress = order.status === "in_progress";
  const totalPrice = order.price + (order.coRiders?.reduce((s, c) => s + c.order.price, 0) ?? 0);
  const passengerCount = 1 + (order.coRiders?.length ?? 0);

  if (finished) {
    return (
      <div className="flex h-full flex-col bg-bg px-6 text-center">
        <ScreenHeader title="Safar yakunlandi" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-5 animate-fade-in">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-bg animate-check-pop">
            <Star className="h-9 w-9 fill-bg" />
          </div>
          <div>
            <p className="text-lg font-semibold text-ink">Ajoyib ish!</p>
            <p className="mt-1 text-sm text-ink/60">Safar muvaffaqiyatli yakunlandi.</p>
          </div>
          <Card className="w-full space-y-2 p-5 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Yo'nalish</span>
              <span className="font-semibold text-ink">
                {order.fromCity.name} &rarr; {order.toCity.name}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/60">Jami tushum</span>
              <span className="font-semibold tabular text-accent">{formatSom(totalPrice)}</span>
            </div>
          </Card>
        </div>
        <div style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
          <Button fullWidth onClick={() => navigate("/offers", { replace: true })}>
            Yangi buyurtmalarga qaytish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-bg">
      <div className="relative h-56 shrink-0">
        <MapView showCar carProgress={inProgress ? 0.65 : 0.15} />
        <div className="absolute inset-x-0 top-0" style={{ paddingTop: "var(--safe-top)" }}>
          <div className="flex items-center justify-between px-4 pt-3">
            <Badge tone="accent">{inProgress ? "Yo'lda" : "Yo'lovchi tomon"}</Badge>
            <button
              onClick={() => setCancelling(true)}
              aria-label="Bekor qilish"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-card/90 text-ink shadow-softer backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-ink/50" />
              <p className="text-sm font-semibold text-ink">
                {order.fromCity.name} &rarr; {order.toCity.name}
              </p>
            </div>
            <span className="text-xs text-ink/60 tabular">{formatKm(order.distanceKm)}</span>
          </div>

          {order.passenger && (
            <div className="flex items-center gap-3 rounded-xl bg-bg p-3">
              <Avatar seed={order.passenger.avatarSeed} name={order.passenger.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{order.passenger.name}</p>
                <p className="flex items-center gap-1 text-xs text-ink/60">
                  <Star className="h-3 w-3 fill-warning text-warning" /> {order.passenger.rating}
                </p>
              </div>
              <button
                aria-label="Qo'ng'iroq qilish"
                onClick={() => setToast("Demo rejimida qo'ng'iroq mavjud emas")}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-10 text-accent transition-colors hover:bg-accent-10/70 active:scale-95"
              >
                <Phone className="h-4 w-4" />
              </button>
            </div>
          )}

          {order.coRiders && order.coRiders.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink/60">
                <Users className="h-3.5 w-3.5" /> Yana {order.coRiders.length} yo'lovchi shu yo'nalishda
              </p>
              {order.coRiders.map((c) => (
                <div key={c.order.id} className="flex items-center gap-3 rounded-xl bg-bg p-3">
                  {c.passenger && <Avatar seed={c.passenger.avatarSeed} name={c.passenger.name} size={36} />}
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{c.passenger?.name ?? "Yo'lovchi"}</p>
                  <span className="shrink-0 text-xs font-semibold tabular text-ink/80">{formatSom(c.order.price)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-accent-5 px-4 py-3">
            <span className="text-xs font-semibold text-accent">
              {passengerCount > 1 ? `${passengerCount} yo'lovchi uchun jami` : "To'lov"}
            </span>
            <span className="text-sm font-semibold tabular text-accent">{formatSom(totalPrice)}</span>
          </div>
        </Card>
      </div>

      <div className="px-5" style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        {!inProgress ? (
          <Button fullWidth loading={busy} onClick={handleStart}>
            Safarni boshlash
          </Button>
        ) : (
          <Button fullWidth loading={busy} onClick={handleComplete}>
            Safarni yakunlash
          </Button>
        )}
      </div>

      {cancelling && (
        <div
          className="absolute inset-0 z-50 flex items-end bg-black/60"
          onClick={() => setCancelling(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-trip-title"
            className="w-full rounded-t-sheet bg-card p-6 animate-slide-up"
            style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p id="cancel-trip-title" className="mb-1 text-lg font-semibold text-ink">Safarni bekor qilasizmi?</p>
            <p className="mb-5 text-sm text-ink/60">Yo'lovchiga xabar beriladi va buyurtma bekor qilinadi.</p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setCancelling(false)}>
                Yo'q
              </Button>
              <Button variant="danger" className="flex-1" loading={busy} onClick={handleCancel}>
                Bekor qilish
              </Button>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
