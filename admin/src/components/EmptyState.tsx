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
    <div className="flex flex-col items-center justify-center gap-4 rounded-card border border-dashed border-ink/15 bg-card px-8 py-16 text-center animate-fade-in">
      {/* Soft layered "illustration": icon on a tinted tile with a yellow accent dot. */}
      <div className="relative">
        <div className="flex h-16 w-16 items-center justify-center rounded-card bg-accent-5 text-accent [&_svg]:h-6 [&_svg]:w-6">{icon}</div>
        <span aria-hidden className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-card bg-brand-yellow" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-sm text-ink/60">{description}</p>
      </div>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
