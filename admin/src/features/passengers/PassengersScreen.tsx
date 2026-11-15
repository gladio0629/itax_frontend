import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Eye, Pencil, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import { DataTable, type Column } from "@/components/DataTable";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Drawer } from "@/components/Drawer";
import { FormDrawer } from "@/components/FormDrawer";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ExportButton } from "@/components/ExportButton";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { Toast } from "@/components/Toast";
import { ListToolbar } from "@/components/ListToolbar";
import { FilterSelect } from "@/components/FilterSelect";
import { api } from "@/api/client";
import { useAdapterList } from "@/hooks/useAdapterList";
import type { ArchivableStatusFilter, City, Passenger, PassengerQuery, PassengerStatus } from "@/api/types";

type Confirm = { type: "block" | "unblock" | "archive" | "restore"; passenger: Passenger };

const caps = api.capabilities;
const errorText = (e: unknown) => (e instanceof Error ? e.message : "Xatolik yuz berdi");

const STATUS_OPTIONS: { value: ArchivableStatusFilter<PassengerStatus>; label: string }[] = [
  { value: "all", label: "Barchasi" },
  { value: "active", label: "Faol" },
  { value: "blocked", label: "Bloklangan" },
  { value: "archived", label: "Arxivlangan" },
];

export function PassengersScreen() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ArchivableStatusFilter<PassengerStatus>>("all");
  const query: PassengerQuery = { search, status };
  const { items: passengers, error, reload } = useAdapterList(api.getPassengers, query);

  const [cities, setCities] = useState<City[]>([]);
  useEffect(() => {
    if (caps.passengerCity) api.getCities().then(setCities).catch(() => {});
  }, []);

  const [selected, setSelected] = useState<Passenger | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [drawer, setDrawer] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", cityId: "" });
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function openConfirm(c: Confirm) {
    setActionError(null);
    setConfirm(c);
  }

  function cityName(id: string) {
    return cities.find((c) => c.id === id)?.name ?? id;
  }

  async function handleReveal(id: string) {
    setRevealing(true);
    try {
      const res = await api.revealPhone("passenger", id);
      setPhone(res.phone);
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setRevealing(false);
    }
  }

  function openCreate() {
    setForm({ name: "", phone: "", cityId: cities[0]?.id ?? "" });
    setFormError(null);
    setDrawer("create");
  }
  function openEdit(p: Passenger) {
    setForm({ name: p.name, phone: "", cityId: p.cityId });
    setFormError(null);
    setDrawer("edit");
  }

  async function handleSave() {
    if (!selected && drawer === "edit") return;
    setSaving(true);
    setFormError(null);
    try {
      if (drawer === "create") {
        await api.createPassenger({ name: form.name.trim(), phone: form.phone.trim(), cityId: form.cityId });
        setToast("Yo'lovchi qo'shildi");
      } else if (drawer === "edit" && selected) {
        const updated = await api.updatePassenger(selected.id, { name: form.name.trim(), cityId: form.cityId });
        setSelected(updated);
        setToast("Profil saqlandi");
      }
      setDrawer(null);
      reload();
    } catch (e) {
      setFormError(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm(reason?: string) {
    if (!confirm) return;
    setActing(true);
    setActionError(null);
    try {
      const { type, passenger } = confirm;
      let updated: Passenger;
      if (type === "block") updated = await api.setPassengerStatus(passenger.id, "blocked", reason);
      else if (type === "unblock") updated = await api.setPassengerStatus(passenger.id, "active");
      else if (type === "archive") updated = await api.archivePassenger(passenger.id);
      else updated = await api.restorePassenger(passenger.id);
      setSelected((prev) => (prev?.id === updated.id ? updated : prev));
      setToast(type === "block" ? "Bloklandi" : type === "unblock" ? "Blokdan chiqarildi" : type === "archive" ? "Arxivlandi" : "Tiklandi");
      setConfirm(null);
      reload();
    } catch (e) {
      setActionError(errorText(e));
    } finally {
      setActing(false);
    }
  }

  const columns: Column<Passenger>[] = [
    {
      key: "name",
      header: "Yo'lovchi",
      sortValue: (p) => p.name,
      width: "240px",
      render: (p) => (
        <div className="flex min-w-0 items-center gap-2">
          <Avatar seed={p.avatarSeed} name={p.name} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{p.name}</p>
            <p className="truncate text-xs text-ink/50">{p.phoneMasked}</p>
          </div>
        </div>
      ),
    },
    ...(caps.passengerCity
      ? [
          {
            key: "city",
            header: "Shahar",
            render: (p: Passenger) => (
              <span className="block max-w-[140px] truncate" title={cityName(p.cityId)}>
                {cityName(p.cityId)}
              </span>
            ),
          } as Column<Passenger>,
        ]
      : []),
    { key: "rating", header: "Reyting", align: "right", sortValue: (p) => p.rating, render: (p) => <span className="tabular">{p.rating.toFixed(1)}</span> },
    { key: "trips", header: "Safarlar", align: "right", sortValue: (p) => p.totalTrips, render: (p) => <span className="tabular">{p.totalTrips}</span> },
    {
      key: "status",
      header: "Holat",
      render: (p) => <Badge tone={p.archived ? "neutral" : p.status === "active" ? "success" : "danger"}>{p.archived ? "Arxivlangan" : p.status === "active" ? "Faol" : "Bloklangan"}</Badge>,
    },
  ];

  if (error) return <ErrorState onRetry={reload} />;
  if (!passengers) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const hasActiveFilters = status !== "all";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ListToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Ism bo'yicha qidirish…"
          resultCount={passengers.length}
          hasActiveFilters={hasActiveFilters}
          onClear={() => setStatus("all")}
        >
          <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Holat bo'yicha filtr" />
        </ListToolbar>
        <div className="flex shrink-0 items-center gap-2">
          <ExportButton
            section="passengers"
            rows={passengers}
            filenamePrefix="yolovchilar"
            buildRow={(p) => ({ Ism: p.name, Shahar: cityName(p.cityId), Reyting: p.rating, Safarlar: p.totalTrips, Holat: p.status })}
          />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Qo'shish
          </Button>
        </div>
      </div>

      <DataTable
        key={`${search}-${status}`}
        columns={columns}
        rows={passengers}
        rowKey={(p) => p.id}
        emptyIcon={<Users className="h-6 w-6" />}
        emptyTitle="Yo'lovchi topilmadi"
        emptyDescription="Qidiruv yoki filtrlarga mos yo'lovchi yo'q."
        onRowClick={(p) => {
          setSelected(p);
          setPhone(null);
        }}
      />

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""}>
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar seed={selected.avatarSeed} name={selected.name} size={48} />
                <div>
                  <p className="font-semibold text-ink">{selected.name}</p>
                  {caps.passengerCity && <p className="text-xs text-ink/50">{cityName(selected.cityId)}</p>}
                </div>
              </div>
              {!selected.archived && (
                <button type="button" aria-label="Tahrirlash" onClick={() => openEdit(selected)} className="rounded-full p-2 text-ink/50 hover:bg-ink/5 hover:text-ink">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="rounded-card bg-ink/5 p-4">
              <p className="mb-1 text-xs font-semibold text-ink/50">Telefon raqami</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink tabular">{phone ?? selected.phoneMasked}</span>
                {!phone && (
                  <Button size="sm" variant="secondary" loading={revealing} onClick={() => handleReveal(selected.id)}>
                    <Eye className="h-4 w-4" /> Ko'rsatish
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-ink/50">Reyting</p>
                <p className="font-semibold text-ink">{selected.rating.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-xs text-ink/50">Jami safarlar</p>
                <p className="font-semibold text-ink">{selected.totalTrips}</p>
              </div>
            </div>
            {actionError && !confirm && <p className="text-xs font-semibold text-danger">{actionError}</p>}
            <div className="flex gap-2 border-t border-border pt-4">
              {selected.archived ? (
                <Button variant="secondary" size="sm" onClick={() => openConfirm({ type: "restore", passenger: selected })}>
                  <RotateCcw className="h-4 w-4" /> Tiklash
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openConfirm({ type: selected.status === "blocked" ? "unblock" : "block", passenger: selected })}
                  >
                    {selected.status === "blocked" ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                    {selected.status === "blocked" ? "Blokdan chiqarish" : "Bloklash"}
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => openConfirm({ type: "archive", passenger: selected })}>
                    <Trash2 className="h-4 w-4" /> Arxivlash
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <FormDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer === "create" ? "Yangi yo'lovchi" : "Tahrirlash"}
        onSubmit={handleSave}
        loading={saving}
        error={formError}
        disabled={!form.name.trim() || (drawer === "create" && !form.phone.trim())}
      >
        <Input
          label="To'liq ism"
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          hint={caps.passengerCity ? undefined : "Ism va familiya, masalan: Aziz Karimov"}
          autoFocus
        />
        {drawer === "create" && (
          <Input
            label="Telefon"
            required={drawer === "create"}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+998 90 000 00 00"
          />
        )}
        {caps.passengerCity && (
          <div>
            <label htmlFor="fld-shahar" className="mb-2 block text-sm font-semibold text-ink/80">Shahar</label>
            <select id="fld-shahar"
              value={form.cityId}
              onChange={(e) => setForm((f) => ({ ...f, cityId: e.target.value }))}
              className="h-10 w-full rounded-button border border-border bg-card px-3 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
            >
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </FormDrawer>

      <ConfirmDialog
        open={confirm !== null}
        title={
          confirm?.type === "block" ? "Yo'lovchini bloklash" : confirm?.type === "unblock" ? "Blokdan chiqarish" : confirm?.type === "archive" ? "Arxivlash" : "Tiklash"
        }
        description={`${confirm?.passenger.name ?? ""} uchun amalni tasdiqlaysizmi?`}
        tone={confirm?.type === "block" || confirm?.type === "archive" ? "danger" : "accent"}
        reasonLabel={confirm?.type === "block" ? "Bloklash sababi (shart)…" : undefined}
        error={actionError}
        loading={acting}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
