import { useEffect, useState } from "react";
import { Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Plus, Scale, Search, Wallet, X } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { StatTile } from "@/components/Card";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { RowMenu } from "@/components/RowMenu";
import { Toast } from "@/components/Toast";
import { InfoNote } from "@/components/Cells";
import { useAdapterList } from "@/hooks/useAdapterList";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { formatCompactSom, formatNumber, formatShortDateTime, formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LEDGER_CHIP_ORDER, LEDGER_KIND, LedgerKindCell, entryNo } from "./ledgerLabels";
import { LedgerFixDialog } from "./LedgerFixDialog";
import type { LedgerSummary, ListPeriod, WalletEntryType, WalletLedgerRow, WalletQuery } from "@/api/types";

const caps = api.capabilities;
const PERIODS: { value: ListPeriod; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
];

/** Hamyon daftari (design Ledger): read-only. Entries are never edited or
 * deleted; a mistake gets a correction entry (/wallet/fix). */
export function LedgerScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const driverId = params.get("driver") ?? undefined;
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const [type, setType] = useState<WalletEntryType | "all">("all");
  const [period, setPeriod] = useState<ListPeriod>("all");
  const query: WalletQuery = caps.walletLedgerFilters ? { search, type, period, driverId } : { driverId };
  const { items: rows, error, reload } = useAdapterList(api.getWalletLedger, query);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!caps.ledgerSummary) return;
    let live = true;
    api
      .getLedgerSummary()
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [tick]);

  const driverName = driverId ? rows?.find((r) => r.driverId === driverId && caps.walletDriverName)?.driverName : undefined;
  const fixPath = (r?: WalletLedgerRow) => {
    const next = new URLSearchParams(params);
    next.delete("entry");
    const d = r?.driverId || driverId;
    if (d) next.set("driver", d);
    if (r) next.set("entry", r.id);
    return { pathname: "/wallet/fix", search: next.toString() };
  };

  const chips = [
    { key: "all" as const, label: "Hammasi" },
    ...LEDGER_CHIP_ORDER.filter((k) => caps.walletKinds.includes(k)).map((k) => ({ key: k, label: LEDGER_KIND[k].label })),
  ];

  const columns: Column<WalletLedgerRow>[] = [
    { key: "id", header: "ID", render: (r) => <span className="font-bold">{entryNo(r.id)}</span> },
    { key: "at", header: "Vaqt", sortValue: (r) => r.createdAt, render: (r) => formatShortDateTime(r.createdAt) },
    {
      key: "driver",
      header: caps.walletDriverName ? "Haydovchi" : "Hamyon",
      sortValue: (r) => r.driverName,
      render: (r) => r.driverName,
    },
    { key: "kind", header: "Tur", render: (r) => <LedgerKindCell kind={r.type} /> },
    {
      key: "note",
      header: "Izoh",
      truncate: { maxWidth: 280, title: (r) => r.note ?? r.reason ?? "" },
      render: (r) => r.note ?? r.reason ?? "—",
    },
    {
      key: "amount",
      header: "Summa",
      align: "right",
      sortValue: (r) => r.amount,
      render: (r) => (
        <span className={cn("font-extrabold", r.amount > 0 ? "text-green-text" : "text-ink")}>
          {r.amount > 0 ? "+" : ""}
          {formatNumber(r.amount)}
        </span>
      ),
    },
    { key: "balance", header: "Balans", align: "right", render: (r) => formatNumber(r.balanceAfter) },
    { key: "state", header: "Holat", render: () => <Badge tone="success">Yozildi</Badge> },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (r) => (
        <RowMenu
          label={`${entryNo(r.id)}: amallar`}
          items={[{ label: "Tuzatish yozuvi", icon: <Scale />, onSelect: () => navigate(fixPath(r)), hidden: !r.driverId }]}
        />
      ),
    },
  ];

  const topup = summary?.toppedUpToday != null ? formatCompactSom(summary.toppedUpToday) : null;
  const commission = summary?.commissionToday != null ? formatCompactSom(summary.commissionToday) : null;

  return (
    <>
      <PageHeader
        subtitle="Haydovchilar hamyoni daftari"
        title="Hamyon va to'lovlar"
        actions={
          <>
            <ExportButton
              section="wallet"
              rows={rows ?? []}
              filenamePrefix="hamyon_daftari"
              buildRow={(r) => ({
                ID: r.id,
                Vaqt: new Date(r.createdAt).toISOString(),
                Haydovchi: r.driverName,
                Tur: LEDGER_KIND[r.type].label,
                Izoh: r.note ?? r.reason ?? "",
                Summa: r.amount,
                Balans: r.balanceAfter,
              })}
            />
            <Button onClick={() => navigate(fixPath())}>
              <Plus className="h-4 w-4" aria-hidden /> Tuzatish yozuvi
            </Button>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {topup && (
            <StatTile
              label="Bugun to'ldirildi"
              value={topup.value}
              unit={topup.unit ?? "so'm"}
              delta={summary.topupSplit ? { text: summary.topupSplit, direction: "flat" } : null}
            />
          )}
          {commission && (
            <StatTile
              label="Komissiya yechildi"
              value={commission.value}
              unit={commission.unit ?? "so'm"}
              delta={summary.commissionTrips != null ? { text: `${formatNumber(summary.commissionTrips)} ta safardan`, direction: "flat" } : null}
            />
          )}
          {summary.driversAtLimit != null && (
            <StatTile
              label="Qarz chegarasida"
              value={formatNumber(summary.driversAtLimit)}
              unit="haydovchi"
              delta={{ text: "Yangi so'rovlar to'xtatilgan", direction: "flat" }}
            />
          )}
          {summary.reconciliation && (
            <StatTile
              label="To'lov solishtiruv"
              value={`${summary.reconciliation.matchPct}%`}
              unit="mos"
              delta={{ text: `Provayder bilan, ${formatTime(summary.reconciliation.at)} da`, direction: "flat" }}
            />
          )}
        </div>
      )}

      <InfoNote icon={<Lock className="h-[18px] w-[18px]" aria-hidden />}>
        Daftar <b className="text-ink">o'zgarmaydi</b>: yozuvni tahrirlab yoki o'chirib bo'lmaydi. Xato bo'lsa, sababi bilan tuzatish yozuvi qo'shiladi: kim
        qo'shgani audit jurnalida ko'rinadi.
      </InfoNote>

      <div className="flex flex-wrap items-center gap-2.5">
        {caps.walletLedgerFilters && (
          <SearchInput
            className="w-[300px] max-w-full"
            label="ID, haydovchi yoki izoh"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
        )}
        {caps.walletLedgerFilters && <FilterChips label="Yozuv turi" items={chips} value={type} onChange={setType} />}
        {driverId && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("driver");
              setParams(next, { replace: true });
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-3.5 text-13 font-bold text-white"
            aria-label="Haydovchi filtrini olib tashlash"
          >
            {driverName ?? "Bitta haydovchi"} <X className="h-4 w-4" aria-hidden />
          </button>
        )}
        <span className="flex-1" />
        {caps.walletLedgerFilters && <FilterSelect label="Sana" aria-label="Sana" value={period} onChange={setPeriod} options={PERIODS} />}
      </div>

      {error && rows && <StaleNotice onRetry={reload} />}
      {error && !rows ? (
        <ErrorState onRetry={reload} />
      ) : !rows ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          rowClassName={(r) => (r.type === "adjustment" ? "bg-row-highlight" : undefined)}
          emptyIcon={<Wallet />}
          emptyTitle="Yozuv topilmadi"
          emptyDescription="Filtrlarni o'zgartirib ko'ring."
        />
      )}

      <Routes>
        <Route
          path="fix"
          element={
            <LedgerFixDialog
              onDone={(message) => {
                setToast(message);
                reload();
                setTick((n) => n + 1);
              }}
            />
          }
        />
      </Routes>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
