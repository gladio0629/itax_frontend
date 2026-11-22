import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { useT } from "@/lib/i18n/provider";
import { BottomSheet, Icon, type IconName } from "@/ui";
import { cn } from "@/lib/cn";

/** Share the trip: the system share sheet, the clipboard as a fallback. */
export async function shareTrip(orderId: string, t: ReturnType<typeof useT>["t"], onToast: (msg: string) => void) {
  try {
    const link = await api.getTripShareLink(orderId);
    const text = t(link.textKey as Parameters<typeof t>[0], link.params);
    if (navigator.share) {
      try {
        await navigator.share({ title: t("safety.share"), text, url: link.url });
      } catch (e) {
        // The person closed the share sheet: nothing to report.
        if ((e as DOMException).name !== "AbortError") throw e;
      }
    } else {
      await navigator.clipboard.writeText(`${text} ${link.url}`);
      onToast(t("safety.linkCopied"));
    }
  } catch {
    onToast(t("safety.shareError"));
  }
}

function Row({ icon, title, sub, onClick, href, danger }: { icon: IconName; title: string; sub: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = "flex min-h-[68px] items-center gap-3.5 rounded-iz-field bg-iz-field px-3.5 text-left active:opacity-80";
  const body = (
    <>
      <span aria-hidden className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-iz-tile", danger ? "bg-iz-sos text-iz-head-text" : "bg-iz-sheet text-iz-ink")}>
        <Icon name={icon} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-extrabold text-iz-ink">{title}</span>
        <span className="line-clamp-2 text-[12px] text-iz-muted">{sub}</span>
      </span>
      <Icon name="chevronRight" size={18} className="shrink-0 text-iz-muted" />
    </>
  );
  return href ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  );
}

/**
 * SOS during a trip: call support (the server's number, as a phone link)
 * and share the trip.
 */
export function SafetySheet({ orderId, onClose, onToast }: { orderId: string; onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useT();
  const [support, setSupport] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    api.getSupportContact().then((s) => setSupport(s.phone)).catch(() => {});
  }, []);

  return (
    <BottomSheet open onClose={onClose} title={t("safety.button")} closeLabel={t("common.close")}>
      <Row
        icon="support"
        danger
        title={t("safety.support")}
        sub={support ? `${t("safety.supportDesc")} · ${support}` : t("safety.supportDesc")}
        href={support ? `tel:${support.replace(/[^\d+]/g, "")}` : undefined}
        onClick={() => onToast(t("safety.callUnavailable"))}
      />
      <Row
        icon="share"
        title={t("safety.share")}
        sub={t("safety.shareDesc")}
        onClick={async () => {
          if (sharing) return;
          setSharing(true);
          await shareTrip(orderId, t, onToast);
          setSharing(false);
        }}
      />
    </BottomSheet>
  );
}
