import { NavLink } from "react-router-dom";
import { Car, Wallet, History, User } from "lucide-react";
import { cn } from "@/lib/cn";

const ITEMS = [
  { to: "/offers", label: "Buyurtmalar", icon: Car },
  { to: "/wallet", label: "Hamyon", icon: Wallet },
  { to: "/history", label: "Tarix", icon: History },
  { to: "/profile", label: "Profil", icon: User },
];

export function BottomNav() {
  return (
    <nav
      className="flex items-center justify-between border-t border-border bg-card px-6 pt-2"
      style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}
    >
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex min-w-[44px] flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-colors",
              isActive ? "text-accent" : "text-ink/65"
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
