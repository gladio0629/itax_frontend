import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { Avatar } from "./Avatar";
import type { AdminRole, Me } from "@/api/types";

export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Super admin",
  owner: "Egasi",
  menejer: "Menejer",
  marketolog: "Marketolog",
  operator: "Operator",
};

export function Topbar({ title, me, onLogout }: { title: string; me: Me | null; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 xl:px-8">
      <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden items-center gap-2 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success lg:flex">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Xavfsiz kirish
        </span>
        {me && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex h-12 items-center gap-3 rounded-button px-2 hover:bg-ink/5"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <Avatar seed={me.avatarSeed} name={me.name} size={32} />
              <div className="text-right">
                <p className="text-sm font-semibold leading-tight text-ink">{me.name}</p>
                <p className="text-xs leading-tight text-ink/60">{ROLE_LABEL[me.role]}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-card bg-card p-1 shadow-soft ring-1 ring-border animate-fade-in"
              >
                <Link
                  to="/account"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex h-10 items-center gap-2 rounded-button px-3 text-sm text-ink hover:bg-ink/5"
                >
                  <UserRound className="h-4 w-4 text-ink/50" /> Profil
                </Link>
                <button
                  type="button"
                  role="menuitem"
                  onClick={onLogout}
                  className="flex h-10 w-full items-center gap-2 rounded-button px-3 text-left text-sm text-danger hover:bg-danger/10"
                >
                  <LogOut className="h-4 w-4" /> Chiqish
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
