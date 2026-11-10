import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useLiftDemoFab } from "@/stores/demoStore";

export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLiftDemoFab(ref);
  return (
    <div
      ref={ref}
      className={cn("border-t border-border bg-card/95 px-4 pt-3 backdrop-blur-sm", className)}
      style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
    >
      {children}
    </div>
  );
}
