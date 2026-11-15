// Sample-data mode only: routes.tsx loads this screen lazily behind
// DEMO_MODE, so it (and the mock-only controls it imports) never reaches
// the production bundle.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { testControls } from "@/api/adapters/mock";
import type { TestPreset } from "@/api/types";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/stores/sessionStore";
import { useTestControls } from "@/stores/testControlsStore";
import { AlertTriangle, Armchair, Car, Gift, RotateCcw, Truck, User, UserPlus, UserX, Wallet, WifiOff, Zap } from "@/lib/icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { SectionLabel } from "@/components/Card";
import { SettingsGroup, SettingsRow } from "@/components/SettingsRow";
import { Switch } from "@/components/Switch";
import { Button } from "@/components/Button";
import { Sheet } from "@/components/Sheet";
import { testPanelText, type TestPanelKey } from "./strings";

const PRESETS: { key: TestPreset; icon: typeof User; tile: "blue" | "yellow" | "green" | "orange" | "red" | "slate" }[] = [
  { key: "new", icon: UserPlus, tile: "blue" },
  { key: "active", icon: Car, tile: "green" },
  { key: "near_debt", icon: Wallet, tile: "orange" },
  { key: "debt", icon: AlertTriangle, tile: "red" },
  { key: "bonus", icon: Gift, tile: "yellow" },
];

export default function TestPanelScreen() {
  const { t, locale } = useT();
  const tp = (key: TestPanelKey) => testPanelText(locale, key);
  const navigate = useNavigate();
  const refresh = useSession((s) => s.refresh);
  const session = useSession((s) => s.session);
  const { network, toggle, resetAll } = useTestControls();
  const [busy, setBusy] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function run(id: string, fn: () => Promise<unknown>, to: string) {
    setBusy(id);
    try {
      await fn();
      const s = await refresh();
      toast(tp("applied"), "success");
      navigate(s.stage === "active" ? to : "/register", { replace: true });
    } catch (e) {
      toast(errorMessage(e, t), "danger");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ScreenHeader title={tp("title")} back={session?.stage === "active" ? "/profile" : "/register"} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-2">
        <p className="mb-5 px-1 text-sm text-muted">{tp("intro")}</p>

        <SectionLabel>{tp("roles")}</SectionLabel>
        <SettingsGroup>
          {PRESETS.map((p) => (
            <SettingsRow
              key={p.key}
              icon={p.icon}
              tile={p.tile}
              label={tp(`preset.${p.key}`)}
              onClick={busy ? undefined : () => run(p.key, () => testControls.applyPreset(p.key), p.key === "debt" || p.key === "near_debt" ? "/wallet" : "/")}
            />
          ))}
        </SettingsGroup>

        <SectionLabel className="mt-6">{tp("events")}</SectionLabel>
        <SettingsGroup>
          <SettingsRow icon={Zap} tile="yellow" label={tp("emitRequest")} onClick={busy ? undefined : () => run("emit", () => testControls.emitRequest(), "/")} />
          <SettingsRow icon={Zap} tile="yellow" label={tp("emitFull")} onClick={busy ? undefined : () => run("emit-full", () => testControls.emitRequest("full"), "/")} />
          <SettingsRow icon={Truck} tile="yellow" label={tp("emitCargo")} onClick={busy ? undefined : () => run("emit-cargo", () => testControls.emitRequest("cargo"), "/")} />
          <SettingsRow icon={UserX} tile="slate" label={tp("takeRequest")} onClick={busy ? undefined : () => run("take", () => testControls.takeRequest(), "/")} />
          <SettingsRow icon={Armchair} tile="blue" label={tp("fillSeats")} onClick={busy ? undefined : () => run("seats", () => testControls.fillSeats(), "/")} />
          <SettingsRow icon={AlertTriangle} tile="red" label={tp("debtLimit")} onClick={busy ? undefined : () => run("debt-limit", () => testControls.debtLimit(), "/")} />
        </SettingsGroup>

        <SectionLabel className="mt-6">{tp("network")}</SectionLabel>
        <SettingsGroup>
          <SettingsRow
            icon={WifiOff}
            tile="orange"
            label={tp("slow")}
            description={tp("slowHint")}
            trailing={<Switch checked={network.slowInternet} onChange={() => toggle("slowInternet")} label={tp("slow")} />}
          />
          <SettingsRow
            icon={AlertTriangle}
            tile="red"
            label={tp("errors")}
            description={tp("errorsHint")}
            trailing={<Switch checked={network.forceErrors} onChange={() => toggle("forceErrors")} label={tp("errors")} />}
          />
        </SettingsGroup>

        <Button variant="secondary" fullWidth className="mt-4" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-5 w-5" />
          {tp("reset")}
        </Button>
      </div>
      <Sheet open={resetOpen} onClose={() => setResetOpen(false)} title={tp("resetTitle")}>
        <p className="mb-5 text-base text-muted">{tp("resetDesc")}</p>
        <div className="grid grid-cols-2 gap-3 pb-1">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={resetAll}>
            {tp("reset")}
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
