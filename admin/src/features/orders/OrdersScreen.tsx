import { useEffect, useState } from "react";
import { Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Ban, ChevronRight, ExternalLink, Pencil, Plus, Route as RouteIcon, Search, X } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { RowMenu } from "@/components/RowMenu";
import { KindLine, PersonCell, RouteText } from "@/components/Cells";
import { useAdapterList } from "@/hooks/useAdapterList";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { overlayFromList } from "@/hooks/useCloseOverlay";
import { formatNumber, formatShortDateTime } from "@/lib/format";
import { KIND_LABEL, ORDER_STATUS, PAYMENT_LABEL, orderNo } from "./labels";
import { OrderDetailPanel } from "./OrderDetailPanel";
import { OrderCreateDrawer } from "./OrderForms";
import type { ListCounts, ListPeriod, OrderKind, OrderQuery, OrderStatus, OrderWithNames } from "@/api/types";

const caps = api.capabilities;

/** Chip order of the design first, then any other status this backend
 * filters by. One chip = one server status value. */
const CHIP_ORDER: OrderStatus[] = ["searching", "accepted", "arrived", "in_progress", "completed", "cancelled", "no_driver", "expired"];
const CHIP_LABEL: Partial<Record<OrderStatus, string>> = { cancelled: "Bekor" };
const PERIODS: { value: ListPeriod; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
];

/** Orders list (design Orders) with the detail panel as a nested route. */
/** `readOnly`: the operator's "Buyurtmalar" window (no row menu, no export,
 * no admin detail panel), rendered under the operator page's own header.
 * `onOpen`: where a row leads in that window (the operator order page). */
