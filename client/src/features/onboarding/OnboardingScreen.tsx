import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { useT } from "@/lib/i18n/provider";
import { useLiftDemoFab } from "@/stores/demoStore";
import type { TranslationKey } from "@/lib/i18n/uz";
import { RouteIllustration, PriceIllustration, TrustIllustration } from "./illustrations";

const SLIDES = [
  { Illustration: RouteIllustration, titleKey: "onboarding.slide1.title", descKey: "onboarding.slide1.desc" },
  { Illustration: PriceIllustration, titleKey: "onboarding.slide2.title", descKey: "onboarding.slide2.desc" },
  { Illustration: TrustIllustration, titleKey: "onboarding.slide3.title", descKey: "onboarding.slide3.desc" },
] satisfies { Illustration: typeof RouteIllustration; titleKey: TranslationKey; descKey: TranslationKey }[];

export function OnboardingScreen() {
  const footerRef = useRef<HTMLDivElement>(null);
  useLiftDemoFab(footerRef);
  const { t } = useT();
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const completeOnboarding = useAuthStore((s) => s.completeOnboarding);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];

  function finish() {
    completeOnboarding();
    navigate("/auth/phone");
  }

  return (
    <div className="flex h-full flex-col bg-bg px-6" style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}>
      <div className="flex items-center justify-between">
        <Logo size={32} />
        {!isLast && (
          <button onClick={finish} className="text-sm font-normal text-ink/60 h-11 px-2">
            {t("onboarding.skip")}
          </button>
        )}
      </div>

      <div key={index} className="flex flex-1 flex-col items-center justify-center gap-10 animate-fade-in">
        <div className="h-56 w-56">
          <slide.Illustration />
        </div>
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-semibold text-ink">{t(slide.titleKey)}</h1>
          <p className="mx-auto max-w-[280px] text-sm text-ink/60">{t(slide.descKey)}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 rounded-full transition-[width,background-color]",
              i === index ? "w-6 bg-accent" : "w-2 bg-ink/15"
            )}
          />
        ))}
      </div>

      <div ref={footerRef} style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        <Button
          fullWidth
          onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
        >
          {isLast ? t("onboarding.start") : t("auth.continue")}
        </Button>
      </div>
    </div>
  );
}
