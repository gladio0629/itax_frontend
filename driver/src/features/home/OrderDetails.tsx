import { useT } from "@/lib/i18n/provider";
import { MessageSquareText } from "@/lib/icons";
import { cn } from "@/lib/cn";

/** The passenger's own words, quoted as typed. */
export function CommentNote({ text, clamp }: { text: string | null; clamp?: boolean }) {
  const { t } = useT();
  if (!text) return null;
  return (
    <figure className="flex gap-2.5 rounded-field bg-raised px-4 py-3">
      <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <figcaption className="text-xs text-muted">{t("order.comment")}</figcaption>
        <blockquote className={cn("break-words text-sm text-ink", clamp && "line-clamp-2")}>{text}</blockquote>
      </div>
    </figure>
  );
}
