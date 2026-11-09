import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Globe, Info, LogOut, MessageSquare } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/Card";
import { useDemoStore } from "@/stores/demoStore";
import { cn } from "@/lib/cn";

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => onChange(!value)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        value ? "bg-accent" : "bg-ink/20"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-softer transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}

export function SettingsScreen() {
  const navigate = useNavigate();
  const isDemo = useDemoStore((s) => s.isDemo);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(true);

  return (
    <div className="flex h-full flex-col bg-bg">
      <ScreenHeader title="Sozlamalar" />
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <p className="mb-2 mt-2 px-1 text-xs font-semibold text-ink/70">BILDIRISHNOMALAR</p>
        <Card className="mb-5 divide-y divide-border" padded={false}>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-semibold text-ink">
              <Bell className="h-4 w-4 text-ink/60" /> Push-bildirishnomalar
            </span>
            <Toggle value={pushEnabled} onChange={setPushEnabled} label="Push-bildirishnomalar" />
          </div>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-semibold text-ink">
              <MessageSquare className="h-4 w-4 text-ink/60" /> SMS orqali xabarlar
            </span>
            <Toggle value={smsEnabled} onChange={setSmsEnabled} label="SMS orqali xabarlar" />
          </div>
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/70">TIL</p>
        <Card className="mb-5 flex items-center justify-between p-4">
          <span className="flex items-center gap-3 text-sm font-semibold text-ink">
            <Globe className="h-4 w-4 text-ink/60" /> Interfeys tili
          </span>
          <span className="text-sm font-semibold text-accent">O'zbekcha</span>
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/70">ILOVA</p>
        <Card className="mb-5 divide-y divide-border" padded={false}>
          <div className="flex items-center justify-between p-4">
            <span className="flex items-center gap-3 text-sm font-semibold text-ink">
              <Info className="h-4 w-4 text-ink/60" /> Versiya
            </span>
            <span className="text-sm text-ink/70 tabular">1.0.0 (demo)</span>
          </div>
          {isDemo && (
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-semibold text-ink">Demo rejimi</span>
              <span className="text-sm font-semibold text-accent">Yoqilgan</span>
            </div>
          )}
        </Card>

        <p className="mb-2 px-1 text-xs font-semibold text-ink/70">HISOB</p>
        <button
          type="button"
          onClick={() => navigate("/register")}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-danger transition-colors hover:bg-danger/10 active:scale-[0.98]"
        >
          <LogOut className="h-4 w-4" /> Chiqish
        </button>
      </div>
    </div>
  );
}
