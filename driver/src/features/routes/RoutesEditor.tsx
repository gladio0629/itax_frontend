import { useState } from "react";
import { api } from "@/api/client";
import type { DriverRoute, RoutesPage } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { useQuery } from "@/lib/useQuery";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { ArrowLeftRight, ArrowRight, MapPin, Plus, Route, Trash2 } from "@/lib/icons";
import { Switch } from "@/components/Switch";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { Chip } from "@/components/Chip";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonList } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { TILE } from "@/components/SettingsRow";
import { cn } from "@/lib/cn";

/**
 * Yo'nalishlarim: the city pairs the driver serves. Add, remove (at least one
 * stays — the adapter says so), and a "both directions" switch per pair.
 */
export function RoutesEditor() {
  const { t } = useT();
  const q = useQuery(() => api.getRoutes(), []);
  const page = q.data;
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<DriverRoute | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<RoutesPage>) {
    setBusy(true);
    try {
      q.setData(await fn());
      return true;
    } catch (e) {
      toast(errorMessage(e, t), "danger");
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (q.error && !page) return <ErrorState error={q.error} onRetry={() => q.reload()} />;
  if (!page) return <SkeletonList rows={2} label={t("common.loading")} />;

  return (
    <>
      {page.routes.length === 0 ? (
        <EmptyState icon={Route} title={t("routes.empty")} description={t("routes.emptyDesc")} />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-1" aria-label={t("routes.title")}>
          {page.routes.map((r) => (
            <li key={r.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-button", TILE.blue)}>
                  {r.bothWays ? <ArrowLeftRight className="h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                </span>
                <p className="min-w-0 flex-1 truncate text-base font-bold text-ink">
                  {r.a.name} <span aria-hidden="true">{r.bothWays ? "⇄" : "→"}</span>
                  <span className="sr-only">{r.bothWays ? t("routes.bothWaysSr") : t("routes.oneWaySr")}</span> {r.b.name}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRemoving(r)}
                  aria-label={t("routes.remove", { route: `${r.a.name} – ${r.b.name}` })}
                  className="press -mr-2 flex h-12 w-12 shrink-0 items-center justify-center rounded-button text-muted disabled:opacity-40"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 pl-12">
                <span className="text-sm text-muted">{t("routes.bothWays")}</span>
                <Switch
                  checked={r.bothWays}
                  disabled={busy}
                  onChange={() => run(() => api.setRouteBothWays(r.id, !r.bothWays))}
                  label={`${t("routes.bothWays")}: ${r.a.name} – ${r.b.name}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button variant="secondary" fullWidth className="mt-3" disabled={busy} onClick={() => setAdding(true)}>
        <Plus className="h-5 w-5" />
        {t("routes.add")}
      </Button>

      <AddRouteSheet
        open={adding}
        cities={page.cities}
        onClose={() => setAdding(false)}
        onAdd={async (a, b) => {
          if (await run(() => api.addRoute(a, b))) setAdding(false);
        }}
        busy={busy}
      />

      <Sheet open={!!removing} onClose={() => setRemoving(null)} title={t("routes.removeTitle")}>
        <p className="mb-5 text-base text-muted">
          {removing && t("routes.removeDesc", { route: `${removing.a.name} – ${removing.b.name}` })}
        </p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            onClick={async () => {
              if (removing) await run(() => api.removeRoute(removing.id));
              setRemoving(null);
            }}
          >
            {t("routes.removeConfirm")}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function AddRouteSheet({
  open,
  cities,
  onClose,
  onAdd,
  busy,
}: {
  open: boolean;
  cities: RoutesPage["cities"];
  onClose: () => void;
  onAdd: (a: string, b: string) => void;
  busy: boolean;
}) {
  const { t } = useT();
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const close = () => {
    setFrom(null);
    setTo(null);
    onClose();
  };
  const Picker = ({ label, value, onPick }: { label: string; value: string | null; onPick: (id: string) => void }) => (
    <fieldset className="mb-4">
      <legend className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
        <MapPin className="h-4 w-4" />
        {label}
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {cities.map((c) => (
          <Chip key={c.id} selected={value === c.id} onClick={() => onPick(c.id)} className="px-2">
            <span className="truncate">{c.name}</span>
          </Chip>
        ))}
      </div>
    </fieldset>
  );
  return (
    <Sheet open={open} onClose={close} title={t("routes.addTitle")}>
      <Picker label={t("routes.from")} value={from} onPick={setFrom} />
      <Picker label={t("routes.to")} value={to} onPick={setTo} />
      <Button size="lg" fullWidth loading={busy} disabled={!from || !to} onClick={() => from && to && onAdd(from, to)}>
        {t("routes.addConfirm")}
      </Button>
    </Sheet>
  );
}
