import { useState } from "react";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { useDemoStore, type DemoScenarios } from "@/stores/demoStore";
import { useAuthStore } from "@/stores/authStore";
import { useMeStore } from "@/stores/meStore";
import { api } from "@/api/client";
import { ALL_ROLES } from "@/mockDb/db";
import type { AdminRole } from "@/api/types";
import { ROLE_LABEL } from "./Topbar";
import { cn } from "@/lib/cn";

const SCENARIO_LABELS: Record<keyof DemoScenarios, { label: string; hint: string }> = {
  noDriverFound: { label: "Haydovchi topilmadi", hint: "Buyurtma qidiruvi muvaffaqiyatsiz tugaydi" },
  slowInternet: { label: "Sekin internet", hint: "Barcha so'rovlar sezilarli kechikadi" },
  forceErrors: { label: "Xatoliklarni qaytarish", hint: "So'rovlar ko'pincha xato bilan tugaydi" },
  walletLimit: { label: "Hamyon limiti", hint: "Balans -50 000 so'mga yetdi deb hisoblanadi" },
  fastForward: { label: "Vaqtni tezlashtirish", hint: "Kutish vaqtlari qisqartiriladi" },
  shortSession: { label: "Qisqa seans", hint: "Harakatsizlikdan chiqish 20 soniyaga qisqaradi" },
};

export function DemoControlPanel() {
  const { isDemo, scenarios, toggle, resetDb } = useDemoStore();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<AdminRole | null>(null);

  if (!isDemo) return null;

  async function loginAsRole(role: AdminRole) {
    setSwitching(role);
    try {
      await api.loginAsRole(role);
      useMeStore.getState().clear();
      setAuthenticated(true);
      window.location.href = "/";
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 rounded-2xl bg-sidebar-bg p-5 text-white shadow-2xl animate-slide-up">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Demo boshqaruv paneli</p>
            <button onClick={() => setOpen(false)} aria-label="Yopish" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            {(Object.keys(SCENARIO_LABELS) as Array<keyof DemoScenarios>).map((key) => {
              const meta = SCENARIO_LABELS[key];
              const active = scenarios[key];
              return (
                <button
                  key={key}
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/5 px-3 py-2.5 text-left hover:bg-white/10"
                >
                  <span>
                    <span className="block text-xs font-semibold">{meta.label}</span>
                    <span className="block text-[11px] text-white/50">{meta.hint}</span>
                  </span>
                  <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", active ? "bg-accent" : "bg-white/15")}>
                    <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform", active ? "translate-x-4" : "translate-x-0.5")} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs font-semibold">Rol sifatida kirish</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => loginAsRole(role)}
                  disabled={switching !== null}
                  className="rounded-xl bg-white/5 px-2.5 py-2 text-left text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                >
                  {switching === role ? "..." : ROLE_LABEL[role]}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={resetDb}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-2.5 text-xs font-semibold hover:bg-white/5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Bazani tiklash
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Demo boshqaruv paneli"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-sidebar-bg text-white shadow-2xl transition-transform active:scale-95"
      >
        <FlaskConical className="h-5 w-5" />
      </button>
    </div>
  );
}
