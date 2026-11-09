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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-8">
      <div>
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 rounded-full bg-accent-5 px-3 py-1.5 text-xs font-semibold text-accent">
          <ShieldCheck className="h-3.5 w-3.5" />
          Xavfsiz kirish
        </span>
        {me && (
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-2.5 rounded-2xl px-2 py-1.5 hover:bg-ink/5"
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <Avatar seed={me.avatarSeed} name={me.name} size={32} />
              <div className="text-right">
                <p className="text-sm font-semibold text-ink leading-tight">{me.name}</p>
                <p className="text-xs text-ink/50 leading-tight">{ROLE_LABEL[me.role]}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-ink/40" />
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl bg-card py-1.5 shadow-2xl ring-1 ring-border animate-fade-in"
              >
                <Link
                  to="/account"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink hover:bg-ink/5"
                >
                  <UserRound className="h-4 w-4 text-ink/50" /> Profil
                </Link>
                <button
                  role="menuitem"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-danger hover:bg-danger/10"
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
