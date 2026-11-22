import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { Ban, CheckCircle2, FileCheck2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { isApiError } from "@shared/http/errors";
import { PageHeader } from "@/layouts/PageHeader";
import { Card, CardTitle } from "@/components/Card";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Avatar } from "@/components/Avatar";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { LevelBadge, MiniStat } from "@/components/Cells";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";
import { driverBadge } from "./driverLabels";
import { useDriverActions } from "./useDriverActions";
import { DriverHistory } from "./DriverHistory";
import { TripsTable } from "./TripsTable";
import type { DriverDocument, DriverProfile } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const isNotFound = (e: unknown) => isApiError(e) && /NOT_FOUND$/.test(e.code);
const shortDriverId = (id: string) => (id.startsWith("drv_") ? id.slice(4) : id.slice(0, 8));

/** /drivers/:driverId/* — profile header + tabs (design DriverProfile,
 * DriverHistory). Loaded by id, so reloads and links work. */
export function DriverPage() {
  const { driverId = "" } = useParams();
  const navigate = useNavigate();
  const { me } = usePermissions();
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .getDriver(driverId)
      .then((d) => live && setDriver(d))
      .catch((e) => {
        if (!live) return;
        setNotFound(isNotFound(e));
        setError(errorText(e));
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [driverId]);
  useEffect(() => load(), [load]);

  const actions = useDriverActions(() => load());

  if (error && !driver) {
    return (
      <>
        <PageHeader subtitle={<Crumbs />} title="Haydovchi" />
        {notFound ? (
          <EmptyState icon={<FileCheck2 />} title="Haydovchi topilmadi" description="Havola eskirgan yoki haydovchi o'chirilgan." />
        ) : (
          <ErrorState message={error} onRetry={load} retrying={loading} />
        )}
      </>
    );
  }
  if (!driver) {
    return (
      <>
        <PageHeader subtitle={<Crumbs />} title="Haydovchi" />
        <Skeleton className="h-[170px] rounded-card" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-card" />
          ))}
        </div>
      </>
    );
  }

  const badge = driverBadge(driver);
  const tabs: { to: string; label: string; end?: boolean; external?: boolean }[] = [
    { to: `/drivers/${driver.id}`, label: "Umumiy", end: true },
    ...(caps.driverTrips ? [{ to: `/drivers/${driver.id}/history`, label: "Tarix" }] : []),
    // The ledger filters by driver in http mode too (driver_id).
    ...(me?.sections.includes("wallet") ? [{ to: `/wallet?driver=${encodeURIComponent(driver.id)}`, label: "Hamyon", external: true }] : []),
    ...(driver.documents ? [{ to: `/drivers/${driver.id}/documents`, label: "Hujjatlar" }] : []),
    ...(me?.sections.includes("audit") && caps.auditSearch ? [{ to: `/audit?q=${encodeURIComponent(driver.id)}`, label: "Audit", external: true }] : []),
  ];

  return (
    <>
      <PageHeader subtitle={<Crumbs id={shortDriverId(driver.id)} />} title={driver.name} />

      <Card className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-center gap-[18px]">
          <Avatar name={driver.name} size={72} tone="green" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2.5">
              <span className="text-2xl font-extrabold text-ink">{driver.name}</span>
              <Badge tone={badge.tone}>{badge.label}</Badge>
              {driver.level && <LevelBadge level={driver.level} />}
            </span>
            <span className="tabular text-sm font-semibold text-muted">
              {driver.phone} · ro'yxatdan o'tgan: {formatDate(driver.joinedAt)} · ID {shortDriverId(driver.id)}
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {!driver.archived && (
              <Button variant="soft" onClick={() => actions.edit(driver)}>
                <Pencil className="h-4 w-4" aria-hidden /> Tahrirlash
              </Button>
            )}
            {!driver.archived &&
              (driver.status === "blocked" ? (
                <Button variant="soft" onClick={() => actions.ask("unblock", driver)}>
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Blokdan chiqarish
                </Button>
              ) : (
                <Button variant="danger" onClick={() => actions.ask("block", driver)}>
                  <Ban className="h-4 w-4" aria-hidden /> Bloklash
                </Button>
              ))}
            {driver.archived ? (
              <Button variant="soft" onClick={() => actions.ask("restore", driver)}>
                <RotateCcw className="h-4 w-4" aria-hidden /> Tiklash
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => actions.ask("archive", driver)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Arxivlash
              </Button>
            )}
          </div>
        </div>
        <nav aria-label="Haydovchi bo'limlari" className="no-scrollbar -mx-5 flex gap-7 overflow-x-auto border-t border-line px-5">
          {tabs.map((t) =>
            t.external ? (
              <Link key={t.label} to={t.to} className="flex h-11 shrink-0 items-center px-1 text-sm font-semibold text-muted hover:text-ink">
                {t.label}
              </Link>
            ) : (
              <NavLink
                key={t.label}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  cn(
                    "flex h-11 shrink-0 items-center px-1 text-sm",
                    isActive ? "font-extrabold text-ink shadow-[inset_0_-3px_0_var(--green)]" : "font-semibold text-muted hover:text-ink"
                  )
                }
              >
                {t.label}
              </NavLink>
            )
          )}
        </nav>
      </Card>

      <Routes>
        <Route index element={<Overview driver={driver} onOpenOrder={(id) => navigate(`/orders/${id}`)} />} />
        <Route path="history" element={caps.driverTrips ? <DriverHistory driver={driver} /> : <NotAvailable />} />
        <Route path="documents" element={driver.documents ? <Documents docs={driver.documents} /> : <NotAvailable />} />
      </Routes>
      {actions.elements}
    </>
  );
}

