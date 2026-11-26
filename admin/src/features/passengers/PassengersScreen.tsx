import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, CheckCircle2, ClipboardList, ExternalLink, Pencil, Plus, RotateCcw, Search, Trash2, Users } from "lucide-react";
import { api } from "@/api/client";
import { PageHeader } from "@/layouts/PageHeader";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Drawer } from "@/components/Drawer";
import { FormDrawer } from "@/components/FormDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input, SearchInput, SelectField } from "@/components/Input";
import { FilterChips } from "@/components/FilterChips";
import { FilterSelect } from "@/components/FilterSelect";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState, StaleNotice } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { RowMenu } from "@/components/RowMenu";
import { Avatar } from "@/components/Avatar";
import { PersonCell } from "@/components/Cells";
import { useAdapterList } from "@/hooks/useAdapterList";
import { useSearchFromUrl } from "@/hooks/useSearchFromUrl";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDate, formatNumber, formatRelativeDay } from "@/lib/format";
import { PAYMENT_LABEL } from "@/features/orders/labels";
import type { ArchivableStatusFilter, City, ListCounts, ListPeriod, Passenger, PassengerQuery, PassengerStatus } from "@/api/types";

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");

const STATUS: Record<PassengerStatus | "archived", { label: string; tone: BadgeTone }> = {
  active: { label: "Faol", tone: "success" },
  // Display only, when the server sends it; no action sets it here.
  warned: { label: "Ogohlantirilgan", tone: "warning" },
  blocked: { label: "Bloklangan", tone: "neutral" },
  archived: { label: "Arxivlangan", tone: "neutral" },
};
const badgeOf = (p: Passenger) => (p.archived ? STATUS.archived : STATUS[p.status]);
const JOINED: { value: ListPeriod; label: string }[] = [
  { value: "all", label: "Hammasi" },
  { value: "today", label: "Bugun" },
  { value: "7d", label: "7 kun" },
  { value: "30d", label: "30 kun" },
];

type Confirm = { type: "block" | "unblock" | "archive" | "restore"; passenger: Passenger };

const paymentText = (p: Passenger) =>
  !p.lastPayment ? "—" : p.lastPayment.cardLast4 ? `${PAYMENT_LABEL[p.lastPayment.method]} •• ${p.lastPayment.cardLast4}` : PAYMENT_LABEL[p.lastPayment.method];

/** Passengers list (design Passengers) + detail drawer with every action
 * the old screen had: add, edit, block (reason), unblock, archive, restore. */
