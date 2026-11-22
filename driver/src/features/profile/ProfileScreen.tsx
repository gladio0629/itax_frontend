import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { DriverDocument } from "@/api/types";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { Bell, ChevronRight, FileText, HelpCircle, Route, Settings2, SlidersHorizontal, Star, Trophy } from "@/lib/icons";
import { Screen, HeaderButton } from "@/components/Screen";
import { SettingsRow } from "@/components/SettingsRow";
import { Skeleton } from "@/components/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Monogram } from "@/features/trip/parts";
import { useNavigate } from "react-router-dom";
import carSedan from "@/assets/car-sedan.png";
import { cn } from "@/lib/cn";
import { groupDigits } from "@/lib/format";

function docsStatus(docs: DriverDocument[]): TranslationKey | null {
  if (!docs.length) return null;
  if (docs.every((d) => d.status === "approved")) return "profile.docsOk";
  if (docs.some((d) => d.status === "none")) return "profile.docsNeeded";
  return "profile.docsChecking";
}

/**
 * Profil (design v2): who the driver is (rating, trips, acceptance), the
 * level and commission, the car, then Imkoniyatlarim, documents, routes,
 * notifications and help. Settings (theme, language, sign out, delete
 * account) are behind the top-right button.
 */
export default function ProfileScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const profile = useQuery(() => api.getProfile(), []);
  const bonus = useQuery(() => (api.capabilities.bonus ? api.getBonus() : Promise.resolve(null)), []);
  const caps = useQuery(() => (api.capabilities.driverCapabilities ? api.getCapabilities() : Promise.resolve(null)), []);
  const p = profile.data;
  const b = bonus.data;
  const c = caps.data;
  const years = p?.memberSinceYear != null ? new Date().getFullYear() - p.memberSinceYear : null;
  const docs = p ? docsStatus(p.documents) : null;

  return (
    <Screen
      title={t("profile.title")}
      right={
        <HeaderButton label={t("profile.openSettings")} onClick={() => navigate("/profile/settings")}>
          <Settings2 className="h-5 w-5" />
        </HeaderButton>
      }
      top={
        p ? (
          <div className="flex flex-col gap-[18px]">
            <div className="flex items-center gap-4">
              <span className="relative shrink-0">
                <Monogram name={p.name} size={72} tone="brand" />
                {b && (
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-night bg-night-2 text-white" aria-hidden="true">
                    <Trophy className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[22px] font-extrabold leading-7 text-white">{p.name}</span>
                <span className="tabular truncate text-13 font-semibold text-night-muted">
                  {p.phoneMasked}
                  {years != null && ` · ${years > 0 ? t("profile.yearsSince", { n: years }) : t("profile.thisYear")}`}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat value={p.rating > 0 ? p.rating.toFixed(2) : "—"} label={t("profile.statRating")} star />
              {p.totalTrips != null && <Stat value={groupDigits(p.totalTrips)} label={t("profile.statTrips")} />}
              {p.acceptancePct != null && <Stat value={`${p.acceptancePct}%`} label={t("profile.statAccept")} />}
            </div>
          </div>
        ) : !profile.error ? (
          <Skeleton className="h-40 w-full rounded-card bg-night-2" />
        ) : undefined
      }
    >
      {profile.error && !p ? (
        <ErrorState error={profile.error} onRetry={() => profile.reload()} />
      ) : (
        <div className="flex flex-col gap-4">
          {b && (
            <Link to="/profile/level" className="press flex flex-col gap-3 rounded-card bg-raised p-4">
              <span className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-tile bg-surface text-ink" aria-hidden="true">
                  <Trophy className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-17 font-extrabold text-ink">{t("profile.levelName", { level: t(`bonus.level.${b.currentLevel.key}`) })}</span>
                  <span className="text-13 font-semibold text-muted">{t("profile.levelCommission", { pct: b.commissionPct })}</span>
                </span>
                <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted" />
              </span>
              <span className="relative block h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${Math.round(b.progressRatio * 100)}%` }} />
              </span>
              <span className="text-13 font-semibold text-muted">
                {b.nextLevel ? t("profile.toNext", { level: t(`bonus.level.${b.nextLevel.key}`), n: b.tripsToNext }) : t("profile.topLevel")}
              </span>
            </Link>
          )}

          {p?.car && (
            <div className="flex items-center gap-3 rounded-card border border-line p-3 pr-4">
              <img src={carSedan} alt="" width={132} height={56} className="h-14 w-[132px] shrink-0 object-contain" />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-15 font-extrabold text-ink">{p.car.model}</span>
                <span className="truncate text-xs font-semibold text-muted">
                  {t("profile.carLine", { color: t(`color.${p.car.color}` as TranslationKey), year: p.car.year })}
                </span>
                <span translate="no" className="tabular w-max rounded-md border-2 border-ink px-2 py-0.5 text-13 font-extrabold tracking-wide text-ink">
                  {p.car.plate}
                </span>
              </span>
            </div>
          )}

          <div className="flex flex-col">
            {api.capabilities.driverCapabilities && (
              <SettingsRow
                icon={SlidersHorizontal}
                label={t("profile.capabilities")}
                description={
                  c
                    ? c.bodySizes.length
                      ? t(c.loaderHelp ? "caps.summaryLoader" : "caps.summary", { sizes: c.bodySizes.join(", ") })
                      : t("caps.none")
                    : undefined
                }
                to="/profile/capabilities"
              />
            )}
            <SettingsRow icon={FileText} label={t("profile.docs")} description={docs ? t(docs) : undefined} to="/profile/personal" />
            {api.capabilities.routes && <SettingsRow icon={Route} label={t("routes.title")} to="/profile/routes" />}
            <SettingsRow icon={Bell} label={t("profile.notifications")} to="/notifications" />
            {api.capabilities.help && <SettingsRow icon={HelpCircle} label={t("profile.help")} to="/profile/help" />}
          </div>
        </div>
      )}
    </Screen>
  );
}

function Stat({ value, label, star }: { value: string; label: string; star?: boolean }) {
  return (
    <span className="flex flex-col gap-0.5 rounded-field bg-night-2 px-4 py-3">
      <span className={cn("tabular flex items-center gap-1.5 text-xl font-extrabold text-white")}>
        {star && <Star className="h-4 w-4 fill-star text-star" />}
        {value}
      </span>
      <span className="text-xs font-semibold text-night-muted">{label}</span>
    </span>
  );
}
