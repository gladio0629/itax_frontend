import { useState } from "react";
import { Ban, CheckCircle2, Pencil, Plus, RotateCcw, Trash2, UsersRound } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { FormDrawer } from "@/components/FormDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { ROLE_LABEL } from "@/lib/roles";
import { api } from "@/api/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAdapterList } from "@/hooks/useAdapterList";
import { formatDateTime } from "@/lib/format";
import type { AdminRole, AdminUser, ArchivableStatusFilter, StaffQuery, StaffRow, StaffStatus } from "@/api/types";

type FormState = { name: string; email: string; phone: string; role: AdminRole | "" };
const EMPTY_FORM: FormState = { name: "", email: "", phone: "", role: "" };

type Confirm = { type: "block" | "unblock" | "archive" | "restore"; user: AdminUser };

const caps = api.capabilities;

const STATUS_OPTIONS: { value: ArchivableStatusFilter<StaffStatus>; label: string }[] = [
  { value: "all", label: "Barchasi" },
  { value: "active", label: "Faol" },
  { value: "blocked", label: "Bloklangan" },
  { value: "archived", label: "Arxivlangan" },
];

export function StaffScreen() {
  const { me } = usePermissions();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<AdminRole | "all">("all");
  const [status, setStatus] = useState<ArchivableStatusFilter<StaffStatus>>("all");
  const query: StaffQuery = { search, role, status };
  const { items: staff, error, reload } = useAdapterList(api.getStaff, query);

  const [drawer, setDrawer] = useState<"create" | StaffRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setDrawer("create");
  }
  function openEdit(u: StaffRow) {
    setForm({ name: u.name, email: u.email, phone: u.phone, role: u.role });
    setFormError(null);
    setDrawer(u);
  }

  const emailRequired = form.role !== "operator";

  async function handleSave() {
    if (!form.name.trim() || !form.phone.trim() || !form.role) return;
    if (emailRequired && !form.email.trim()) return;
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
      reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  }

  function openConfirm(c: Confirm) {
    setConfirmError(null);
    setConfirm(c);
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActing(true);
    setConfirmError(null);
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
      reload();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : "Xatolik yuz berdi");
    } finally {
      setActing(false);
    }
  }

  if (error) return <ErrorState onRetry={reload} />;
  if (!staff || !me) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const canCreate = me.creatableRoles.length > 0;
  const hasActiveFilters = role !== "all" || status !== "all";

  const columns: Column<StaffRow>[] = [
    {
      key: "name",
      header: "Xodim",
      sortValue: (u) => u.name,
      width: "220px",
      render: (u) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar seed={u.avatarSeed} name={u.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{u.name}</p>
            <p className="truncate text-xs text-ink/50">{u.email || u.phone}</p>
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
        <Badge tone={u.archived ? "neutral" : u.status === "active" ? "success" : "danger"}>
          {u.archived ? "Arxivlangan" : u.status === "active" ? "Faol" : "Bloklangan"}
        </Badge>
      ),
    },
    ...(caps.staffLastLogin
      ? [
          {
            key: "lastLogin",
            header: "Oxirgi kirish",
            sortValue: (u: StaffRow) => u.lastLoginAt ?? 0,
            render: (u: StaffRow) => <span className="text-ink/60">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "—"}</span>,
          } as Column<StaffRow>,
        ]
      : []),
    {
      key: "actions",
      header: "",
      width: "160px",
      render: (u) => {
        if (!u.canEdit) return null;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {!u.archived && (
              <button type="button" aria-label="Tahrirlash" onClick={() => openEdit(u)} className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-ink">
                <Pencil className="h-4 w-4" />
              </button>
            )}
            {u.archived ? (
              caps.restoreStaff && (
                <button type="button" aria-label="Tiklash" onClick={() => openConfirm({ type: "restore", user: u })} className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-accent">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )
            ) : (
              <>
                <button type="button"
                  aria-label={u.status === "active" ? "Bloklash" : "Blokdan chiqarish"}
                  onClick={() => openConfirm({ type: u.status === "active" ? "block" : "unblock", user: u })}
                  className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-warning"
                >
                  {u.status === "active" ? <Ban className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </button>
                <button type="button" aria-label="Arxivlash" onClick={() => openConfirm({ type: "archive", user: u })} className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-danger">
                  <Trash2 className="h-4 w-4" />
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ism, email yoki telefon…"
          searchEnabled={caps.staffSearch}
          resultCount={staff.length}
          hasActiveFilters={hasActiveFilters}
          onClear={() => {
            setRole("all");
            setStatus("all");
          }}
        >
          <FilterSelect
            value={role}
            onChange={setRole}
            options={[{ value: "all", label: "Barcha rollar" }, ...(Object.keys(ROLE_LABEL) as AdminRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))]}
            aria-label="Rol bo'yicha filtr"
          />
          {caps.staffStatusFilter && <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Holat bo'yicha filtr" />}
        </ListToolbar>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton
            section="staff"
            rows={staff}
            filenamePrefix="xodimlar"
            buildRow={(u) => ({ Ism: u.name, Email: u.email, Telefon: u.phone, Rol: ROLE_LABEL[u.role], Holat: u.status })}
          />
          {canCreate && (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" /> Qo'shish
            </Button>
          )}
        </div>
      </div>

      <DataTable
        key={`${search}-${role}-${status}`}
        columns={columns}
        rows={staff}
        rowKey={(u) => u.id}
        emptyIcon={<UsersRound className="h-6 w-6" />}
        emptyTitle="Xodim topilmadi"
        emptyDescription="Qidiruv yoki filtrlarga mos xodim yo'q."
      />

      <FormDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer === "create" ? "Yangi xodim" : "Xodimni tahrirlash"}
        onSubmit={handleSave}
        loading={saving}
        error={formError}
        disabled={!form.name.trim() || !form.phone.trim() || !form.role || (emailRequired && !form.email.trim())}
      >
        <Input label="To'liq ism" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        <Input
          label="Telefon"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="+998 90 000 00 00"
          hint="Xodim telefon raqamini sizga aytadi — hisob shu raqam bilan yaratiladi."
        />
        <div>
          <label htmlFor="fld-rol" className="mb-2 block text-sm font-semibold text-ink/80">Rol<span className="ml-1 text-danger" aria-hidden>
            *
          </span></label>
          <select id="fld-rol"
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminRole }))}
            className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
          >
            <option value="" disabled>
              Tanlang…
            </option>
            {me.creatableRoles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label={emailRequired ? "Email" : "Email (ixtiyoriy)"}
          required={emailRequired}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          // The real API can't change an email after creation.
          disabled={drawer !== "create" && !caps.staffEmailEdit}
          hint={
            drawer !== "create" && !caps.staffEmailEdit
              ? "Emailni yaratilgandan keyin o'zgartirib bo'lmaydi."
              : !emailRequired
                ? "Operatorlar faqat telefon SMS kodi bilan kiradi — email shart emas."
                : undefined
          }
        />
      </FormDrawer>

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
            ? `${confirm.user.name} arxivlanadi.${caps.restoreStaff ? " Keyinroq tiklashingiz mumkin." : ""}`
            : `${confirm?.user.name ?? ""} uchun amalni tasdiqlaysizmi?`
        }
        tone={confirm?.type === "block" || confirm?.type === "archive" ? "danger" : "accent"}
        error={confirmError}
        loading={acting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
