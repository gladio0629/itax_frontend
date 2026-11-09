import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ className, padded = true, ...rest }: Props) {
  return (
    <div
      className={cn("rounded-2xl bg-card shadow-softer", padded && "p-6", className)}
      {...rest}
    />
  );
}