export function PassengersScreen() {
  const navigate = useNavigate();
  const { me } = usePermissions();
  const [search, setSearch] = useState("");
  useSearchFromUrl(setSearch);
  const [status, setStatus] = useState<ArchivableStatusFilter<PassengerStatus>>("all");
  const [joined, setJoined] = useState<ListPeriod>("all");
  const filters = { search, joined } satisfies Omit<PassengerQuery, "status">;
  const { items: passengers, error, reload } = useAdapterList(api.getPassengers, { ...filters, status } as PassengerQuery);
  const [counts, setCounts] = useState<ListCounts<PassengerStatus | "archived"> | null>(null);
  const [tick, setTick] = useState(0);
  const [cities, setCities] = useState<City[]>([]);

  const [selected, setSelected] = useState<Passenger | null>(null);
  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", cityId: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (caps.passengerCity) api.getCities().then(setCities).catch(() => {});
  }, []);
  const countsKey = JSON.stringify(filters);
  useEffect(() => {
    if (!caps.passengerCounts) return;
    let live = true;
    const t = setTimeout(() => api.getPassengerCounts(filters).then((c) => live && setCounts(c)).catch(() => live && setCounts(null)), 300);
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
  const cityName = (id: string) => cities.find((c) => c.id === id)?.name ?? id;

  function openCreate() {
    setForm({ name: "", phone: "", cityId: cities[0]?.id ?? "" });
    setFormError(null);
    setDrawer("create");
  }
  function openEdit(p: Passenger) {
    setSelected(p);
    setForm({ name: p.name, phone: "", cityId: p.cityId });
    setFormError(null);
    setDrawer("edit");
  }
  function ask(type: Confirm["type"], passenger: Passenger) {
    setActionError(null);
    setConfirm({ type, passenger });
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      if (drawer === "create") {
        await api.createPassenger({ name: form.name.trim(), phone: form.phone.trim(), cityId: form.cityId });
        setToast("Yo'lovchi qo'shildi");
      } else if (drawer === "edit" && selected) {
        const updated = await api.updatePassenger(selected.id, caps.passengerCity ? { name: form.name.trim(), cityId: form.cityId } : { name: form.name.trim() });
        setSelected(updated);
        setToast("Profil saqlandi");
      }
      setDrawer(null);
      refresh();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function run(reason?: string) {
    if (!confirm) return;
    setActing(true);
    setActionError(null);
    try {
      const { type, passenger } = confirm;
      const updated =
        type === "block"
          ? await api.setPassengerStatus(passenger.id, "blocked", reason)
          : type === "unblock"
            ? await api.setPassengerStatus(passenger.id, "active")
            : type === "archive"
              ? await api.archivePassenger(passenger.id)
              : await api.restorePassenger(passenger.id);
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
      setToast(type === "block" ? "Bloklandi" : type === "unblock" ? "Blokdan chiqarildi" : type === "archive" ? "Arxivlandi" : "Tiklandi");
      setConfirm(null);
      refresh();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setActing(false);
    }
  }

  const chipKeys: (PassengerStatus | "archived")[] = ["active", ...(counts?.warned ? (["warned"] as const) : []), "blocked", "archived"];
  const chips = [
    { key: "all" as const, label: "Hammasi", count: counts?.all },
    ...chipKeys.map((k) => ({ key: k, label: k === "archived" ? "Arxiv" : STATUS[k].label, count: counts ? (counts[k] ?? 0) : undefined })),
  ];

  const menu = (p: Passenger) => (
    <RowMenu
      label={`${p.name}: amallar`}
      items={[
        { label: "Ochish", icon: <ExternalLink />, onSelect: () => setSelected(p) },
        { label: "Tahrirlash", icon: <Pencil />, onSelect: () => openEdit(p), hidden: p.archived },
        { label: "Bloklash", icon: <Ban />, tone: "danger", onSelect: () => ask("block", p), hidden: p.archived || p.status === "blocked" },
        { label: "Blokdan chiqarish", icon: <CheckCircle2 />, onSelect: () => ask("unblock", p), hidden: p.archived || p.status !== "blocked" },
        { label: "Arxivlash", icon: <Trash2 />, tone: "danger", onSelect: () => ask("archive", p), hidden: p.archived },
        { label: "Tiklash", icon: <RotateCcw />, onSelect: () => ask("restore", p), hidden: !p.archived },
      ]}
    />
  );

  const showLast = passengers?.some((p) => p.lastTripAt !== null);
  const showPay = passengers?.some((p) => p.lastPayment !== null);
  const columns: Column<Passenger>[] = [
    { key: "name", header: "Yo'lovchi", sortValue: (p) => p.name, render: (p) => <PersonCell name={p.name} sub={p.phone} /> },
    { key: "trips", header: "Safarlar", sortValue: (p) => p.totalTrips, render: (p) => formatNumber(p.totalTrips) },
    { key: "rating", header: "Reyting", sortValue: (p) => p.rating, render: (p) => (p.rating ? p.rating.toFixed(1) : "—") },
    ...(showLast
      ? [
          {
            key: "last",
            header: "Oxirgi safar",
            sortValue: (p: Passenger) => p.lastTripAt ?? 0,
            render: (p: Passenger) => (p.lastTripAt ? formatRelativeDay(p.lastTripAt) : "—"),
          } satisfies Column<Passenger>,
        ]
      : []),
    ...(showPay ? [{ key: "pay", header: "To'lov", render: paymentText } satisfies Column<Passenger>] : []),
    ...(caps.passengerCity ? [{ key: "city", header: "Shahar", render: (p: Passenger) => cityName(p.cityId) } satisfies Column<Passenger>] : []),
    {
      key: "status",
      header: "Holat",
      render: (p) => {
        const b = badgeOf(p);
        return <Badge tone={b.tone}>{b.label}</Badge>;
      },
    },
    { key: "actions", header: "", width: "56px", render: menu },
  ];

  return (
    <>
      <PageHeader
        subtitle="Ilovadan ro'yxatdan o'tganlar"
        title="Yo'lovchilar"
        actions={
          <>
            <ExportButton
              section="passengers"
              rows={passengers ?? []}
              filenamePrefix="yolovchilar"
              buildRow={(p) => ({
                Ism: p.name,
                Telefon: p.phone,
                Safarlar: p.totalTrips,
                Reyting: p.rating,
                "Oxirgi safar": p.lastTripAt ? new Date(p.lastTripAt).toISOString() : "",
                Holat: badgeOf(p).label,
              })}
            />
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden /> Qo'shish
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchInput
          className="w-[300px] max-w-full"
          label="Ism yoki telefon"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" aria-hidden />}
        />
        <FilterChips label="Holat bo'yicha" items={chips} value={status} onChange={setStatus} />
        <span className="flex-1" />
        {caps.passengerJoinedFilter && (
          <FilterSelect label="Ro'yxatdan o'tgan" aria-label="Ro'yxatdan o'tgan sana" value={joined} onChange={setJoined} options={JOINED} />
        )}
      </div>

      {error && passengers && <StaleNotice onRetry={reload} />}
      {error && !passengers ? (
        <ErrorState onRetry={reload} />
      ) : !passengers ? (
        <div className="flex flex-col gap-2 rounded-card bg-white p-4 shadow-card" aria-busy>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={passengers}
          rowKey={(p) => p.id}
          onRowClick={setSelected}
          total={status === "all" ? counts?.all : counts?.[status]}
          emptyIcon={<Users />}
          emptyTitle="Yo'lovchi topilmadi"
          emptyDescription="Filtrlarni o'zgartirib ko'ring."
        />
      )}

      <Drawer
        open={!!selected && drawer !== "edit"}
        onClose={() => setSelected(null)}
        back={() => setSelected(null)}
        title={selected?.name ?? ""}
        titleAddon={selected && <Badge tone={badgeOf(selected).tone}>{badgeOf(selected).label}</Badge>}
        subtitle={selected?.phone}
        footer={
          selected && (
            <div className="flex flex-wrap gap-2.5">
              {me?.sections.includes("orders") && (
                <Button variant="soft" onClick={() => navigate(`/orders?passenger=${encodeURIComponent(selected.id)}`)}>
                  <ClipboardList className="h-4 w-4" aria-hidden /> Buyurtmalari
                </Button>
              )}
              <span className="flex-1" />
              {selected.archived ? (
                <Button variant="soft" onClick={() => ask("restore", selected)}>
                  <RotateCcw className="h-4 w-4" aria-hidden /> Tiklash
                </Button>
              ) : (
                <>
                  <Button variant="soft" onClick={() => openEdit(selected)}>
                    <Pencil className="h-4 w-4" aria-hidden /> Tahrirlash
                  </Button>
                  {selected.status === "blocked" ? (
                    <Button variant="soft" onClick={() => ask("unblock", selected)}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Blokdan chiqarish
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={() => ask("block", selected)}>
                      <Ban className="h-4 w-4" aria-hidden /> Bloklash
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => ask("archive", selected)}>
                    <Trash2 className="h-4 w-4" aria-hidden /> Arxivlash
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        {selected && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar name={selected.name} size={56} />
              <span className="flex flex-col">
                <span className="text-base font-extrabold text-ink">{selected.name}</span>
                <span className="tabular text-sm font-semibold text-muted">{selected.phone}</span>
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Fact label="Safarlar" value={formatNumber(selected.totalTrips)} />
              <Fact label="Reyting" value={selected.rating ? selected.rating.toFixed(1) : "—"} />
              {selected.lastTripAt !== null && <Fact label="Oxirgi safar" value={formatRelativeDay(selected.lastTripAt)} />}
              {selected.lastPayment && <Fact label="To'lov" value={paymentText(selected)} />}
              <Fact label="Ro'yxatdan o'tgan" value={formatDate(selected.joinedAt)} />
              {caps.passengerCity && <Fact label="Shahar" value={cityName(selected.cityId)} />}
            </dl>
          </div>
        )}
      </Drawer>

      <FormDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer === "create" ? "Yangi yo'lovchi" : "Yo'lovchini tahrirlash"}
        submitLabel={drawer === "create" ? "Qo'shish" : "Saqlash"}
        onSubmit={save}
        loading={saving}
        disabled={!form.name.trim() || (drawer === "create" && !form.phone.trim())}
        error={formError}
      >
        <Input
          label="To'liq ism"
          required
          autoFocus
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          hint={caps.passengerCity ? undefined : "Ism va familiya, masalan: Aziz Karimov"}
        />
        {drawer === "create" && (
          <Input
            label="Telefon"
            required
            type="tel"
            inputMode="tel"
            placeholder="+998 90 123 45 67"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
        )}
        {caps.passengerCity && (
          <SelectField
            label="Shahar"
            value={form.cityId}
            onChange={(e) => setForm((f) => ({ ...f, cityId: e.target.value }))}
            options={cities.map((c) => ({ value: c.id, label: c.name }))}
          />
        )}
      </FormDrawer>

      <ConfirmDialog
        open={!!confirm}
        title={
          confirm?.type === "block"
            ? "Yo'lovchini bloklash"
            : confirm?.type === "unblock"
              ? "Blokdan chiqarish"
              : confirm?.type === "archive"
                ? "Arxivlash"
                : "Tiklash"
        }
        description={
          confirm
            ? confirm.type === "block"
              ? `${confirm.passenger.name} buyurtma bera olmaydi.`
              : confirm.type === "unblock"
                ? `${confirm.passenger.name} yana buyurtma bera oladi.`
                : confirm.type === "archive"
                  ? `${confirm.passenger.name} ro'yxatdan yashiriladi. Keyin tiklash mumkin.`
                  : `${confirm.passenger.name} arxivdan qaytariladi.`
            : ""
        }
        confirmLabel={confirm?.type === "block" ? "Bloklash" : confirm?.type === "unblock" ? "Blokdan chiqarish" : confirm?.type === "archive" ? "Arxivlash" : "Tiklash"}
        tone={confirm?.type === "block" || confirm?.type === "archive" ? "danger" : "accent"}
        loading={acting}
        reasonLabel={confirm?.type === "block" ? "Bloklash sababi (majburiy)" : undefined}
        error={actionError}
        onConfirm={run}
        onCancel={() => setConfirm(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-field bg-surface px-4 py-3">
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="text-sm font-bold text-ink">{value}</dd>
    </div>
  );
}
