import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CreditCard, Settings, HelpCircle, LogOut, Star } from "lucide-react";
import { api } from "@/api/client";
import type { Profile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { SkeletonCard } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { useAuthStore } from "@/stores/authStore";

// Wallet/referral menu items removed with the bottom nav (Step 1) — wallet
// is TODO-pending (see WalletScreen.tsx) and referral folds into Bonuslar
// in Step 3. This whole screen's content (profile card + menu) folds into
// Sozlamalar/Akkaunt in Step 5; it's unreachable from the drawer already.
const MENU = [
  { icon: CreditCard, label: "Kartalarim", to: "/cards" },
  { icon: Settings, label: "Sozlamalar", to: "/settings" },
  { icon: HelpCircle, label: "Yordam", to: "/help" },
];

type LoadState = "loading" | "error" | "ready";

export function ProfileScreen() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<Profile | null>(null);
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
      <div className="pl-16 pr-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Profil</h1>
      </div>
      <div
        className="flex-1 overflow-y-auto px-4 pt-4"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
      >
        {state === "error" && <ErrorState onRetry={load} />}
        {state === "loading" && <SkeletonCard />}
        {state === "ready" && profile && (
          <div className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-softer">
            <Avatar seed={profile.avatarSeed} name={profile.name} size={56} />
            <div>
              <p className="text-base font-semibold text-ink">{profile.name}</p>
              <p className="text-xs text-ink/60">{profile.phoneMasked}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                <Star className="h-3 w-3 fill-warning" /> {profile.rating.toFixed(1)} &middot; {profile.totalTrips} safar
              </p>
            </div>
          </div>
        )}

        {state !== "error" && (
          <div className="mt-4 space-y-2">
            {MENU.map(({ icon: Icon, label, to }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3.5 shadow-softer active:scale-[0.98] transition-transform"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-ink">
                  <Icon className="h-4 w-4 text-ink/60" /> {label}
                </span>
                <ChevronRight className="h-4 w-4 text-ink/60" />
              </button>
            ))}
            <button
              onClick={() => {
                logout();
                navigate("/auth/phone", { replace: true });
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-medium text-danger active:scale-[0.98] transition-transform"
            >
              <LogOut className="h-4 w-4" /> Chiqish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
