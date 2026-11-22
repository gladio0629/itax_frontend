import { cn } from "@/lib/cn";

/** v2 IZGO wordmark for dark backgrounds: white "IZ"/"O", "G" in the green
 * pin (design-v2/admin/assets, copied to public/). Natural size 84×36. */
export function Logo({ height = 36, className }: { height?: number; className?: string }) {
  const width = Math.round((height * 84) / 36);
  return <img src="/izgo-logo-v2.png" alt="IZGO" width={width} height={height} className={cn("block shrink-0", className)} />;
}

/** Logo + green "ADMIN" pill (sidebar, login). */
export function AdminBrand({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Logo height={compact ? 28 : 36} />
      {!compact && (
        <span className="flex h-6 items-center rounded-full bg-ink-2 px-[9px] text-2xs font-extrabold tracking-[1px] text-green">ADMIN</span>
      )}
    </span>
  );
}
