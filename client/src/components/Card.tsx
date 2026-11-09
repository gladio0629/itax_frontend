import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
  rounded?: "2xl" | "3xl";
};

export function Card({ className, padded = true, rounded = "3xl", ...rest }: Props) {
  return (
    <div
      className={cn(
        "bg-card shadow-softer",
        rounded === "3xl" ? "rounded-3xl" : "rounded-2xl",
        padded && "p-6",
        className
      )}
      {...rest}
    />
  );
}
