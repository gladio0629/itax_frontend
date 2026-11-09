import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { useAuthStore } from "@/stores/authStore";
import { RouteIllustration, PriceIllustration, TrustIllustration } from "./illustrations";

const SLIDES = [
  {
    Illustration: RouteIllustration,
    title: "Shaharlar aro qulay sayohat",
    description: "IZGO bilan O'zbekiston bo'ylab istalgan shaharga tez va qulay yetib boring.",
  },
  {
    Illustration: PriceIllustration,
    title: "Narxni oldindan bilib oling",
    description: "Yo'l boshlanishidan oldin aniq narxni ko'rasiz — hech qanday yashirin to'lov yo'q.",
  },
  {
    Illustration: TrustIllustration,
    title: "Ishonchli haydovchilar",
    description: "Barcha haydovchilar hujjatlari tekshirilgan va yo'lovchilar tomonidan baholangan.",
  },
];

export function OnboardingScreen() {
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
      <div className="flex justify-end">
        {!isLast && (
          <button onClick={finish} className="text-sm font-medium text-ink/60 h-11 px-2">
            O'tkazib yuborish
          </button>
        )}
      </div>

      <div key={index} className="flex flex-1 flex-col items-center justify-center gap-10 animate-fade-in">
        <div className="h-56 w-56">
          <slide.Illustration />
        </div>
        <div className="space-y-3 text-center">
          <h1 className="text-xl font-semibold text-ink">{slide.title}</h1>
          <p className="mx-auto max-w-[280px] text-sm text-ink/60">{slide.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pb-6">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index ? "w-6 bg-accent" : "w-2 bg-ink/15"
            )}
          />
        ))}
      </div>

      <div style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
        <Button
          fullWidth
          onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
        >
          {isLast ? "Boshlash" : "Davom etish"}
        </Button>
      </div>
    </div>
  );
}
