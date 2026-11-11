import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ className, padded = true, ...rest }: Props) {
  return <div className={cn("rounded-card border border-border bg-card shadow-softer", padded && "p-6", className)} {...rest} />;
}

/** Section heading inside a card: one size/weight everywhere. */
export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-sm font-semibold text-ink", className)}>{children}</h2>;
}
