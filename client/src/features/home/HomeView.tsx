import type { ReactNode, RefObject } from "react";
import type { Profile, RouteSuggestion, SavedAddressInfo, ServiceType } from "@/api/types";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { detailsSummary } from "@/features/order/addressDetails";
import { formatDuration } from "@/features/order/duration";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";
import { Icon, SectionLabel, Segmented, useShellChrome, useStatusBar, type IconName } from "@/ui";

/**
 * Pickup on the map (design: green halo, Ink dot with a white ring). With a
 * server ETA (capabilities.pickupEta) a caption above it says when a car
 * can be there — kept from the old Home's pin bubble.
 */
export function PickupPin({ eta }: { eta?: number | null }) {
  const { t } = useT();
  return (
    <span className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full bg-iz-green/20">
      {api.capabilities.pickupEta && eta != null && (
        <span
          role="status"
          className="absolute bottom-[58px] left-1/2 flex h-8 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-iz-map-pin px-3 text-[12px] font-bold text-iz-head-text shadow-[0_6px_16px_var(--iz-shadow-strong)]"
        >
          <span aria-hidden className="h-2 w-2 rounded-full bg-iz-green" />
          {t("home.pickupEta", { eta: t("pin.eta", { n: eta }) })}
        </span>
      )}
      <span aria-hidden className="h-[22px] w-[22px] rounded-full border-4 border-iz-head-text bg-iz-map-pin shadow-[0_2px_6px_var(--iz-shadow)]" />
    </span>
  );
}

/**
 * Over the map: the menu button (Home owns it, so the shell's floating one
 * hides) and the current city. Sets the status bar for a map screen.
 */
export function HomeTopBar({ cityName, onCity }: { cityName?: string; onCity: () => void }) {
  const { t } = useT();
  const shell = useShellChrome();
  useStatusBar("map");
  return (
    <div className="absolute inset-x-5 z-10 flex items-center justify-between gap-3" style={{ top: "calc(var(--safe-top) + 12px)" }}>
      <button
        type="button"
        onClick={shell?.openDrawer}
        aria-label={t("drawer.open")}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-iz-map-pin text-iz-head-text shadow-[0_8px_20px_var(--iz-shadow-strong)] active:scale-95"
      >
        <Icon name="menu" />
      </button>
      {cityName && (
        <button
          type="button"
          onClick={onCity}
          aria-label={t("home.currentCity", { city: cityName })}
          className="flex h-12 min-w-0 items-center gap-2.5 rounded-full bg-iz-sheet pl-2 pr-[18px] text-[14px] font-extrabold text-iz-ink shadow-[0_8px_20px_var(--iz-shadow)] active:scale-[0.98]"
        >
          <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iz-green-soft text-iz-green-text">
            <Icon name="pin" size={16} />
          </span>
          <span className="truncate">{cityName}</span>
        </button>
      )}
    </div>
  );
}

function RoutePoint({ label, value, placeholder, onClick, divider }: { label: string; value: string | null; placeholder: string; onClick: () => void; divider?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-14 w-full min-w-0 flex-col justify-center gap-0.5 text-left active:opacity-70", divider && "border-b border-iz-divider-in-field")}
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.8px] text-iz-muted">{label}</span>
      <span className={cn("truncate text-[15px]", value ? "font-bold text-iz-ink" : "font-semibold text-iz-muted")}>{value ?? placeholder}</span>
    </button>
  );
}

