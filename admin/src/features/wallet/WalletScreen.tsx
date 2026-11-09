import { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import { formatDateTime, formatSom } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { WalletEntryType, WalletLedgerRow } from "@/api/types";

const TYPE_LABEL: Record<WalletEntryType, string> = {
  cash: "Naqd to'lov",
  card: "Karta to'lovi",
  commission: "Komissiya",
  topup: "Hamyon to'ldirish",
};
const TYPE_TONE: Record<WalletEntryType, "accent" | "info" | "danger"> = {
  cash: "accent",
  card: "info",
  commission: "danger",
  topup: "accent",
};

export function WalletScreen() {
  const [rows, setRows] = useState<WalletLedgerRow[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      setRows(await api.getWalletLedger());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const columns: Column<WalletLedgerRow>[] = [
    { key: "driver", header: "Haydovchi", sortValue: (r) => r.driverName, render: (r) => r.driverName },
    { key: "type", header: "Turi", render: (r) => <Badge tone={TYPE_TONE[r.type]}>{TYPE_LABEL[r.type]}</Badge> },
    {
      key: "amount",
      header: "Summa",
      sortValue: (r) => r.amount,
      render: (r) => (
        <span className={cn("tabular font-medium", r.amount < 0 ? "text-danger" : "text-ink")}>
          {r.amount > 0 ? "+" : ""}
          {formatSom(r.amount)}
        </span>
      ),
    },
    { key: "balance", header: "Qoldiq", sortValue: (r) => r.balanceAfter, render: (r) => <span className="tabular">{formatSom(r.balanceAfter)}</span> },
    {
      key: "date",
      header: "Sana",
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="text-xs text-ink/60">{formatDateTime(r.createdAt)}</span>,
    },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!rows) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      searchFields={(r) => r.driverName}
      searchPlaceholder="Haydovchi bo'yicha qidirish..."
      pageSize={15}
      emptyIcon={<Wallet className="h-6 w-6" />}
      emptyTitle="Yozuvlar topilmadi"
    />
  );
}
