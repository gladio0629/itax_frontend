import { useEffect, useState } from "react";
import { FlaskConical, RotateCcw, X } from "@/lib/icons";
import { useTestScenarios, type TestScenarios } from "@/stores/testScenariosStore";
import { useFloatingControl } from "@/stores/floatingControlStore";
import { Switch } from "@/components/Switch";
import { useModalOpen } from "@/lib/useModalOpen";
import { detectedPlatform, readPlatformOverride, setPlatformOverride, type PlatformOverride } from "@/lib/platform";
import { cn } from "@/lib/cn";

const PANEL_TITLE = "Sinov paneli";

const SCENARIO_LABELS: Record<keyof TestScenarios, { label: string; hint: string }> = {
  noDriverFound: { label: "Haydovchi topilmadi", hint: "Buyurtma qidiruvi muvaffaqiyatsiz tugaydi" },
  slowInternet: { label: "Sekin internet", hint: "Barcha so'rovlar sezilarli kechikadi" },
  forceErrors: { label: "Xatoliklarni qaytarish", hint: "So'rovlar ko'pincha xato bilan tugaydi" },
  walletLimit: { label: "Hamyon limiti", hint: "Balans -50 000 so'mga yetdi deb hisoblanadi" },
  fastForward: { label: "Vaqtni tezlashtirish", hint: "Kutish vaqtlari qisqartiriladi" },
  holdStatus: { label: "Holatni to'xtatish", hint: "Safar joriy holatida qoladi, keyingisiga o'tmaydi" },
  bonusBelowMin: { label: "Bonus minimal darajadan past", hint: "Bonusni yechib bo'lmaydi deb hisoblanadi" },
  newPassenger: { label: "Yangi yo'lovchi", hint: "Saqlangan manzil va oxirgi yo'nalishlar yo'q" },
};

const PLATFORM_OPTIONS: { id: PlatformOverride; label: string }[] = [
  { id: "auto", label: "Avto" },
  { id: "ios", label: "iOS" },
  { id: "standard", label: "Standart" },
];

/** Avto / iOS / Standart — forces the iOS interface on desktop (applies with a reload). */
function PlatformToggle() {
  const current = readPlatformOverride();
  const detected = detectedPlatform() === "ios" ? "iOS" : "Standart";
  return (
    <div className="mb-3 rounded-xl bg-white/5 px-3 py-2.5">
      <p className="mb-2 flex items-baseline justify-between gap-2 text-xs font-semibold">
        <span id="test-platform-label">Platforma</span>
        <span className="text-[11px] font-normal text-white/70">Qurilma: {detected}</span>
      </p>
      <div role="radiogroup" aria-labelledby="test-platform-label" className="grid grid-cols-3 gap-1 rounded-lg bg-white/10 p-0.5">
        {PLATFORM_OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={current === o.id}
            onClick={() => current !== o.id && setPlatformOverride(o.id)}
            className={cn(
              "min-h-[36px] rounded-md text-xs font-semibold transition-colors",
              current === o.id ? "bg-white text-[#13201c]" : "text-white/80 hover:bg-white/10"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
 * Floating test panel. Loaded lazily by App.tsx only when VITE_DEMO_MODE=true,
 * so the http build never contains it. On a desktop preview it sits outside
 * the phone mockup and never overlaps the app. Full-screen on a phone it
 * would, so there it steps aside: hidden while a modal sheet/drawer or the
 * expanded order flow is open, lifted above the home sheet and any registered
 * footer (useLiftFloatingControl), and scroll areas reserve room for it via
 * --fab-clearance (set in PhoneFrame).
 */
export function TestControlPanel() {
  const { scenarios, toggle, resetDb } = useTestScenarios();
  const { fabHidden, fabBottomPx } = useFloatingControl();
  const [open, setOpen] = useState(false);
  const wide = useWideViewport();
  const modalOpen = useModalOpen();

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
        <div className="max-h-[calc(100dvh-96px)] w-72 max-w-[calc(100vw-32px)] overflow-y-auto overscroll-contain rounded-2xl bg-[#13201c] p-4 text-white shadow-2xl animate-slide-up" role="dialog" aria-label={PANEL_TITLE}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">{PANEL_TITLE}</p>
            <button onClick={() => setOpen(false)} aria-label="Yopish" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <PlatformToggle />
          <div className="space-y-2">
            {(Object.keys(SCENARIO_LABELS) as Array<keyof TestScenarios>).map((key) => {
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
        aria-label={PANEL_TITLE}
        aria-expanded={open}
        className="flex h-11 items-center gap-1.5 rounded-full bg-[#13201c] pl-3 pr-3.5 text-white shadow-2xl ring-1 ring-white/20 transition-transform active:scale-95"
      >
        <FlaskConical className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-semibold uppercase tracking-wide">Sinov</span>
      </button>
    </div>
  );
}