/** Qayerdan / Qayerga card with the dotted connector and the swap button. */
function RouteCard({ from, to, onFrom, onTo, onSwap }: { from: string | null; to: string | null; onFrom: () => void; onTo: () => void; onSwap: () => void }) {
  const { t } = useT();
  return (
    <div className="flex items-center gap-3.5 rounded-iz-card bg-iz-field py-1.5 pl-4 pr-3">
      <div aria-hidden className="flex flex-col items-center gap-1">
        <span className="h-3.5 w-3.5 rounded-full border-[3px] border-iz-ink bg-iz-green" />
        <span className="h-[30px] w-0 border-l-2 border-dotted border-iz-connector" />
        <span className="h-3 w-3 rounded-[4px] bg-iz-ink" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <RoutePoint label={t("home.fromLabel")} value={from} placeholder={t("home.fromPlaceholder")} onClick={onFrom} divider />
        <RoutePoint label={t("home.toLabel")} value={to} placeholder={t("home.toPlaceholder")} onClick={onTo} />
      </div>
      <button
        type="button"
        onClick={onSwap}
        disabled={!to}
        aria-label={t("home.swap")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-iz-sheet text-iz-ink shadow-[0_4px_12px_var(--iz-shadow)] disabled:opacity-40"
      >
        <Icon name="swap" size={18} />
      </button>
    </div>
  );
}

function ServiceSwitch({ value, onChange, withIcons }: { value: ServiceType; onChange: (v: ServiceType) => void; withIcons: boolean }) {
  const { t } = useT();
  const label = (icon: IconName, text: string) =>
    withIcons ? (
      <span className="inline-flex items-center justify-center gap-2">
        <Icon name={icon} size={18} />
        {text}
      </span>
    ) : (
      text
    );
  return (
    <Segmented
      label={t("home.service")}
      value={value}
      onChange={onChange}
      className="h-[58px] rounded-[29px] [&>button]:rounded-[24px] [&>button]:text-[15px]"
      options={[
        { value: "passenger", label: label("car", t("home.servicePassenger")) },
        { value: "delivery", label: label("box", t("home.serviceDelivery")) },
      ]}
    />
  );
}

function SavedChip({ info, onClick, wide }: { info: SavedAddressInfo; onClick: () => void; wide: boolean }) {
  const { t } = useT();
  // Home / work: the kind's word in the current language; else the name the
  // passenger gave, else the place itself. The line under it is the place.
  const named = info.kind === "home" || info.kind === "work";
  const title = named ? t(`details.kind.${info.kind}` as TranslationKey) : info.name ?? info.address.label;
  // Under the name: the Tafsilotlar summary when the place has them, else
  // the place / area; the server's ETA from the pickup on the right.
  const subtitle = detailsSummary(info.details, t) || (named || info.name ? info.address.label : info.area);
  const icon: IconName = info.kind === "home" ? "home" : info.kind === "work" ? "briefcase" : "pin";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-14 min-w-0 items-center gap-2.5 rounded-[28px] bg-iz-field pl-2 pr-3 text-left active:opacity-80",
        wide ? "flex-1" : "w-[150px] shrink-0"
      )}
    >
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-iz-selected text-iz-on-selected">
        <Icon name={icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[14px] font-extrabold text-iz-ink">{title}</span>
        {(info.etaMinutes != null || subtitle) && (
          <span className="truncate text-[12px] font-semibold text-iz-muted">
            {info.etaMinutes != null && <span className="text-iz-green-text">{formatDuration(info.etaMinutes, t)}</span>}
            {info.etaMinutes != null && subtitle ? " · " : ""}
            {subtitle}
          </span>
        )}
      </span>
    </button>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={label}>
      <SectionLabel as="h2">{label}</SectionLabel>
      {children}
    </section>
  );
}

type HomeSheetProps = {
  panelRef: RefObject<HTMLDivElement>;
  profile: Profile | null;
  fromLabel: string | null;
  toLabel: string | null;
  serviceType: ServiceType;
  onServiceType: (v: ServiceType) => void;
  onFrom: () => void;
  onTo: () => void;
  onSwap: () => void;
  saved: SavedAddressInfo[];
  savedLoading: boolean;
  savedError: boolean;
  onRetrySaved: () => void;
  onSaved: (info: SavedAddressInfo) => void;
  onAddSaved: () => void;
  recent: RouteSuggestion[];
  recentLoading: boolean;
  recentError: boolean;
  onRetryRecent: () => void;
  cityNames: Record<string, string>;
  onRecent: (r: RouteSuggestion) => void;
};

/**
 * Home's white sheet (design: Home, HomeEmpty). A passenger with no saved
 * places and no recent routes gets the "new user" layout: one search field
 * and the prompt to save home and work.
 */
