import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { api } from "@/api/client";
import { cn } from "@/lib/cn";
import type { AdminRole, AdminUser } from "@/api/types";

const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Super admin",
  ops: "Operatsiyalar",
  support: "Qo'llab-quvvatlash",
  finance: "Moliya",
};

const PERMISSIONS: { key: string; label: string; roles: AdminRole[] }[] = [
  { key: "drivers", label: "Haydovchilarni tasdiqlash", roles: ["superadmin", "ops"] },
  { key: "tariffs", label: "Tariflarni o'zgartirish", roles: ["superadmin", "finance"] },
  { key: "wallet", label: "Hamyon operatsiyalari", roles: ["superadmin", "finance"] },
  { key: "support", label: "Murojaatlarni hal qilish", roles: ["superadmin", "support", "ops"] },
  { key: "roles", label: "Rollarni boshqarish", roles: ["superadmin"] },
  { key: "audit", label: "Audit jurnalini ko'rish", roles: ["superadmin", "ops", "finance", "support"] },
];

export function RolesScreen() {
  const [admins, setAdmins] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      setAdmins(await api.getAdminUsers());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function handleRoleChange(id: string, role: AdminRole) {
    setBusyId(id);
    try {
      const updated = await api.updateAdminRole(id, role);
      setAdmins((prev) => prev?.map((a) => (a.id === id ? updated : a)) ?? null);
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!admins) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-3">
        <p className="text-sm font-semibold text-ink">Adminlar</p>
        {admins.map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink/5 p-3">
            <div className="flex items-center gap-3">
              <Avatar seed={a.avatarSeed} name={a.name} />
              <div>
                <p className="text-sm font-medium text-ink">{a.name}</p>
                <p className="text-xs text-ink/50">{a.email}</p>
              </div>
            </div>
            <select
              value={a.role}
              disabled={busyId === a.id}
              onChange={(e) => handleRoleChange(a.id, e.target.value as AdminRole)}
              className="h-9 rounded-xl border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent"
            >
              {(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
        ))}
      </Card>

      <Card>
        <p className="mb-4 text-sm font-semibold text-ink">Ruxsatlar matritsasi</p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-xs font-semibold uppercase text-ink/50">Ruxsat</th>
              {(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => (
                <th key={r} className="px-3 py-2 text-center text-xs font-semibold uppercase text-ink/50">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm) => (
              <tr key={perm.key} className="border-b border-border last:border-0">
                <td className="px-3 py-2.5 text-ink">{perm.label}</td>
                {(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => (
                  <td key={r} className="px-3 py-2.5 text-center">
                    <span className={cn("inline-block h-2 w-2 rounded-full", perm.roles.includes(r) ? "bg-accent" : "bg-ink/10")} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
