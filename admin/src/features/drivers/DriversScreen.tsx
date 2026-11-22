import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, ExternalLink, Pencil, RotateCcw, Search, ShieldCheck, Trash2 } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { RowMenu } from "@/components/RowMenu";
import { InfoNote, LEVEL_LABEL } from "@/components/Cells";
import { useAdapterList } from "@/hooks/useAdapterList";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { DRIVER_STATUS, driverBadge, driverChipStatuses } from "./driverLabels";
import { DriversTable } from "./DriversTable";
import { useDriverActions } from "./useDriverActions";
import type { ArchivableStatusFilter, DriverLevel, DriverQuery, DriverStatus, ListCounts } from "@/api/types";

const caps = api.capabilities;

/** Drivers list (design Drivers). No manual approval: documents are checked
 * automatically (doc 2.3); admins block/unblock, edit, archive/restore. */
export function DriversScreen({ readOnly = false }: { readOnly?: boolean } = {}) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const [status, setStatus] = useState<ArchivableStatusFilter<DriverStatus>>("all");
  const [route, setRoute] = useState<string>("all");
  const [level, setLevel] = useState<DriverLevel | "all">("all");
  const filters = { search, route, level } satisfies Omit<DriverQuery, "status">;
  const { items: drivers, error, reload } = useAdapterList(api.getDrivers, { ...filters, status } as DriverQuery);
  const [counts, setCounts] = useState<ListCounts<DriverStatus | "archived"> | null>(null);
  const [routes, setRoutes] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (caps.driverRouteFilter) api.getDriverRoutes().then(setRoutes).catch(() => {});
  }, []);
  const countsKey = JSON.stringify(filters);
  useEffect(() => {
    if (!caps.driverCounts) return;
    let live = true;
    const t = setTimeout(() => api.getDriverCounts(filters).then((c) => live && setCounts(c)).catch(() => live && setCounts(null)), 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, tick]);

  const actions = useDriverActions(() => {
    reload();
    setTick((n) => n + 1);
  });

  const chips = [
    { key: "all" as const, label: "Hammasi", count: counts?.all },
    ...driverChipStatuses().map((s) => ({
      key: s,
      label: s === "archived" ? "Arxiv" : DRIVER_STATUS[s].label,
      count: counts ? (counts[s] ?? 0) : undefined,
    })),
  ];

  return (
    <>
      <PageHeader
        subtitle={readOnly ? "Faqat ko'rish" : "Ro'yxatdan o'tgan hamma haydovchilar"}
        title="Haydovchilar"
        actions={
          !readOnly && <ExportButton
            section="drivers"
            rows={drivers ?? []}
            filenamePrefix="haydovchilar"
            buildRow={(d) => ({
              Ism: d.name,
              Telefon: d.phone,
              Mashina: d.carModel,
              Raqam: d.plate,
              "Yo'nalish": d.route ?? "",
              Reyting: d.rating,
              Daraja: d.level ? LEVEL_LABEL[d.level] : "",
              Balans: d.walletBalance ?? "",
              Holat: driverBadge(d).label,
            })}
          />
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          className="w-[300px] max-w-full"
          label="Ism, telefon yoki davlat raqami"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" aria-hidden />}
        />
        <FilterChips label="Holat bo'yicha" items={chips} value={status} onChange={setStatus} />
        <span className="flex-1" />
        {caps.driverRouteFilter && routes.length > 0 && (
          <FilterSelect
            label="Yo'nalish"
            aria-label="Yo'nalish"
            value={route}
            onChange={setRoute}
            options={[{ value: "all", label: "Hammasi" }, ...routes.map((r) => ({ value: r, label: r }))]}
          />
        )}
        {caps.driverLevelFilter && (
          <FilterSelect
            label="Daraja"
            aria-label="Daraja"
            value={level}
            onChange={setLevel}
            options={[
              { value: "all", label: "Hammasi" },
              ...(Object.keys(LEVEL_LABEL) as DriverLevel[]).map((l) => ({ value: l, label: LEVEL_LABEL[l] })),
            ]}
          />
        )}
      </div>

      {!readOnly && <InfoNote icon={<ShieldCheck className="h-[18px] w-[18px]" aria-hidden />}>
        Hujjatlar davlat tizimi orqali <b className="text-ink">avtomatik</b> tekshiriladi. Qo'lda tasdiqlash yo'q: siz faqat bloklash yoki blokdan
        chiqarishingiz mumkin.
      </InfoNote>}

      {error && drivers && <StaleNotice onRetry={reload} />}
      {error && !drivers ? (
        <ErrorState onRetry={reload} />
      ) : !drivers ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DriversTable
          rows={drivers}
          showBalance={!readOnly}
          total={status === "all" ? counts?.all : counts?.[status]}
          onOpen={readOnly ? undefined : (d) => navigate(`/drivers/${d.id}`)}
          actions={readOnly ? undefined : (d) => (
            <RowMenu
              label={`${d.name}: amallar`}
              items={[
                { label: "Profilni ochish", icon: <ExternalLink />, onSelect: () => navigate(`/drivers/${d.id}`) },
                { label: "Tahrirlash", icon: <Pencil />, onSelect: () => actions.edit(d), hidden: d.archived },
                { label: "Bloklash", icon: <Ban />, tone: "danger", onSelect: () => actions.ask("block", d), hidden: d.archived || d.status === "blocked" },
                { label: "Blokdan chiqarish", icon: <CheckCircle2 />, onSelect: () => actions.ask("unblock", d), hidden: d.archived || d.status !== "blocked" },
                { label: "Arxivlash", icon: <Trash2 />, tone: "danger", onSelect: () => actions.ask("archive", d), hidden: d.archived },
                { label: "Tiklash", icon: <RotateCcw />, onSelect: () => actions.ask("restore", d), hidden: !d.archived },
              ]}
            />
          )}
        />
      )}
      {actions.elements}
    </>
  );
}
