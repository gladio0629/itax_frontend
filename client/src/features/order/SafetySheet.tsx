import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Headphones, Share2, ShieldCheck, Users } from "@/lib/icons";
import type { LucideIcon } from "@/lib/icons";
import { api } from "@/api/client";
import type { EmergencyContacts } from "@/api/types";
import { Sheet } from "@/components/Sheet";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";

/**
 * Safety during an active trip: share it (system share sheet, clipboard as a
 * fallback), emergency contacts (managed in Sozlamalar > Xavfsizlik) and a
 * support call (not dialled yet — shows a note).
 */
export function SafetySheet({ orderId, onClose, onToast }: { orderId: string; onClose: () => void; onToast: (msg: string) => void }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<EmergencyContacts | null>(null);
  const [support, setSupport] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    api.getEmergencyContacts().then(setContacts).catch(() => {});
    api.getSupportContact().then((s) => setSupport(s.phone)).catch(() => {});
  }, []);

  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      const link = await api.getTripShareLink(orderId);
      const text = t(link.textKey as TranslationKey, link.params);
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
    } finally {
      setSharing(false);
    }
  }

  const contactsLine = contacts?.contacts.length
    ? contacts.contacts.map((c) => c.name).join(", ")
    : t("safety.contactsEmpty");
  const rows: { icon: LucideIcon; title: string; subtitle: string; onClick: () => void; tone?: "accent" | "danger" }[] = [
    { icon: Share2, title: t("safety.share"), subtitle: t("safety.shareDesc"), onClick: share },
    {
      icon: Users,
      title: t("safety.contacts"),
      subtitle: contactsLine,
      onClick: () => {
        onClose();
        navigate("/settings/safety");
      },
    },
    {
      icon: Headphones,
      title: t("safety.support"),
      subtitle: support ? `${t("safety.supportDesc")} · ${support}` : t("safety.supportDesc"),
      onClick: () => onToast(t("safety.callUnavailable")),
      tone: "danger",
    },
  ];


  return (
    <Sheet open onClose={onClose} ariaLabel={t("safety.button")}>
      <div className="px-5 pb-2 pt-3">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          <ShieldCheck className="h-5 w-5 text-accent" /> {t("safety.button")}
        </h2>
        <div className="divide-y divide-border">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <button key={r.title} type="button" onClick={r.onClick} className="flex min-h-[64px] w-full items-center gap-3 py-2.5 text-left hover:bg-ink/5">
                <span
                  className={
                    r.tone === "danger"
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"
                      : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-5 text-accent"
                  }
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{r.title}</span>
                  <span className="line-clamp-2 text-xs text-ink/60">{r.subtitle}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink/60" />
              </button>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}
