import type { Place } from "@/api/types";

/** Pickup → dropoff, stacked, with a dotted connector. City is the glance line. */
export function RouteLine({ pickup, dropoff, pickupLabel, dropoffLabel, size = "lg" }: { pickup: Place; dropoff: Place; pickupLabel: string; dropoffLabel: string; size?: "lg" | "md" }) {
  const city = size === "lg" ? "text-lg" : "text-base";
  return (
    <ol className="relative space-y-3">
      <span aria-hidden="true" className="absolute bottom-[22px] left-[7px] top-[22px] border-l-2 border-dotted border-ink/25" />
      {[
        { p: pickup, label: pickupLabel, dot: "bg-yellow ring-4 ring-yellow/20" },
        { p: dropoff, label: dropoffLabel, dot: "bg-ink ring-4 ring-ink/15" },
      ].map(({ p, label, dot }) => (
        <li key={label} className="relative flex items-start gap-3">
          <span aria-hidden="true" className={`mt-1.5 h-4 w-4 shrink-0 rounded-full ${dot}`} />
          <div className="min-w-0">
            <span className="sr-only">{label}: </span>
            <p className={`truncate font-bold text-ink ${city}`}>{p.city.name}</p>
            <p className="truncate text-sm text-muted">{p.address}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
