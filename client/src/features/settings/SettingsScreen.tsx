import { useState } from "react";
import { Bell, Globe, Info, FlaskConical } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { cn } from "@/lib/cn";

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", value ? "bg-accent" : "bg-ink/15")}
      aria-pressed={value}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-softer transition-transform", value ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}

export function SettingsScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Sozlamalar" />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="mb-2 mt-2 px-1 text-xs font-semibold text-ink/60">BILDIRISHNOMALAR</p>
        <Card className="mb-5 divide-y divide-border" padded={false}>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-medium text-ink">
              <Bell className="h-4 w-4 text-ink/60" /> Push-bildirishnomalar
            </span>
            <Toggle value={pushEnabled} onChange={setPushEnabled} />
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-medium text-ink">
              <Bell className="h-4 w-4 text-ink/60" /> SMS orqali xabarlar
            </span>
            <Toggle value={smsEnabled} onChange={setSmsEnabled} />
          </div>
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/60">TIL</p>
        <Card className="mb-5 flex items-center justify-between p-4" padded={false}>
          <div className="flex items-center justify-between p-4 w-full">
            <span className="flex items-center gap-3 text-sm font-medium text-ink">
              <Globe className="h-4 w-4 text-ink/60" /> Interfeys tili
            </span>
            <span className="text-sm font-medium text-ink/60">O'zbekcha</span>
          </div>
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/60">ILOVA</p>
        <Card className="divide-y divide-border" padded={false}>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-medium text-ink">
              <Info className="h-4 w-4 text-ink/60" /> Versiya
            </span>
            <span className="text-sm text-ink/60 tabular">1.0.0 (demo)</span>
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-medium text-ink">
              <FlaskConical className="h-4 w-4 text-ink/60" /> Demo rejimi
            </span>
            <span className="text-sm font-medium text-accent">Yoqilgan</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