export function HomeSheet(p: HomeSheetProps) {
  const { t } = useT();
  const first = p.profile?.firstName || p.profile?.name?.split(/\s+/)[0] || "";
  const loading = p.savedLoading || p.recentLoading;
  const isNew = !loading && !p.savedError && !p.recentError && p.saved.length === 0 && p.recent.length === 0;
  const recent = p.recent.slice(0, 4);

  return (
    <div
      ref={p.panelRef}
      role="region"
      aria-label={t("home.orderSheet")}
      className="no-scrollbar absolute inset-x-0 bottom-0 z-20 flex max-h-[78%] flex-col gap-3.5 overflow-y-auto overscroll-contain rounded-t-iz-sheet bg-iz-sheet px-5 pb-[calc(max(var(--safe-bottom),16px)+8px)] pt-3 shadow-[0_-10px_40px_var(--iz-shadow)]"
    >
      <span aria-hidden className="h-[5px] w-10 shrink-0 self-center rounded-full bg-iz-chip-border" />
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-iz-muted">{first && !isNew ? t("home.hello", { name: first }) : t("home.welcome")}</span>
        <h1 className="text-[26px] font-extrabold leading-[34px] text-iz-ink">{t("home.whereTo")}</h1>
      </div>

      {isNew ? (
        <button type="button" onClick={p.onTo} className="flex h-16 shrink-0 items-center gap-3.5 rounded-iz-card bg-iz-field px-4 text-left active:opacity-80">
          <Icon name="search" size={22} className="text-iz-muted" />
          <span className="text-[16px] font-bold text-iz-muted">{t("home.toPlaceholder")}</span>
        </button>
      ) : (
        <RouteCard from={p.fromLabel} to={p.toLabel} onFrom={p.onFrom} onTo={p.onTo} onSwap={p.onSwap} />
      )}

      <ServiceSwitch value={p.serviceType} onChange={p.onServiceType} withIcons={!isNew} />

      {loading ? (
        <div aria-busy="true" aria-label={t("state.loading")} className="flex animate-pulse gap-2">
          <span className="h-14 flex-1 rounded-[28px] bg-iz-skeleton" />
          <span className="h-14 flex-1 rounded-[28px] bg-iz-skeleton" />
        </div>
      ) : isNew ? (
        <button type="button" onClick={p.onAddSaved} className="flex items-center gap-3.5 rounded-iz-card border-2 border-dashed border-iz-dash p-4 text-left active:opacity-80">
          <span aria-hidden className="flex shrink-0">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-iz-sheet bg-iz-selected text-iz-on-selected">
              <Icon name="home" size={18} />
            </span>
            <span className="-ml-3 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-iz-sheet bg-iz-green-soft text-iz-green-text">
              <Icon name="briefcase" size={18} />
            </span>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-[15px] font-extrabold text-iz-ink">{t("home.emptyPromptTitle")}</span>
            <span className="text-[13px] leading-[18px] text-iz-muted">{t("home.emptyPromptDesc")}</span>
          </span>
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-iz-green text-iz-on-green">
            <Icon name="plus" size={18} />
          </span>
        </button>
      ) : (
        <>
          <Section label={t("home.saved")}>
            {p.savedError ? (
              <button type="button" onClick={p.onRetrySaved} className="flex h-11 items-center gap-2 self-start text-[14px] font-bold text-iz-danger">
                <Icon name="refresh" size={18} />
                {t("home.loadFailed")} · {t("common.retry")}
              </button>
            ) : (
              <div className={cn("flex gap-2", p.saved.length > 2 && "no-scrollbar -mx-5 overflow-x-auto px-5")}>
                {p.saved.map((info) => (
                  <SavedChip key={info.address.id} info={info} wide={p.saved.length <= 2} onClick={() => p.onSaved(info)} />
                ))}
                <button
                  type="button"
                  onClick={p.onAddSaved}
                  aria-label={t("home.saveAddress")}
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-iz-dash text-iz-ink active:opacity-70"
                >
                  <Icon name="plus" />
                </button>
              </div>
            )}
          </Section>
          {p.recentError && (
            <Section label={t("home.recentRoutes")}>
              <button type="button" onClick={p.onRetryRecent} className="flex h-11 items-center gap-2 self-start text-[14px] font-bold text-iz-danger">
                <Icon name="refresh" size={18} />
                {t("home.loadFailed")} · {t("common.retry")}
              </button>
            </Section>
          )}
          {recent.length > 0 && (
            <Section label={t("home.recentRoutes")}>
              <div className="grid grid-cols-2 gap-2.5">
                {recent.map((r) => (
                  <button
                    key={`${r.fromCityId}-${r.toCityId}`}
                    type="button"
                    onClick={() => p.onRecent(r)}
                    className="flex h-16 min-w-0 items-center justify-between gap-2 rounded-iz-field border border-iz-border pl-3.5 pr-3 text-left active:bg-iz-field"
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {p.cityNames[r.fromCityId] && <span className="truncate text-[12px] font-semibold text-iz-muted">{p.cityNames[r.fromCityId]}</span>}
                      <span className="truncate text-[15px] font-extrabold text-iz-ink">{p.cityNames[r.toCityId] ?? r.label}</span>
                    </span>
                    <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iz-green-soft text-iz-green-text">
                      <Icon name="arrowRight" size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}
