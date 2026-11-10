import { useEffect, useState } from "react";
import { FlaskConical, RotateCcw, X } from "@/lib/icons";
import { useDemoStore, type DemoScenarios } from "@/stores/demoStore";
import { Switch } from "@/components/Switch";
import { useModalOpen } from "@/lib/useModalOpen";

const SCENARIO_LABELS: Record<keyof DemoScenarios, { label: string; hint: string }> = {
  noDriverFound: { label: "Haydovchi topilmadi", hint: "Buyurtma qidiruvi muvaffaqiyatsiz tugaydi" },
  slowInternet: { label: "Sekin internet", hint: "Barcha so'rovlar sezilarli kechikadi" },
  forceErrors: { label: "Xatoliklarni qaytarish", hint: "So'rovlar ko'pincha xato bilan tugaydi" },
  walletLimit: { label: "Hamyon limiti", hint: "Balans -50 000 so'mga yetdi deb hisoblanadi" },
  fastForward: { label: "Vaqtni tezlashtirish", hint: "Kutish vaqtlari qisqartiriladi" },
  bonusBelowMin: { label: "Bonus minimal darajadan past", hint: "Bonusni yechib bo'lmaydi deb hisoblanadi" },
};

function useWideViewport() {
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/**
 * Demo-only floating control (also the DEMO marker). On a desktop preview it
 * sits outside the phone mockup and never overlaps the app. Full-screen on a
 * phone it would, so there it steps aside: hidden while a modal sheet/drawer
 * or the expanded order flow is open, lifted above the home sheet and any
 * registered footer (useLiftDemoFab), and scroll areas reserve room for it
 * via --demo-clearance (set in PhoneFrame).
 */
export function DemoControlPanel() {
  const { isDemo, scenarios, toggle, resetDb, fabHidden, fabBottomPx } = useDemoStore();
  const [open, setOpen] = useState(false);
  const wide = useWideViewport();
  const modalOpen = useModalOpen();

  if (!isDemo) return null;
  if (!wide && !open && (fabHidden || modalOpen)) return null;

  // Desktop preview: bottom-right of the window, outside the phone mockup.
  // Full-screen phone: just above a registered footer/sheet, else above the home indicator.
  const bottom = wide
    ? "84px"
    : fabBottomPx != null
    ? `${fabBottomPx + 12}px`
    : "calc(var(--safe-bottom) + 16px)";

  return (
    <div className="fixed right-4 z-50 flex flex-col items-end gap-3" style={{ bottom }}>
      {open && (
        <div className="w-72 max-w-[calc(100vw-32px)] rounded-2xl bg-[#13201c] p-4 text-white shadow-2xl animate-slide-up" role="dialog" aria-label="Demo boshqaruv paneli">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Demo boshqaruv paneli</p>
            <button onClick={() => setOpen(false)} aria-label="Yopish" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {(Object.keys(SCENARIO_LABELS) as Array<keyof DemoScenarios>).map((key) => {
              const meta = SCENARIO_LABELS[key];
              return (
                <div key={key} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-3 py-2.5">
                  <span>
                    <span className="block text-xs font-semibold">{meta.label}</span>
                    <span className="block text-[11px] text-white/70">{meta.hint}</span>
                  </span>
                  <Switch checked={scenarios[key]} onChange={() => toggle(key)} label={meta.label} />
                </div>
              );
            })}
          </div>
          <button
            onClick={resetDb}
            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 text-xs font-semibold hover:bg-white/5"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Bazani tiklash
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Demo boshqaruv paneli"
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 rounded-full bg-[#13201c] pl-3 pr-3.5 text-white shadow-2xl ring-1 ring-white/20 transition-transform active:scale-95"
      >
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide">Demo</span>
      </button>
    </div>
  );
}
