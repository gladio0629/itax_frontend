import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Pencil, Plus, RotateCcw, Trash2, UsersRound } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Drawer } from "@/components/Drawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ROLE_LABEL } from "@/components/Topbar";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AdminRole, AdminUser } from "@/api/types";

type FormState = { name: string; email: string; phone: string; role: AdminRole | "" };
const EMPTY_FORM: FormState = { name: "", email: "", phone: "", role: "" };

type Confirm = { type: "block" | "unblock" | "archive" | "restore"; user: AdminUser };

export function StaffScreen() {
  const { me } = usePermissions();
  const [staff, setStaff] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [drawer, setDrawer] = useState<"create" | AdminUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    setError(false);
    try {
      setStaff(await api.getStaff());
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawer("create");
  }
  function openEdit(u: AdminUser) {
    setForm({ name: u.name, email: u.email, phone: u.phone, role: u.role });
    setFormError(null);
    setDrawer(u);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.role) return;
    setSaving(true);
    setFormError(null);
    try {
      if (drawer === "create") {
        await api.createStaff({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role });
        setToast("Xodim qo'shildi");
      } else if (drawer) {
        await api.updateStaff(drawer.id, { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role });
        setToast("Xodim tahrirlandi");
      }
      setDrawer(null);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActing(true);
    try {
      const { type, user } = confirm;
      if (type === "block") await api.setStaffStatus(user.id, "blocked");
      if (type === "unblock") await api.setStaffStatus(user.id, "active");
      if (type === "archive") await api.archiveStaff(user.id);
      if (type === "restore") await api.restoreStaff(user.id);
      setToast(
        type === "block" ? "Xodim bloklandi" : type === "unblock" ? "Xodim blokdan chiqarildi" : type === "archive" ? "Xodim arxivlandi" : "Xodim tiklandi"
      );
      setConfirm(null);
      await load();
    } finally {
      setActing(false);
    }
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!staff || !me) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const rows = staff.filter((u) => (showArchived ? u.archived : !u.archived));
  const canCreate = me.creatableRoles.length > 0;

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Xodim",
      sortValue: (u) => u.name,
      width: "220px",
      render: (u) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar seed={u.avatarSeed} name={u.name} />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{u.name}</p>
            <p className="truncate text-xs text-ink/50">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: "phone", header: "Telefon", render: (u) => <span className="tabular">{u.phone}</span> },
    { key: "role", header: "Rol", render: (u) => <Badge tone="info">{ROLE_LABEL[u.role]}</Badge> },
    {
      key: "status",
      header: "Holat",
      render: (u) => (
        <Badge tone={u.archived ? "neutral" : u.status === "active" ? "accent" : "danger"}>
          {u.archived ? "Arxivlangan" : u.status === "active" ? "Faol" : "Bloklangan"}
        </Badge>
      ),
    },
    {
      key: "lastLogin",
      header: "Oxirgi kirish",
      sortValue: (u) => u.lastLoginAt ?? 0,
      render: (u) => <span className="text-xs text-ink/60">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</span>,
    },
    {
      key: "actions",
      header: "",
      width: "160px",
      render: (u) => {
        const editable = me.creatableRoles.includes(u.role) && u.id !== me.id;
        if (!editable) return null;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {!u.archived && (
              <button aria-label="Tahrirlash" onClick={() => openEdit(u)} className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {u.archived ? (
              <button aria-label="Tiklash" onClick={() => setConfirm({ type: "restore", user: u })} className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-accent">
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  aria-label={u.status === "active" ? "Bloklash" : "Blokdan chiqarish"}
                  onClick={() => setConfirm({ type: u.status === "active" ? "block" : "unblock", user: u })}
                  className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-warning"
                >
                  {u.status === "active" ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                </button>
                <button aria-label="Arxivlash" onClick={() => setConfirm({ type: "archive", user: u })} className="rounded-full p-1.5 text-ink/50 hover:bg-ink/5 hover:text-danger">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="relative space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setShowArchived((v) => !v)}
          className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition-colors", showArchived ? "bg-ink text-bg" : "bg-ink/5 text-ink/70")}
        >
          {showArchived ? "Arxivlanganlar" : "Faol xodimlar"}
        </button>
        <div className="flex items-center gap-2">
          <ExportButton
            section="staff"
            rows={rows}
            filenamePrefix="xodimlar"
            buildRow={(u) => ({ Ism: u.name, Email: u.email, Telefon: u.phone, Rol: ROLE_LABEL[u.role], Holat: u.status })}
          />
          {canCreate && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Qo'shish
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        searchFields={(u) => `${u.name} ${u.email} ${u.phone}`}
        searchPlaceholder="Ism, email yoki telefon..."
        emptyIcon={<UsersRound className="h-6 w-6" />}
        emptyTitle="Xodim topilmadi"
      />

      <Drawer open={drawer !== null} onClose={() => setDrawer(null)} title={drawer === "create" ? "Yangi xodim" : "Xodimni tahrirlash"}>
        <div className="space-y-4">
          <Input label="To'liq ism" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Telefon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+998 90 000 00 00" />
          <div>
            <label className="mb-2 block text-sm font-semibold text-ink/80">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminRole }))}
              className="h-11 w-full rounded-xl border border-border bg-card px-4 text-sm text-ink outline-none transition-colors focus:border-accent"
            >
              <option value="" disabled>
                Tanlang...
              </option>
              {me.creatableRoles.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          {formError && <p className="text-xs font-medium text-danger">{formError}</p>}
          <Button
            fullWidth
            loading={saving}
            disabled={!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.role}
            onClick={handleSave}
          >
            Saqlash
          </Button>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.type === "block"
            ? "Xodimni bloklash"
            : confirm?.type === "unblock"
              ? "Blokdan chiqarish"
              : confirm?.type === "archive"
                ? "Xodimni arxivlash"
                : "Xodimni tiklash"
        }
        description={
          confirm?.type === "archive"
            ? `${confirm.user.name} arxivlanadi. Keyinroq tiklashingiz mumkin.`
            : `${confirm?.user.name ?? ""} uchun amalni tasdiqlaysizmi?`
        }
        tone={confirm?.type === "block" || confirm?.type === "archive" ? "danger" : "accent"}
        loading={acting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
