import { Navigate, useParams } from "react-router-dom";
import { Ban, Car, CircleHelp } from "lucide-react";
import { isApiError } from "@shared/http/errors";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatAgo, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { driverBadge } from "@/features/drivers/driverLabels";
import { CardTabs, Crumbs, KvRows, Notice, OpStat, OrderLink, ProfileHeader, Section, StatRow, Timeline, opDate } from "./cardParts";
import { opPath } from "@/features/ops/paths";
import { orderNo, requestParam } from "./labels";
import { DriverCancelsTab, DriverDocsTab, DriverReviewsTab, DriverTripsTab, DriverWalletTab, monthIn } from "./driverTabs";
import { SmsTab } from "./SmsTab";
import { NotesTab } from "./NotesTab";
import { useOpData } from "./useOpData";
import type { CargoBodySize, TariffCarClass } from "@/api/types";
import type { OpDriverCard } from "@/api/opCards/types";

const TABS = {
  docs: "Hujjatlar",
  wallet: "Hamyon",
  trips: "Safarlar",
  cancels: "Bekor qilishlar",
  reviews: "Shikoyat va baholar",
  sms: "Kirish (SMS)",
  notes: "Murojaatlar",
} as const;
type TabKey = keyof typeof TABS;
const isTab = (t: string | undefined): t is TabKey => !!t && t in TABS;
const isNotFound = (e: unknown) => isApiError(e) && /NOT_FOUND$/.test(e.code);

const CAR_CLASS: Record<TariffCarClass, string> = { economy: "Standart", comfort: "Komfort", business: "Biznes", minivan: "Miniven" };
const BODIES: CargoBodySize[] = ["S", "M", "L", "XL", "XXL", "3XL"];
const nowMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** /operators/drivers/:driverId/:tab? — the operator's driver card
 * (designs OpDriver + OpDriver*). Money, documents and blocking are
 * read-only; changes go through "Menejerga so'rov". */
export function OpDriverPage() {
  const { driverId = "" } = useParams();
  // Keyed by id: another driver's card never shows while this one loads.
  return <DriverCard key={driverId} driverId={driverId} />;
}

function DriverCard({ driverId }: { driverId: string }) {
  const { tab } = useParams();
  const { data: card, error, loading, reload } = useOpData(
    () =>
      api.getOpDriver(driverId).catch((e) => {
        if (isNotFound(e)) throw new Error("not_found");
        throw e;
      }),
    driverId
  );

  if (tab !== undefined && !isTab(tab)) return <Navigate to={opPath.driver(driverId)} replace />;
  const tabLabel = isTab(tab) ? TABS[tab] : "Umumiy";
  const crumbs = (id?: string) => <Crumbs items={[{ label: "Haydovchilar", to: opPath.drivers }, ...(id ? [{ label: id }, { label: tabLabel }] : [])]} />;

  if (!card) {
    return (
      <>
        <PageHeader back={opPath.drivers} subtitle={crumbs()} title="Haydovchi" />
        {error === "not_found" ? (
          <EmptyState icon={<Car />} title="Haydovchi topilmadi" description="Havola eskirgan yoki haydovchi o'chirilgan." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} retrying={loading} />
        ) : (
          <>
            <Skeleton className="h-[112px] rounded-card" />
            <Skeleton className="h-11 w-3/4 rounded-full" />
            <Skeleton className="h-[300px] rounded-card" />
          </>
        )}
      </>
    );
  }

  const b = driverBadge({ ...card, archived: false });
  const base = opPath.driver(card.id);
  const subject = { kind: "driver" as const, id: card.id };
  return (
    <>
      <PageHeader back={opPath.drivers} subtitle={crumbs(card.displayId)} title={card.name} />
      <ProfileHeader
        name={card.name}
        avatarTone="green"
        badge={<Badge tone={b.tone}>{b.label}</Badge>}
        phone={card.phone}
        info={[
          `ID ${card.displayId}`,
          [card.carModel, card.plate].filter(Boolean).join(" · "),
          ...(card.onTrip
            ? [
                <span key="trip" className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-green" />
                  Safarda
                </span>,
              ]
            : []),
        ]}
        actions={card.actions}
        requestValue={requestParam("driver", card.id)}
      />
      <CardTabs
        label="Karta bo'limlari"
        items={[
          { to: base, label: "Umumiy", end: true },
          { to: opPath.driver(card.id, "docs"), label: TABS.docs, count: card.tabs.docs },
          { to: opPath.driver(card.id, "wallet"), label: TABS.wallet },
          { to: opPath.driver(card.id, "trips"), label: TABS.trips, count: card.tabs.trips },
          { to: opPath.driver(card.id, "cancels"), label: TABS.cancels, count: card.tabs.cancels },
          { to: opPath.driver(card.id, "reviews"), label: TABS.reviews, count: card.tabs.complaints },
          { to: opPath.driver(card.id, "sms"), label: TABS.sms },
          { to: opPath.driver(card.id, "notes"), label: TABS.notes, count: card.tabs.notes },
        ]}
      />
      {tab === "docs" ? (
        <DriverDocsTab driverId={card.id} />
      ) : tab === "wallet" ? (
        <DriverWalletTab driverId={card.id} />
      ) : tab === "trips" ? (
        <DriverTripsTab driverId={card.id} />
      ) : tab === "cancels" ? (
        <DriverCancelsTab driverId={card.id} />
      ) : tab === "reviews" ? (
        <DriverReviewsTab driverId={card.id} />
      ) : tab === "sms" ? (
        <SmsTab subject={subject} defaultPeriod="14d" onChanged={reload} />
      ) : tab === "notes" ? (
        <NotesTab subject={subject} onChanged={reload} />
      ) : (
        <Overview card={card} />
      )}
    </>
  );
}

