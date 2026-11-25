import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, Pencil, Plus, RotateCcw, Search, Trash2, UsersRound } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card, CardTitle } from "@/components/Card";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { SearchInput } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { RowMenu } from "@/components/RowMenu";
import { PersonCell } from "@/components/Cells";
import { ROLE_LABEL } from "@/lib/roles";
import { usePermissions } from "@/hooks/usePermissions";
import { useAdapterList } from "@/hooks/useAdapterList";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { formatAgo } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { AdminRole, ArchivableStatusFilter, ListCounts, StaffQuery, StaffRow, StaffStatus } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");
const ROLES: AdminRole[] = ["superadmin", "owner", "menejer", "marketolog", "operator"];

/** Display copy for the "Rollar va huquqlar" card and the role picker
 * (design Staff / StaffAdd). What a role may do is the server's. */
const ROLE_RIGHTS: Record<AdminRole, string> = {
  superadmin: "Hamma bo'lim, hamma rolni yaratadi",
  owner: "Hamma bo'lim; menejer, marketolog, operator yaratadi",
  menejer: "Hamma bo'lim; marketolog, operator yaratadi",
  marketolog: "Faqat umumiy statistika, faqat ko'rish",
  operator: "Navbat; Tarix va Haydovchilar faqat ko'rish",
};
const ROLE_PICK_HINT: Record<AdminRole, string> = {
  superadmin: "Hamma bo'lim va rollar",
  owner: "Hamma bo'lim, xodimlar",
  menejer: "Hamma bo'lim va statistika",
  marketolog: "Faqat statistika, ko'rish",
  operator: "Navbat, Tarix va Haydovchilar (ko'rish), SMS bilan kirish",
};
const STATUS_OPTIONS: { value: ArchivableStatusFilter<StaffStatus>; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "active", label: "Faol" },
  { value: "blocked", label: "Bloklangan" },
  { value: "archived", label: "Arxiv" },
];

type FormState = { name: string; email: string; phone: string; role: AdminRole | "" };
const EMPTY_FORM: FormState = { name: "", email: "", phone: "", role: "" };
type Confirm = { type: "block" | "unblock" | "archive" | "restore"; user: StaffRow };

const statusBadge = (u: StaffRow) =>
  u.archived ? { tone: "neutral" as const, label: "Arxivda" } : u.status === "active" ? { tone: "success" as const, label: "Faol" } : { tone: "danger" as const, label: "Bloklangan" };

