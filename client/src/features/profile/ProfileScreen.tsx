import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CreditCard, Settings, HelpCircle, LogOut, Star, Gift } from "lucide-react";
import { api, FEATURE_BONUS } from "@/api/client";
import type { Profile } from "@/api/types";
import { Avatar } from "@/components/Avatar";
import { BottomNav } from "@/components/BottomNav";
import { SkeletonCard } from "@/components/Skeleton";
import { useAuthStore } from "@/stores/authStore";

const MENU = [
  { icon: CreditCard, label: "Kartalarim", to: "/cards" },
  { icon: Gift, label: "Do'stlarni taklif qilish", to: "/referral", bonus: true },
  { icon: Settings, label: "Sozlamalar", to: "/settings" },
  { icon: HelpCircle, label: "Yordam", to: "/help" },
];

export function ProfileScreen() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    api.getProfile().then(setProfile);
  }, []);

  return (
    <div className="flex h-full flex-col bg-bg">
      <div className="px-5" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
        <h1 className="text-lg font-semibold text-ink">Profil</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {!profile ? (
          <SkeletonCard />
        ) : (
          <div className="flex items-center gap-4 rounded-3xl bg-card p-5 shadow-softer">
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

        <div className="mt-4 space-y-2">
          {MENU.filter((item) => !item.bonus || FEATURE_BONUS).map(({ icon: Icon, label, to }) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-3.5 shadow-softer"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-ink">
                <Icon className="h-4 w-4 text-ink/60" /> {label}
              </span>
              <ChevronRight className="h-4 w-4 text-ink/40" />
            </button>
          ))}
          <button
            onClick={() => {
              logout();
              navigate("/auth/phone", { replace: true });
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-medium text-danger"
          >
            <LogOut className="h-4 w-4" /> Chiqish
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
