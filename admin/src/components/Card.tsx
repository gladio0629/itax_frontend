import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = HTMLAttributes<HTMLElement> & {
  padded?: boolean;
  as?: "div" | "section";
};

/** v2 white card: radius 20, faint shadow, no border. */
export function Card({ className, padded = true, as: Tag = "section", ...rest }: Props) {
  return <Tag className={cn("min-w-0 rounded-card bg-white shadow-card", padded && "p-5", className)} {...rest} />;
}

/** Section heading inside a card: 16px / 800, optional sub line and right slot. */
export function CardTitle({
  children,
  sub,
  right,
  className,
}: {
  children: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-base font-extrabold text-ink">{children}</h2>
        {sub && <span className="text-13 font-semibold text-muted">{sub}</span>}
      </div>
      {right}
    </div>
  );
}

/** KPI tile: caps label, big number, optional unit, optional delta line
 * (the delta text and its direction come from the server). */
export function StatTile({
  label,
  value,
  unit,
  delta,
  spark,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { text: string; direction: "up" | "down" | "flat"; hint?: string } | null;
  /** Server series for the small trend line (oldest first). */
  spark?: number[] | null;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-1 flex-col gap-3 px-5 py-[18px]", className)}>
      <span className="label-caps text-muted">{label}</span>
      <span className="flex items-end justify-between gap-2.5">
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="tabular whitespace-nowrap text-30 font-extrabold tracking-[-0.5px] text-ink">
          {value}
          {unit && <span className="ml-1 text-sm font-bold text-muted">{unit}</span>}
        </span>
        {delta && (
          <span className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "whitespace-nowrap font-extrabold",
                delta.direction === "up" ? "text-green-text" : delta.direction === "down" ? "text-error" : "text-muted"
              )}
            >
              {delta.direction === "up" ? "▲ " : delta.direction === "down" ? "▼ " : ""}
              {delta.text}
            </span>
            {delta.hint && <span className="whitespace-nowrap font-semibold text-muted">{delta.hint}</span>}
          </span>
        )}
      </span>
      {spark && spark.length > 1 && <Sparkline values={spark} />}
      </span>
    </Card>
  );
}

/** Tiny trend line (decorative; the numbers are in the tile). */
function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / (max - min || 1)) * (h - 4)}`).join(" ");
  return (
    <svg aria-hidden width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={pts} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
