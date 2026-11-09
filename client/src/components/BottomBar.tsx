import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("border-t border-border bg-card/95 px-4 pt-3 backdrop-blur-sm", className)}
      style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}
    >
      {children}
    </div>
  );
}
