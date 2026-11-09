import { NavLink } from "react-router-dom";
import { Home, Clock, Wallet, Bell, User } from "lucide-react";
import { cn } from "@/lib/cn";

// Short, single-word labels so all five items fit without wrapping at
// 375px width (each gets ~68px: flex-1 + px-1 + whitespace-nowrap).
const ITEMS = [
  { to: "/home", label: "Asosiy", icon: Home },
  { to: "/history", label: "Tarix", icon: Clock },
  { to: "/wallet", label: "Hamyon", icon: Wallet },
  { to: "/notifications", label: "Xabarlar", icon: Bell },
  { to: "/profile", label: "Profil", icon: User },
];

export function BottomNav() {
  return (
    <nav
      className="flex items-center justify-between border-t border-border bg-card px-1 pt-2"
      style={{ paddingBottom: "calc(var(--safe-bottom) + 8px)" }}
    >
      {ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex min-h-[44px] flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl px-1 py-1.5 text-[11px] font-medium transition-colors active:scale-95",
              isActive ? "text-accent" : "text-ink/60"
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
