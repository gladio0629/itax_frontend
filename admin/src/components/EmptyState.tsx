import type { ReactNode } from "react";
import { Button } from "./Button";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, description, actionLabel, onAction }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-card bg-white px-8 py-16 text-center shadow-card animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface text-ink [&_svg]:h-6 [&_svg]:w-6" aria-hidden>
        {icon}
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-base font-extrabold text-ink">{title}</p>
        <p className="text-sm font-medium text-muted">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
