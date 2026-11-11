import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "./Button";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";

/** CSV export, gated by the "export" action (superadmin/owner only — decided
 * server-side via Me.actions). Builds the file client-side from rows the
 * admin already fetched and is allowed to see; the adapter call only checks
 * the permission and records the audit entry. */
export function ExportButton<T>({
  section,
  rows,
  filenamePrefix,
  buildRow,
}: {
  section: string;
  rows: T[];
  filenamePrefix: string;
  buildRow: (row: T) => Record<string, string | number>;
}) {
  const { me } = usePermissions();
  const [busy, setBusy] = useState(false);

  if (!me?.actions.includes("export")) return null;

  async function handleExport() {
    setBusy(true);
    try {
      await api.recordExport(section);
      const objs = rows.map(buildRow);
      const headers = Object.keys(objs[0] ?? {});
      const csv = [headers.join(","), ...objs.map((o) => headers.map((h) => JSON.stringify(o[h] ?? "")).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenamePrefix}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" loading={busy} onClick={handleExport}>
      <Download className="h-4 w-4" aria-hidden /> Eksport
    </Button>
  );
}
