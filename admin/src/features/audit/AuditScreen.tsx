import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import { formatDateTime } from "@/lib/format";
import type { AuditAction, AuditEntry } from "@/api/types";

const ACTION_LABEL: Record<AuditAction, string> = {
  login: "Kirish",
  "2fa_verify": "2FA tasdiqlandi",
  driver_approve: "Haydovchi tasdiqlandi",
  driver_reject: "Haydovchi rad etildi",
  phone_reveal: "Telefon ko'rsatildi",
  tariff_propose: "Tarif taklif qilindi",
  tariff_second_approve: "Tarif tasdiqlandi (2-admin)",
  tariff_reject: "Tarif rad etildi",
  complaint_resolve: "Murojaat hal qilindi",
  complaint_dismiss: "Murojaat rad etildi",
  role_change: "Rol o'zgartirildi",
  wallet_adjust: "Hamyon tuzatildi",
};

export function AuditScreen() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    try {
      setEntries(await api.getAuditLog());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const columns: Column<AuditEntry>[] = [
    {
      key: "date",
      header: "Sana",
      sortValue: (e) => e.createdAt,
      render: (e) => <span className="text-xs text-ink/60">{formatDateTime(e.createdAt)}</span>,
    },
    { key: "actor", header: "Admin", sortValue: (e) => e.actorName, render: (e) => e.actorName },
    { key: "action", header: "Amal", render: (e) => <Badge tone="info">{ACTION_LABEL[e.action] ?? e.action}</Badge> },
    {
      key: "target",
      header: "Obyekt",
      render: (e) => (
        <span className="text-ink/70">
          {e.targetType}: {e.targetId}
        </span>
      ),
    },
    { key: "detail", header: "Tafsilot", render: (e) => <span className="text-ink/70">{e.detail}</span> },
  ];

  if (error) return <ErrorState onRetry={load} />;
  if (!entries) {
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
      rows={entries}
      rowKey={(e) => e.id}
      searchFields={(e) => `${e.actorName} ${e.detail} ${e.targetType} ${e.targetId}`}
      searchPlaceholder="Admin, amal yoki obyekt bo'yicha qidirish..."
      pageSize={15}
      emptyIcon={<History className="h-6 w-6" />}
      emptyTitle="Audit yozuvlari yo'q"
      emptyDescription="Hali hech qanday amal qayd etilmagan."
    />
  );
}
