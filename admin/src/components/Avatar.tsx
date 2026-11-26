import { cn } from "@/lib/cn";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** v2 avatar: initials in a circle. "light" = list rows (surface bg, Ink text),
 * "green" = the signed-in staff card in the sidebar. `seed` is kept for the
 * old call sites; v2 avatars are not colour-coded. */
export function Avatar({
  name,
  size = 36,
  tone = "light",
  className,
}: {
  seed?: string;
  name: string;
  size?: number;
  tone?: "light" | "green";
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      style={{ width: size, height: size, fontSize: size >= 64 ? 25 : size >= 40 ? 14 : 12 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-ink",
        tone === "green" ? "bg-green" : "bg-surface",
        className
      )}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  );
}
