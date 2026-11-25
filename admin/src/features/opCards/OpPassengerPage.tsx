import { Navigate, useParams } from "react-router-dom";
import { CircleAlert, CircleHelp, UserRound } from "lucide-react";
import { isApiError } from "@shared/http/errors";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { CardTabs, Crumbs, KvRows, Notice, OpStat, OrderLink, ProfileHeader, Section, StatRow, Timeline, opDate, opDateTime } from "./cardParts";
import { PASSENGER_STATUS, PAYMENT_LABEL, opPath, orderNo, requestParam } from "./labels";
import { PassengerBonusTab, PassengerOrdersTab, PassengerPayTab } from "./passengerTabs";
import { SmsTab } from "./SmsTab";
import { NotesTab } from "./NotesTab";
import { useOpData } from "./useOpData";
import type { OpPassengerCard } from "@/api/opCards/types";

const TABS = { orders: "Buyurtmalar", pay: "To'lovlar", bonus: "Bonus va promo", sms: "Kirish (SMS)", notes: "Murojaatlar" } as const;
type TabKey = keyof typeof TABS;
const isTab = (t: string | undefined): t is TabKey => !!t && t in TABS;
const isNotFound = (e: unknown) => isApiError(e) && /NOT_FOUND$/.test(e.code);

/** /operators/passengers/:passengerId/:tab? — the operator's passenger card
 * (designs OpPassenger + OpPassenger*). Read-only except the actions the
 * server lists (SMS, notes, manager request). */
export function OpPassengerPage() {
  const { passengerId = "" } = useParams();
  // Keyed by id: another passenger's card never shows while this one loads.
  return <PassengerCard key={passengerId} passengerId={passengerId} />;
}

function PassengerCard({ passengerId }: { passengerId: string }) {
  const { tab } = useParams();
  const { data: card, error, loading, reload } = useOpData(
    () =>
      api.getOpPassenger(passengerId).catch((e) => {
        if (isNotFound(e)) throw new Error("not_found");
        throw e;
      }),
    passengerId
  );

  if (tab !== undefined && !isTab(tab)) return <Navigate to={opPath.passenger(passengerId)} replace />;
  const tabLabel = isTab(tab) ? TABS[tab] : "Umumiy";
  const crumbs = (id?: string) => <Crumbs items={[{ label: "Yo'lovchilar", to: opPath.passengers }, ...(id ? [{ label: id }, { label: tabLabel }] : [])]} />;

  if (!card) {
    return (
      <>
        <PageHeader subtitle={crumbs()} title="Yo'lovchi" />
        {error === "not_found" ? (
          <EmptyState icon={<UserRound />} title="Yo'lovchi topilmadi" description="Havola eskirgan yoki yo'lovchi o'chirilgan." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} retrying={loading} />
        ) : (
          <>
            <Skeleton className="h-[112px] rounded-card" />
            <Skeleton className="h-11 w-2/3 rounded-full" />
            <Skeleton className="h-[300px] rounded-card" />
          </>
        )}
      </>
    );
  }

  const st = PASSENGER_STATUS[card.status];
  const base = opPath.passenger(card.id);
  const subject = { kind: "passenger" as const, id: card.id };
  return (
    <>
      <PageHeader subtitle={crumbs(card.displayId)} title={card.name} />
      <ProfileHeader
        name={card.name}
        badge={<Badge tone={st.tone}>{st.label}</Badge>}
        phone={card.phone}
        info={[`ID ${card.displayId}`, `Ro'yxatdan o'tgan: ${opDate(card.joinedAt)}`, ...(card.language ? [`Til: ${card.language}`] : [])]}
        actions={card.actions}
        requestValue={requestParam("passenger", card.id)}
      />
      <CardTabs
        label="Karta bo'limlari"
        items={[
          { to: base, label: "Umumiy", end: true },
          { to: `${base}/orders`, label: TABS.orders, count: card.tabs.orders },
          { to: `${base}/pay`, label: TABS.pay, count: card.tabs.payments },
          { to: `${base}/bonus`, label: TABS.bonus },
          { to: `${base}/sms`, label: TABS.sms, dot: card.tabs.smsAlert },
          { to: `${base}/notes`, label: TABS.notes, count: card.tabs.notes },
        ]}
      />
      {tab === "orders" ? (
        <PassengerOrdersTab passengerId={card.id} />
      ) : tab === "pay" ? (
        <PassengerPayTab passengerId={card.id} actions={card.actions} />
      ) : tab === "bonus" ? (
        <PassengerBonusTab passengerId={card.id} />
      ) : tab === "sms" ? (
        <SmsTab subject={subject} defaultPeriod="7d" onChanged={reload} />
      ) : tab === "notes" ? (
        <NotesTab subject={subject} onChanged={reload} />
      ) : (
        <Overview card={card} />
      )}
    </>
  );
}

