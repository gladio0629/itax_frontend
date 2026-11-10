import { useState } from "react";
import { Sheet } from "@/components/Sheet";
import { Button } from "@/components/Button";
import { useT } from "@/lib/i18n/provider";
import type { TranslationKey } from "@/lib/i18n/uz";
import { cn } from "@/lib/cn";

const REASON_KEYS: TranslationKey[] = [
  "history.reason.polite",
  "history.reason.conversation",
  "history.reason.comfort",
  "history.reason.simple",
];

export function RatingReasonsSheet({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (reasons: string[], note?: string) => void;
}) {
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const [otherSelected, setOtherSelected] = useState(false);
  const [note, setNote] = useState("");

  function toggle(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function submit() {
    const reasons = otherSelected ? [...selected, "other"] : selected;
    onSubmit(reasons, otherSelected ? note.slice(0, 200) : undefined);
  }

  const canSubmit = selected.length > 0 || otherSelected;

  return (
    <Sheet open onClose={onClose} ariaLabel={t("history.reasonsTitle")}>
      <div className="px-5 pb-6 pt-3">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("history.reasonsTitle")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {REASON_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              className={cn(
                "rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-colors",
                selected.includes(key) ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
              )}
            >
              {t(key)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOtherSelected((v) => !v)}
          className={cn(
            "mt-2 w-full rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-colors",
            otherSelected ? "border-accent bg-accent-5 text-accent" : "border-border text-ink/70"
          )}
        >
          {t("history.reason.other")}
        </button>
        {otherSelected && (
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            maxLength={200}
            rows={3}
            placeholder={t("history.reasonNotePlaceholder")}
            className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent"
          />
        )}
        <div className="mt-5">
          <Button fullWidth disabled={!canSubmit} onClick={submit}>
            {t("history.submit")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
