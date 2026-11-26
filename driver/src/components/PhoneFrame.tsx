import { useEffect, useState, type ReactNode } from "react";

/**
 * Full-screen on a phone. On a wide desktop viewport the app is centred in a
 * 390×844 frame so reviewers see the whole screen.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const [wide, setWide] = useState(() => window.matchMedia("(min-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!wide) {
    return <div className="relative mx-auto h-[100dvh] w-full max-w-[480px] overflow-hidden bg-bg">{children}</div>;
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-night py-8">
      <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[44px] bg-bg shadow-2 ring-[6px] ring-night-line">
        {children}
      </div>
    </div>
  );
}
