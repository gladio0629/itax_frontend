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
    <div className="flex flex-col items-center justify-center gap-4 px-8 py-16 text-center animate-fade-in">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-5 text-accent">
        {icon}
      </div>
      <div className="space-y-1">
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
