import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type Props = {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  right?: ReactNode;
  transparent?: boolean;
};

export function ScreenHeader({ title, onBack, showBack = true, right, transparent }: Props) {
  const navigate = useNavigate();
  return (
    <div
      className="flex items-center justify-between px-4 pb-2"
      style={{ paddingTop: "calc(var(--safe-top) + 16px)" }}
    >
      <div className="flex min-w-[44px] items-center">
        {showBack && (
          <button
            onClick={onBack ?? (() => navigate(-1))}
            aria-label="Orqaga"
            className={
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors " +
              (transparent ? "bg-card/80 backdrop-blur-sm shadow-softer" : "bg-ink/5")
            }
          >
            <ChevronLeft className="h-5 w-5 text-ink" />
          </button>
        )}
      </div>
      {title && <h1 className="flex-1 text-center text-sm font-semibold text-ink">{title}</h1>}
      <div className="flex min-w-[44px] justify-end">{right}</div>
    </div>
  );
}