export function OrdersScreen({ readOnly = false, onOpen }: { readOnly?: boolean; onOpen?: (o: OrderWithNames) => void } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [kind, setKind] = useState<OrderKind | "all">("all");
  const [period, setPeriod] = useState<ListPeriod>("all");
  // "Buyurtmalari" from a passenger: ?passenger=<id> (server filter).
  const [params, setParams] = useSearchParams();
  const passengerId = params.get("passenger") ?? undefined;
  const filters = { search, kind, period, passengerId } satisfies Omit<OrderQuery, "status">;
  const { items: orders, error, reload } = useAdapterList(api.getOrders, { ...filters, status } as OrderQuery);
  const [counts, setCounts] = useState<ListCounts<OrderStatus> | null>(null);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const countsKey = JSON.stringify(filters);
  const [countsTick, setCountsTick] = useState(0);
  useEffect(() => {
    if (!caps.orderCounts) return;
    let live = true;
    const t = setTimeout(() => {
      api
        .getOrderCounts(filters)
        .then((c) => live && setCounts(c))
        .catch(() => live && setCounts(null));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, countsTick]);

  const refresh = () => {
    reload();
    setCountsTick((n) => n + 1);
  };

  // Keep the list's own params (e.g. ?passenger=) when opening a row.
  const open = (o: OrderWithNames, extra?: "edit" | "cancel") => {
    const next = new URLSearchParams(params);
    if (extra) next.set(extra, "1");
    navigate({ pathname: `/orders/${o.id}`, search: next.toString() }, { state: overlayFromList(params) });
  };
  const selectedId = location.pathname.split("/")[2];

  const chipStatuses = CHIP_ORDER.filter((s) => caps.orderStatuses.includes(s));
  const chips = [
    { key: "all" as const, label: "Hammasi", count: counts?.all },
    ...chipStatuses.map((s) => ({ key: s, label: CHIP_LABEL[s] ?? ORDER_STATUS[s].label, count: counts ? (counts[s] ?? 0) : undefined })),
  ];

  const columns: Column<OrderWithNames>[] = [
    {
      key: "id",
      header: "ID",
      sortValue: (o) => o.createdAt,
      render: (o) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-extrabold">{orderNo(o.id)}</span>
          <KindLine kind={o.kind} />
        </span>
      ),
    },
    { key: "route", header: "Yo'nalish", render: (o) => <RouteText from={o.fromCityName} to={o.toCityName} /> },
    ...(caps.orderPassenger
      ? [
          {
            key: "passenger",
            header: "Yo'lovchi",
            sortValue: (o: OrderWithNames) => o.passengerName,
            render: (o: OrderWithNames) => <PersonCell name={o.passengerName} sub={o.passengerPhone ?? undefined} />,
          } satisfies Column<OrderWithNames>,
        ]
      : []),
    { key: "driver", header: "Haydovchi", sortValue: (o) => o.driverName ?? "", render: (o) => o.driverName ?? "—" },
    {
      key: "time",
      header: "Vaqt",
      sortValue: (o) => o.scheduledAt ?? o.scheduledRange?.from ?? o.createdAt,
      render: (o) => formatShortDateTime(o.scheduledAt ?? o.scheduledRange?.from ?? o.createdAt),
    },
    { key: "price", header: "Narx", align: "right", sortValue: (o) => o.price, render: (o) => formatNumber(o.price) },
    { key: "status", header: "Holat", render: (o) => <Badge tone={ORDER_STATUS[o.status].tone}>{ORDER_STATUS[o.status].label}</Badge> },
    ...(readOnly && onOpen
      ? [
          {
            key: "open",
            header: "",
            width: "56px",
            render: () => (
              <span className="flex justify-end text-muted" aria-hidden>
                <ChevronRight className="h-[18px] w-[18px]" />
              </span>
            ),
          } satisfies Column<OrderWithNames>,
        ]
      : []),
    ...(readOnly ? [] : [{
      key: "actions",
      header: "",
      width: "56px",
      render: (o: OrderWithNames) => (
        <RowMenu
          label={`Buyurtma ${orderNo(o.id)}: amallar`}
          items={[
            { label: "Ochish", icon: <ExternalLink />, onSelect: () => open(o) },
            { label: "Tahrirlash", icon: <Pencil />, onSelect: () => open(o, "edit"), hidden: !caps.orderEdit },
            { label: "Bekor qilish", icon: <Ban />, tone: "danger", onSelect: () => open(o, "cancel"), hidden: !o.canCancel },
          ]}
        />
      ),
    } satisfies Column<OrderWithNames>]),
  ];

  return (
    <>
      {!readOnly && <PageHeader
        back={passengerId ? "/passengers" : undefined}
        subtitle="Hamma buyurtmalar"
        title="Buyurtmalar"
        actions={
          <>
            <ExportButton
              section="orders"
              rows={orders ?? []}
              filenamePrefix="buyurtmalar"
              buildRow={(o) => ({
                ID: o.id,
                Tur: KIND_LABEL[o.kind],
                Qayerdan: o.fromCityName,
                Qayerga: o.toCityName,
                "Yo'lovchi": o.passengerName,
                Telefon: o.passengerPhone ?? "",
                Haydovchi: o.driverName ?? "",
                Narx: o.price,
                "To'lov": PAYMENT_LABEL[o.paymentMethod],
                Holat: ORDER_STATUS[o.status].label,
                Sana: new Date(o.createdAt).toISOString(),
              })}
            />
            {caps.orderCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" aria-hidden /> Yangi buyurtma
              </Button>
            )}
          </>
        }
      />}

      <div className="flex flex-wrap items-center gap-2.5">
        {caps.orderSearch && (
          <SearchInput
            className="w-[300px] max-w-full"
            label="ID, telefon yoki ism"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
        )}
        <FilterChips label="Holat bo'yicha" items={chips} value={status} onChange={setStatus} />
        {passengerId && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("passenger");
              setParams(next, { replace: true });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-3.5 text-13 font-bold text-white"
            aria-label="Yo'lovchi filtrini olib tashlash"
          >
            Bitta yo'lovchi <X className="h-4 w-4" aria-hidden />
          </button>
        )}
        <span className="flex-1" />
        {caps.orderKindFilter && (
          <FilterSelect
            label="Tur"
            aria-label="Buyurtma turi"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Hammasi" },
              { value: "passenger", label: "Yo'lovchi" },
              { value: "delivery", label: "Dostavka" },
            ]}
          />
        )}
        {caps.orderDateFilter && <FilterSelect label="Sana" aria-label="Sana" value={period} onChange={setPeriod} options={PERIODS} />}
      </div>

      {error && orders && <StaleNotice onRetry={reload} />}
      {error && !orders ? (
        <ErrorState onRetry={reload} />
      ) : !orders ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={orders}
          rowKey={(o) => o.id}
          onRowClick={readOnly ? onOpen : (o) => open(o)}
          rowClassName={(o) => (o.id === selectedId ? "bg-row-hover" : undefined)}
          total={status === "all" ? counts?.all : counts?.[status as OrderStatus]}
          emptyIcon={<RouteIcon />}
          emptyTitle="Buyurtma topilmadi"
          emptyDescription="Filtrlarni o'zgartirib ko'ring."
        />
      )}

      {!readOnly && (
        <Routes>
          <Route path=":orderId" element={<OrderDetailPanel onChanged={refresh} />} />
        </Routes>
      )}

      {caps.orderCreate && !readOnly && (
        <OrderCreateDrawer
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(o) => {
            setCreating(false);
            setToast("Buyurtma yaratildi");
            refresh();
            open(o);
          }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