/** Xodimlar (design Staff). "Xodim qo'shish" opens at /staff/new. */
export function StaffScreen() {
  const { me } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const [role, setRole] = useState<AdminRole | "all">("all");
  const [status, setStatus] = useState<ArchivableStatusFilter<StaffStatus>>("all");
  const query: StaffQuery = { search, role, status };
  const { items: staff, error, reload } = useAdapterList(api.getStaff, query);
  const [counts, setCounts] = useState<ListCounts<AdminRole> | null>(null);
  const [tick, setTick] = useState(0);

  const [editing, setEditing] = useState<StaffRow | null>(null);
  const creating = location.pathname.replace(/\/$/, "") === "/staff/new";
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const countsKey = JSON.stringify({ search, status });
  useEffect(() => {
    if (!caps.staffCounts) return;
    let live = true;
    const t = setTimeout(
      () =>
        api
          .getStaffCounts({ search, status })
          .then((c) => live && setCounts(c))
          .catch(() => live && setCounts(null)),
      300
    );
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countsKey, tick]);

  const refresh = () => {
    reload();
    setTick((n) => n + 1);
  };
  const canCreate = (me?.creatableRoles.length ?? 0) > 0;
  const closeForm = () => (creating ? navigate("/staff", { replace: true }) : setEditing(null));

  function ask(type: Confirm["type"], user: StaffRow) {
    setConfirmError(null);
    setConfirm({ type, user });
  }
  async function runConfirm() {
    if (!confirm) return;
    setActing(true);
    setConfirmError(null);
    try {
      const { type, user } = confirm;
      if (type === "block") await api.setStaffStatus(user.id, "blocked");
      if (type === "unblock") await api.setStaffStatus(user.id, "active");
      if (type === "archive") await api.archiveStaff(user.id);
      if (type === "restore") await api.restoreStaff(user.id);
      setToast(type === "block" ? "Xodim bloklandi" : type === "unblock" ? "Xodim blokdan chiqarildi" : type === "archive" ? "Xodim arxivlandi" : "Xodim tiklandi");
      setConfirm(null);
      refresh();
    } catch (e) {
      setConfirmError(errorText(e));
    } finally {
      setActing(false);
    }
  }

  const chips = [
    { key: "all" as const, label: "Hammasi", count: counts?.all },
    ...ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r], count: counts ? (counts[r] ?? 0) : undefined })),
  ];

  const columns: Column<StaffRow>[] = [
    { key: "name", header: "Xodim", sortValue: (u) => u.name, render: (u) => <PersonCell name={u.name} sub={u.email || "—"} /> },
    { key: "role", header: "Rol", sortValue: (u) => ROLES.indexOf(u.role), render: (u) => <Badge tone="neutral">{ROLE_LABEL[u.role]}</Badge> },
    { key: "phone", header: "Telefon", render: (u) => <span className="tabular whitespace-nowrap">{u.phone}</span> },
    ...(rowsHaveLogin(staff)
      ? [
          {
            key: "login",
            header: "Kirish",
            render: (u: StaffRow) => (u.loginMethod === "email_sms" ? "Email + SMS" : u.loginMethod === "sms" ? "SMS" : "—"),
          } satisfies Column<StaffRow>,
        ]
      : []),
    ...(caps.staffLastLogin
      ? [
          {
            key: "lastLogin",
            header: "Oxirgi faollik",
            sortValue: (u: StaffRow) => u.lastLoginAt ?? 0,
            render: (u: StaffRow) => <span className="whitespace-nowrap text-muted">{u.lastLoginAt ? formatAgo(u.lastLoginAt) : "—"}</span>,
          } satisfies Column<StaffRow>,
        ]
      : []),
    { key: "status", header: "Holat", render: (u) => <Badge tone={statusBadge(u).tone}>{statusBadge(u).label}</Badge> },
    {
      key: "actions",
      header: "",
      width: "56px",
      render: (u) =>
        u.canEdit && (
          <RowMenu
            label={`${u.name}: amallar`}
            items={[
              { label: "Tahrirlash", icon: <Pencil />, onSelect: () => setEditing(u), hidden: u.archived },
              { label: "Bloklash", icon: <Ban />, tone: "danger", onSelect: () => ask("block", u), hidden: u.archived || u.status !== "active" },
              { label: "Blokdan chiqarish", icon: <CheckCircle2 />, onSelect: () => ask("unblock", u), hidden: u.archived || u.status === "active" },
              { label: "Arxivlash", icon: <Trash2 />, tone: "danger", onSelect: () => ask("archive", u), hidden: u.archived },
              { label: "Tiklash", icon: <RotateCcw />, onSelect: () => ask("restore", u), hidden: !u.archived || !caps.restoreStaff },
            ]}
          />
        ),
    },
  ];

  return (
    <>
      <PageHeader
        subtitle="Jamoa a'zolari va rollar"
        title="Xodimlar"
        actions={
          <>
            <ExportButton
              section="staff"
              rows={staff ?? []}
              filenamePrefix="xodimlar"
              buildRow={(u) => ({ Ism: u.name, Email: u.email, Telefon: u.phone, Rol: ROLE_LABEL[u.role], Holat: statusBadge(u).label })}
            />
            {canCreate && (
              <Button onClick={() => navigate("/staff/new")}>
                <Plus className="h-4 w-4" aria-hidden /> Xodim qo'shish
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        {caps.staffSearch && (
          <SearchInput
            className="w-[300px] max-w-full"
            label="Ism, email yoki telefon"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="h-4 w-4" aria-hidden />}
          />
        )}
        <FilterChips label="Rol bo'yicha" items={chips} value={role} onChange={setRole} />
        <span className="flex-1" />
        {caps.staffStatusFilter && <FilterSelect label="Holat" aria-label="Holat" value={status} onChange={setStatus} options={STATUS_OPTIONS} />}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {error && staff && <StaleNotice onRetry={reload} />}
          {error && !staff ? (
            <ErrorState onRetry={reload} />
          ) : !staff ? (
            <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={staff}
              rowKey={(u) => u.id}
              total={role === "all" ? counts?.all : counts?.[role]}
              emptyIcon={<UsersRound />}
              emptyTitle="Xodim topilmadi"
              emptyDescription="Qidiruv yoki filtrlarga mos xodim yo'q."
            />
          )}
        </div>
        <Card className="flex flex-col gap-3">
          <CardTitle>Rollar va huquqlar</CardTitle>
          <dl className="flex flex-col gap-3">
            {ROLES.map((r) => (
              <div key={r} className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-0 last:pb-0">
                <dt className="text-13 font-extrabold">{ROLE_LABEL[r]}</dt>
                <dd className="text-13 font-semibold leading-[19px] text-muted">{ROLE_RIGHTS[r]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      {me && (
        <StaffFormModal
          open={(creating && canCreate) || !!editing}
          user={creating ? null : editing}
          creatableRoles={me.creatableRoles}
          actorRole={me.role}
          onClose={closeForm}
          onSaved={(msg) => {
            setToast(msg);
            closeForm();
            refresh();
          }}
        />
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.type === "block" ? "Xodimni bloklash" : confirm?.type === "unblock" ? "Blokdan chiqarish" : confirm?.type === "archive" ? "Xodimni arxivlash" : "Xodimni tiklash"
        }
        description={
          confirm?.type === "archive"
            ? `${confirm.user.name} arxivlanadi.${caps.restoreStaff ? " Keyinroq tiklashingiz mumkin." : ""}`
            : `${confirm?.user.name ?? ""} uchun amalni tasdiqlaysizmi?`
        }
        tone={confirm?.type === "block" || confirm?.type === "archive" ? "danger" : "accent"}
        error={confirmError}
        loading={acting}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function rowsHaveLogin(rows: StaffRow[] | null) {
  return !!rows?.some((u) => u.loginMethod);
}

/** "Xodim qo'shish" / edit (design StaffAdd). Only roles from
 * Me.creatableRoles can be picked; the server checks again. */
function StaffFormModal({
  open,
  user,
  creatableRoles,
  actorRole,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: StaffRow | null;
  creatableRoles: AdminRole[];
  actorRole: AdminRole;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(user ? { name: user.name, email: user.email, phone: user.phone, role: user.role } : EMPTY_FORM);
    setError(null);
  }, [open, user]);

  const emailRequired = form.role !== "operator";
  const valid = !!form.name.trim() && !!form.phone.trim() && !!form.role && (!emailRequired || !!form.email.trim());
  const emailLocked = !!user && !caps.staffEmailEdit;
  // Roles the actor can't create are shown greyed, as in the design;
  // superadmin only appears for someone who may create it.
  const shown = ROLES.filter((r) => creatableRoles.includes(r) || r !== "superadmin");

  async function submit() {
    if (!valid || saving || !form.role) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role };
      if (user) {
        await api.updateStaff(user.id, payload);
        onSaved("Xodim tahrirlandi");
      } else {
        await api.createStaff(payload);
        onSaved("Xodim qo'shildi");
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      back={onClose}
      busy={saving}
      width={600}
      title={user ? "Xodimni tahrirlash" : "Xodim qo'shish"}
      description={user ? undefined : `Siz ${ROLE_LABEL[actorRole].toLowerCase()} sifatida faqat ruxsat berilgan rollarni yarata olasiz.`}
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={submit} loading={saving} disabled={!valid}>
            {user ? "Saqlash" : "Qo'shish"}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input label="Ism familiya" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} autoFocus />
        <Input
          label="Telefon (majburiy)"
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+998 90 000 00 00"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />
        <Input
          label={emailRequired ? "Email (operatordan boshqa hamma uchun majburiy)" : "Email (ixtiyoriy)"}
          required={emailRequired}
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          disabled={emailLocked}
          hint={emailLocked ? "Emailni yaratilgandan keyin o'zgartirib bo'lmaydi." : undefined}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="label-caps mb-2 text-muted">Rol</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {shown.map((r) => {
              const allowed = creatableRoles.includes(r);
              const checked = form.role === r;
              return (
                <label
                  key={r}
                  className={cn(
                    "flex min-h-[64px] cursor-pointer items-start gap-3 rounded-box px-3.5 py-3 shadow-hairline transition-colors",
                    checked ? "bg-green-soft shadow-[inset_0_0_0_2px_var(--green)]" : "bg-white hover:bg-surface",
                    !allowed && "cursor-not-allowed bg-surface opacity-60 hover:bg-surface"
                  )}
                >
                  <input
                    type="radio"
                    name="staff-role"
                    value={r}
                    checked={checked}
                    disabled={!allowed}
                    onChange={() => setForm((f) => ({ ...f, role: r }))}
                    className="mt-1 h-4 w-4 accent-[var(--green-text)]"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-extrabold">{ROLE_LABEL[r]}</span>
                    <span className="text-xs font-semibold text-muted">{allowed ? ROLE_PICK_HINT[r] : "Ruxsat yo'q"}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {!user && <p className="text-13 font-semibold text-muted">Yangi xodim birinchi kirishda email kodi va SMS kodini kiritadi. Harakat audit jurnaliga yoziladi.</p>}
        {error && (
          <p role="alert" className="text-13 font-semibold text-error">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
