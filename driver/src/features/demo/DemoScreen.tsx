import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { DemoPreset } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/stores/sessionStore";
import { useDemoStore } from "@/stores/demoStore";
import { AlertTriangle, Armchair, Car, Gift, RotateCcw, Truck, User, UserPlus, UserX, Wallet, WifiOff, Zap } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/Card";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Switch } from "@/components/Switch";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";

const PRESETS: { key: DemoPreset; icon: typeof User; tile: "blue" | "yellow" | "green" | "orange" | "red" | "slate" }[] = [
  { key: "new", icon: UserPlus, tile: "blue" },
  { key: "active", icon: Car, tile: "green" },
  { key: "near_debt", icon: Wallet, tile: "orange" },
  { key: "debt", icon: AlertTriangle, tile: "red" },
  { key: "bonus", icon: Gift, tile: "yellow" },
];

export default function DemoScreen() {
  const { t } = useT();
  const navigate = useNavigate();
  const refresh = useSession((s) => s.refresh);
  const session = useSession((s) => s.session);
  const { network, toggle, resetAll } = useDemoStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function run(id: string, fn: () => Promise<unknown>, to: string) {
    setBusy(id);
    try {
      await fn();
      const s = await refresh();
      toast(t("demo.applied"), "success");
      navigate(s.stage === "active" ? to : "/register", { replace: true });
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={t("demo.title")} back={session?.stage === "active" ? "/profile" : "/register"} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        <p className="mb-5 px-1 text-sm text-muted">{t("demo.intro")}</p>

        <SectionLabel>{t("demo.roles")}</SectionLabel>
        <SettingsGroup>
          {PRESETS.map((p) => (
            <SettingsRow
              key={p.key}
              icon={p.icon}
              tile={p.tile}
              label={t(`demo.preset.${p.key}`)}
              onClick={busy ? undefined : () => run(p.key, () => api.demoApplyPreset(p.key), p.key === "debt" || p.key === "near_debt" ? "/wallet" : "/")}
            />
          ))}
        </SettingsGroup>

        <SectionLabel className="mt-6">{t("demo.events")}</SectionLabel>
        <SettingsGroup>
          <SettingsRow icon={Zap} tile="yellow" label={t("demo.emitRequest")} onClick={busy ? undefined : () => run("emit", () => api.demoEmitRequest(), "/")} />
          <SettingsRow icon={Zap} tile="yellow" label={t("demo.emitFull")} onClick={busy ? undefined : () => run("emit-full", () => api.demoEmitRequest("full"), "/")} />
          <SettingsRow icon={Truck} tile="yellow" label={t("demo.emitCargo")} onClick={busy ? undefined : () => run("emit-cargo", () => api.demoEmitRequest("cargo"), "/")} />
          <SettingsRow icon={UserX} tile="slate" label={t("demo.takeRequest")} onClick={busy ? undefined : () => run("take", () => api.demoTakeRequest(), "/")} />
          <SettingsRow icon={Armchair} tile="blue" label={t("demo.fillSeats")} onClick={busy ? undefined : () => run("seats", () => api.demoFillSeats(), "/")} />
          <SettingsRow icon={AlertTriangle} tile="red" label={t("demo.debtLimit")} onClick={busy ? undefined : () => run("debt-limit", () => api.demoDebtLimit(), "/")} />
        </SettingsGroup>

        <SectionLabel className="mt-6">{t("demo.network")}</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            icon={WifiOff}
            tile="orange"
            label={t("demo.slow")}
            description={t("demo.slowHint")}
            trailing={<Switch checked={network.slowInternet} onChange={() => toggle("slowInternet")} label={t("demo.slow")} />}
          />
          <SettingsRow
            icon={AlertTriangle}
            tile="red"
            label={t("demo.errors")}
            description={t("demo.errorsHint")}
            trailing={<Switch checked={network.forceErrors} onChange={() => toggle("forceErrors")} label={t("demo.errors")} />}
          />
        </SettingsGroup>

        <Button variant="secondary" fullWidth className="mt-4" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-5 w-5" />
          {t("demo.reset")}
        </Button>
      </div>
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={t("demo.resetTitle")}>
        <p className="mb-5 text-base text-muted">{t("demo.resetDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={resetAll}>
            {t("demo.reset")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
