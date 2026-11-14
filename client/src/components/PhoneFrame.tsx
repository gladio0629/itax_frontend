import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useDemoStore } from "@/stores/demoStore";
import { useIsIOS } from "@/lib/platform";

// Desktop preview of the iOS interface: an iPhone 15-sized mockup that
// simulates its safe-area insets (status bar / Dynamic Island, home indicator).
const IOS_PREVIEW_INSETS = { "--safe-top": "59px", "--safe-bottom": "34px" } as CSSProperties;

/**
 * On a real phone this renders full-screen. On a wider viewport (desktop
 * preview) the app is centered inside a 390x844 phone mockup so reviewers
 * can see the whole screen at once.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const [isNarrow, setIsNarrow] = useState(true);
  const isDemo = useDemoStore((s) => s.isDemo);
  const ios = useIsIOS();

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setIsNarrow(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isNarrow) {
    // Full-screen, the floating demo control shares the viewport with the app:
    // scroll areas (.scroll-pb / .scroll-pb-bar) reserve room so their last
    // item can always scroll clear of it.
    const clearance = (isDemo ? { "--demo-clearance": "44px", "--demo-clearance-bar": "48px" } : {}) as CSSProperties;
    return (
      <div
        className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-bg ios:pl-[var(--safe-left)] ios:pr-[var(--safe-right)]"
        style={clearance}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0b1512] py-10">
      {ios ? (
        <div
          className="relative h-[864px] w-[405px] overflow-hidden rounded-[60px] border-[6px] border-[#1c2420] bg-bg shadow-2xl"
          style={IOS_PREVIEW_INSETS}
        >
          <div className="pointer-events-none absolute left-1/2 top-[11px] z-[60] h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
          <div className="relative h-full w-full overflow-hidden">{children}</div>
          <div className="pointer-events-none absolute bottom-2 left-1/2 z-[60] h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-ink" />
        </div>
      ) : (
        <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[48px] border-[6px] border-[#1c2420] bg-bg shadow-2xl">
          <div className="absolute left-1/2 top-0 z-30 h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-[#1c2420]" />
          <div className="relative h-full w-full overflow-hidden">{children}</div>
          <div className="absolute bottom-2 left-1/2 z-30 h-1 w-32 -translate-x-1/2 rounded-full bg-ink/20" />
        </div>
      )}
    </div>
  );
}
