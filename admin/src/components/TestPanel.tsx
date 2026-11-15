import { useState } from "react";
import { FlaskConical, RotateCcw, X } from "lucide-react";
import { useScenarioStore, SCENARIOS_KEY, type TestScenarios } from "@/stores/scenarioStore";
import { useAuthStore } from "@/stores/authStore";
import { useMeStore } from "@/stores/meStore";
import { api } from "@/api/client";
import { ALL_ROLES } from "@/mockDb/db";
import { clearAppStorage } from "@/mockDb/storage";
import type { AdminRole } from "@/api/types";
import { ROLE_LABEL } from "./Topbar";
import { cn } from "@/lib/cn";

const SCENARIO_LABELS: Record<keyof TestScenarios, { label: string; hint: string }> = {
  noDriverFound: { label: "Haydovchi topilmadi", hint: "Buyurtma qidiruvi muvaffaqiyatsiz tugaydi" },
  slowInternet: { label: "Sekin internet", hint: "Barcha so'rovlar sezilarli kechikadi" },
  forceErrors: { label: "Xatoliklarni qaytarish", hint: "So'rovlar ko'pincha xato bilan tugaydi" },
  walletLimit: { label: "Hamyon limiti", hint: "Balans -50 000 so'mga yetdi deb hisoblanadi" },
  fastForward: { label: "Vaqtni tezlashtirish", hint: "Kutish vaqtlari qisqartiriladi" },
  shortSession: { label: "Qisqa seans", hint: "Harakatsizlikdan chiqish 20 soniyaga qisqaradi" },
};

function resetDb() {
  clearAppStorage();
  try {
    localStorage.removeItem(SCENARIOS_KEY);
  } catch {
    /* ignore */
  }
  window.location.reload();
}

/**
 * "Sinov paneli" — only in the sample-data build (VITE_DEMO_MODE=true).
 * App.tsx imports it lazily behind that flag, so the real-backend build
 * doesn't contain it at all.
 */
export default function TestPanel() {
  const { scenarios, toggle } = useScenarioStore();
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<AdminRole | null>(null);

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
    <div className="fixed bottom-4 left-3 z-50 flex flex-col items-start gap-3">
      {open && (
        <div className="max-h-[calc(100vh-96px)] w-80 overflow-y-auto overscroll-contain rounded-sheet bg-sidebar-bg p-5 text-white shadow-2xl animate-slide-up">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold">Sinov paneli</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Yopish" className="rounded-full p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            {(Object.keys(SCENARIO_LABELS) as Array<keyof TestScenarios>).map((key) => {
              const meta = SCENARIO_LABELS[key];
              const active = scenarios[key];
              return (
                <button type="button"
                  key={key}
                  onClick={() => toggle(key)}
                  className="flex w-full items-center justify-between gap-3 rounded-button bg-white/5 px-3 py-3 text-left hover:bg-white/10"
                >
                  <span>
                    <span className="block text-xs font-semibold">{meta.label}</span>
                    <span className="block text-xs text-white/50">{meta.hint}</span>
                  </span>
                  <span className={cn("relative h-5 w-9 shrink-0 rounded-full", active ? "bg-brand-yellow" : "bg-white/15")}>
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
                <button type="button"
                  key={role}
                  onClick={() => loginAsRole(role)}
                  disabled={switching !== null}
                  className="rounded-button bg-white/5 px-2 py-2 text-left text-xs font-semibold hover:bg-white/10 disabled:opacity-50"
                >
                  {switching === role ? "…" : ROLE_LABEL[role]}
                </button>
              ))}
            </div>
          </div>

          <button type="button"
            onClick={resetDb}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-button border border-white/15 py-3 text-xs font-semibold hover:bg-white/5"
          >
            <RotateCcw className="h-4 w-4" />
            Bazani tiklash
          </button>
        </div>
      )}
      <button type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Sinov paneli"
        className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-sidebar-bg text-brand-yellow shadow-soft transition-transform active:scale-95"
      >
        <FlaskConical className="h-5 w-5" />
      </button>
    </div>
  );
}
