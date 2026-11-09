import { LogOut, ShieldCheck } from "lucide-react";
import { Avatar } from "./Avatar";
import type { AdminUser } from "@/api/types";

export function Topbar({ title, admin, onLogout }: { title: string; admin: AdminUser | null; onLogout: () => void }) {
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
        {admin && (
          <div className="flex items-center gap-2.5">
            <Avatar seed={admin.avatarSeed} name={admin.name} size={32} />
            <div className="text-right">
              <p className="text-sm font-semibold text-ink leading-tight">{admin.name}</p>
              <p className="text-xs text-ink/50 leading-tight">{admin.role}</p>
            </div>
          </div>
        )}
        <button
          onClick={onLogout}
          aria-label="Chiqish"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
