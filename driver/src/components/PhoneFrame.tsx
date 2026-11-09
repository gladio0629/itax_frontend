import { useEffect, useState, type ReactNode } from "react";
import { DemoBadge } from "./DemoBadge";

/**
 * On a real phone this renders full-screen. On a wider viewport (desktop
 * preview) the app is centered inside a 390x844 phone mockup so reviewers
 * can see the whole screen at once.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const [isNarrow, setIsNarrow] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsNarrow(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isNarrow) {
    return (
      <div className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-bg">
        <DemoBadge />
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1512] py-10">
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[48px] border-[6px] border-[#1c2420] bg-bg shadow-2xl">
        <div className="absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#1c2420]" />
        <div className="relative h-full w-full overflow-hidden">
          <DemoBadge />
          {children}
        </div>
        <div className="absolute bottom-2 left-1/2 z-30 h-1 w-32 -translate-x-1/2 rounded-full bg-ink/20" />
      </div>
    </div>
  );
}
