import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Car, FileText, History, Settings, Star } from "lucide-react";
import { api } from "@/api/client";
import type { DriverProfile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { BottomNav } from "@/components/BottomNav";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonCard } from "@/components/Skeleton";

const DOC_LABEL: Record<DriverProfile["documentsStatus"], { label: string; tone: "accent" | "warning" | "danger" }> = {
  approved: { label: "Tasdiqlangan", tone: "accent" },
  pending: { label: "Tekshirilmoqda", tone: "warning" },
  rejected: { label: "Rad etilgan", tone: "danger" },
};

const MENU = [
  { icon: History, label: "Safarlar tarixi", to: "/history" },
  { icon: Settings, label: "Sozlamalar", to: "/settings" },
  { icon: FileText, label: "Ro'yxatdan o'tish namunasi", to: "/register" },
];

type LoadState = "loading" | "error" | "ready";

export function ProfileScreen() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  function load() {
    setState("loading");
    api
      .getProfile()
      .then((p) => {
        setProfile(p);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(load, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="px-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Profil</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {state === "loading" && <SkeletonCard />}
        {state === "error" && <ErrorState onRetry={load} />}
        {state === "ready" && profile && (
          <>
            <div className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-softer">
              <Avatar seed={profile.avatarSeed} name={profile.name} size={56} />
              <div>
                <p className="text-base font-semibold text-ink">{profile.name}</p>
                <p className="text-xs text-ink/60">{profile.phoneMasked}</p>
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-warning">
                  <Star className="h-3 w-3 fill-warning" /> {profile.rating.toFixed(1)} &middot; {profile.totalTrips} safar
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl bg-card p-5 shadow-softer">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-5 text-accent">
                  <Car className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">{profile.carModel}</p>
                  <p className="text-xs text-ink/60">
                    {profile.carColor} &middot; {profile.plate}
                  </p>
                </div>
              </div>
              <Badge tone={DOC_LABEL[profile.documentsStatus].tone}>{DOC_LABEL[profile.documentsStatus].label}</Badge>
            </div>
          </>
        )}

        <div className="mt-4 space-y-2">
          {MENU.map(({ icon: Icon, label, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3.5 shadow-softer transition-colors hover:bg-card/80 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3 text-sm font-semibold text-ink">
                <Icon className="h-4 w-4 text-ink/60" /> {label}
              </span>
              <ChevronRight className="h-4 w-4 text-ink/60" />
            </button>
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