function Overview({ card }: { card: OpDriverCard }) {
  const s = card.stats;
  const c = card.car;
  const a = card.app;
  const lb = card.lastBlock;
  return (
    <>
      {lb && (
        <Notice icon={<Ban />} tone={lb.to ? "grey" : "danger"}>
          <b>{lb.to ? "Oldin bloklangan:" : "Bloklangan:"}</b> {opDate(lb.from)}
          {lb.to ? ` – ${opDate(lb.to)}` : " dan"}. Sabab: {lb.reason}. Blokladi: {lb.blockedBy}.{lb.unblockedBy && ` Blokdan chiqardi: ${lb.unblockedBy}.`}
        </Notice>
      )}
      <StatRow>
        <OpStat label="Safarlar" value={formatNumber(s.trips)} sub="jami" />
        <OpStat label="Reyting" value={s.rating ? s.rating.toFixed(2) : "—"} sub={`so'nggi ${s.ratingBasis} safar`} />
        <OpStat label="Bekor qilgan" value={s.cancelsThisMonth} sub={monthIn(nowMonth())} tone={s.cancelsThisMonth > 0 ? "danger" : undefined} />
        <OpStat label="Balans" value={formatNumber(s.balance)} sub="so'm" tone={s.balance < 0 ? "danger" : undefined} />
      </StatRow>
      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Mashina va imkoniyatlar">
          <KvRows
            rows={[
              ["Mashina", c.title || "—"],
              ["Davlat raqami", c.plate || "—"],
              ["Klass", [c.carClass ? CAR_CLASS[c.carClass] : null, c.seats ? `${c.seats} o'rin` : null].filter(Boolean).join(" · ") || "—"],
              ["Yo'nalishlari", c.routes.length ? c.routes.join(", ") : "—"],
              [
                "Kuzov",
                <span key="b" className="inline-flex flex-wrap justify-end gap-1.5" aria-label={c.bodies.length ? `Kuzov: ${c.bodies.join(", ")}` : "Kuzov yo'q"}>
                  {BODIES.map((x) => (
                    <span
                      key={x}
                      aria-hidden
                      className={cn(
                        "inline-flex h-8 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-extrabold",
                        c.bodies.includes(x) ? "bg-ink text-white" : "bg-surface text-muted"
                      )}
                    >
                      {x}
                    </span>
                  ))}
                </span>,
              ],
              ["Yukchi bo'lib yordam beradi", c.loaderHelp === null ? "—" : <span key="l" className={c.loaderHelp ? "text-green-text" : ""}>{c.loaderHelp ? "Ha" : "Yo'q"}</span>],
            ]}
          />
        </Section>
        <Section title="Ilova va joylashuv">
          <KvRows
            rows={[
              ["Ilova versiyasi", a.version ?? "—"],
              ["Oxirgi faollik", a.lastSeenAt ? formatAgo(a.lastSeenAt).toLowerCase() : "—"],
              ["Oxirgi joylashuv", a.lastLocation ?? "—"],
              ["Tezlik", a.speedKmh !== null ? `${a.speedKmh} km/soat` : "—"],
              [
                "Hozirgi safar",
                a.currentTrip ? (
                  <span key="t">
                    <OrderLink to={opPath.order(a.currentTrip.id)}>{orderNo(a.currentTrip.id)}</OrderLink> · {a.currentTrip.from} → {a.currentTrip.to}
                  </span>
                ) : (
                  "Yo'q"
                ),
              ],
            ]}
          />
          {a.minVersion && <Notice icon={<CircleHelp />}>Ilova versiyasi eski bo'lsa ({a.minVersion} dan past), haydovchiga yangilashni ayting.</Notice>}
        </Section>
        <Section title="Holat tarixi">
          <Timeline items={card.statusHistory} />
        </Section>
      </div>
    </>
  );
}