function Crumbs({ id }: { id?: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <Link to="/drivers" className="hover:text-ink hover:underline">
        Haydovchilar
      </Link>
      {id && <span aria-hidden>/</span>}
      {id && <span>{id}</span>}
    </span>
  );
}

function NotAvailable() {
  return <EmptyState icon={<FileCheck2 />} title="Hozircha mavjud emas" description="Server bu ma'lumotni hali bermaydi." />;
}

function Overview({ driver, onOpenOrder }: { driver: DriverProfile; onOpenOrder: (id: string) => void }) {
  const stats: ReactNode[] = [];
  stats.push(<MiniStat key="r" label="Reyting" value={driver.rating ? driver.rating.toFixed(2) : "—"} sub={`${formatNumber(driver.totalTrips)} safar`} />);
  if (driver.acceptRate30d !== null) stats.push(<MiniStat key="a" label="Qabul qilish" value={`${driver.acceptRate30d}%`} sub="so'nggi 30 kun" />);
  if (driver.cancelsThisWeek !== null)
    stats.push(
      <MiniStat
        key="c"
        label="Bekor qilish"
        value={driver.cancelsThisWeek}
        sub={driver.cancelLimitWeek !== null ? `bu hafta, chegara ${driver.cancelLimitWeek}` : "bu hafta"}
      />
    );
  stats.push(
    <MiniStat
      key="b"
      label="Balans"
      value={formatNumber(driver.walletBalance)}
      tone={driver.walletBalance < 0 ? "danger" : undefined}
      sub={caps.driverDebtLimit ? `so'm, chegara ${formatNumber(driver.debtLimit)}` : "so'm"}
    />
  );

  const capabilities = [
    ...(driver.cargoBodies?.length ? [`Dostavka kuzovi: ${driver.cargoBodies.join(", ")}`] : []),
    ...(driver.loaderHelp ? ["Yukchi sifatida yordam"] : []),
  ];
  const carRows: [string, string][] = [
    ["Mashina", [driver.carModel, driver.carColor?.toLowerCase(), driver.carYear].filter(Boolean).join(", ")],
    ["Davlat raqami", driver.plate || "—"],
    ...(driver.seats !== null ? ([["O'rinlar", String(driver.seats)]] as [string, string][]) : []),
    ...(driver.cargoBodies !== null || driver.loaderHelp !== null
      ? ([["Imkoniyatlar", capabilities.length ? capabilities.join("; ") : "Yo'q"]] as [string, string][])
      : []),
    ...(driver.route ? ([["Yo'nalish", driver.route]] as [string, string][]) : []),
  ];

  return (
    <>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{stats}</div>
      <div className="grid gap-4 xl:grid-cols-2">
        {driver.documents && <Documents docs={driver.documents} />}
        <Card className="flex flex-col gap-2">
          <CardTitle>Mashina va imkoniyatlar</CardTitle>
          <dl className="flex flex-col">
            {carRows.map(([k, v], i) => (
              <div key={k} className={cn("flex min-h-[42px] items-center justify-between gap-3", i < carRows.length - 1 && "border-b border-line")}>
                <dt className="text-sm font-semibold text-muted">{k}</dt>
                <dd className="text-right text-sm font-extrabold text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
      {driver.recentTrips && (
        <Card className="flex min-w-0 flex-col gap-4">
          <CardTitle
            right={
              caps.driverTrips ? (
                <Link
                  to={`/drivers/${driver.id}/history`}
                  className="inline-flex h-11 items-center rounded-full bg-surface px-[18px] text-sm font-extrabold text-ink hover:bg-line"
                >
                  Butun tarix
                </Link>
              ) : undefined
            }
          >
            So'nggi safarlar
          </CardTitle>
          {driver.recentTrips.length === 0 ? (
            <p className="text-13 font-semibold text-muted">Hali safar yo'q.</p>
          ) : (
            <TripsTable rows={driver.recentTrips} compact onOpen={onOpenOrder} />
          )}
        </Card>
      )}
    </>
  );
}

const DOC_STATUS: Record<DriverDocument["status"], { label: string; tone: "success" | "info" | "danger" }> = {
  verified: { label: "Tasdiqlangan", tone: "success" },
  checking: { label: "Tekshirilmoqda", tone: "info" },
  rejected: { label: "Rad etilgan", tone: "danger" },
};

function Documents({ docs }: { docs: DriverDocument[] }) {
  return (
    <Card className="flex flex-col gap-2">
      <CardTitle right={<Badge tone="info">Avtomatik tekshiruv</Badge>}>Hujjatlar</CardTitle>
      <ul className="flex flex-col">
        {docs.map((d, i) => (
          <li key={d.title} className={cn("flex min-h-[52px] items-center gap-3 py-1.5", i < docs.length - 1 && "border-b border-line")}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-nav bg-green-soft text-green-text">
              <FileCheck2 className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-bold text-ink">{d.title}</span>
              <span className="truncate text-xs font-semibold text-muted">{d.detail}</span>
            </span>
            <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