function Overview({ card }: { card: OpPassengerCard }) {
  const s = card.stats;
  const p = card.profile;
  const del = card.deletionRequest;
  return (
    <>
      {card.statusNote && (
        <Notice tone="warning" icon={<CircleAlert />}>
          <b>{PASSENGER_STATUS[card.status].label}:</b> {card.statusNote.text} Belgiladi: <b>{card.statusNote.byName}</b>, {opDateTime(card.statusNote.at)}.
        </Notice>
      )}
      <StatRow>
        <OpStat label="Buyurtmalar" value={formatNumber(s.orders)} sub="jami" />
        <OpStat
          label="Bekor qilgan"
          value={formatNumber(s.cancelled)}
          sub={s.cancelledThisWeek > 0 ? `shundan ${s.cancelledThisWeek} tasi shu hafta` : "shu hafta yo'q"}
          tone={s.cancelled > 0 ? "danger" : undefined}
        />
        <OpStat label="Bonus balansi" value={formatNumber(s.bonusBalance)} sub="so'm" />
        <OpStat label="Reyting" value={s.rating ? s.rating.toFixed(1) : "—"} sub="haydovchilardan" />
      </StatRow>
      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Section title="Profil">
          <KvRows
            rows={[
              ["Telefon", card.phone],
              ["Ilova", p.app ?? "—"],
              ["Asosiy to'lov usuli", p.mainPayment ? PAYMENT_LABEL[p.mainPayment] : "—"],
              ["Saqlangan manzillar", p.savedAddresses.length ? p.savedAddresses.join(", ") : "—"],
              [
                "Oxirgi buyurtma",
                p.lastOrder ? (
                  <span>
                    <OrderLink to={opPath.order(p.lastOrder.id)}>{orderNo(p.lastOrder.id)}</OrderLink> · {formatShortDateTime(p.lastOrder.createdAt).toLowerCase()}
                  </span>
                ) : (
                  "—"
                ),
              ],
            ]}
          />
        </Section>
        <Section title="Holat tarixi">
          <Timeline items={card.statusHistory} />
        </Section>
        <Section
          title="Hisobni o'chirish so'rovi"
          right={
            del ? (
              del.status === "approved" ? <Badge tone="danger">Tasdiqlangan</Badge> : <Badge tone="warning">Ko'rib chiqilmoqda</Badge>
            ) : (
              <Badge tone="neutral">Yo'q</Badge>
            )
          }
        >
          {del ? (
            <>
              <KvRows
                rows={[
                  ["So'ralgan", opDateTime(del.requestedAt)],
                  ["Sabab (yo'lovchidan)", del.reason ?? "—"],
                  ["Avtomatik o'chiriladi", opDate(del.autoDeleteAt)],
                ]}
              />
              <Notice icon={<CircleHelp />}>Yo'lovchi fikridan qaytsa, so'rovni menejer bekor qiladi: "Menejerga so'rov" orqali yuboring.</Notice>
            </>
          ) : (
            <p className="text-13 font-semibold text-muted">Yo'lovchi hisobini o'chirishni so'ramagan.</p>
          )}
        </Section>
      </div>
    </>
  );
}
