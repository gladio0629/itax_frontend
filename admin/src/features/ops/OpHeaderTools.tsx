import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Bell, Search } from "lucide-react";
import { api } from "@/api/client";
import { onSectionBadgesRefresh } from "@/lib/badgeEvents";
import { opPath } from "./paths";

/** Operator header (design OperatorView and the other operator pages):
 * a search box that opens "Qidiruv" (results come from the server there)
 * and a bell to "Mening vazifalarim" with the server's unread count. */
export function OpHeaderTools() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const onSearchPage = pathname === opPath.search;
  const [query, setQuery] = useState(onSearchPage ? params.get("q") ?? "" : "");
  const [unread, setUnread] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => onSectionBadgesRefresh(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    let live = true;
    api
      .getMyNotifications()
      .then((n) => live && setUnread(n.unread))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [pathname, tick]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `${opPath.search}?q=${encodeURIComponent(q)}` : opPath.search);
  }

  return (
    <>
      <form role="search" onSubmit={submit} className="w-[220px] xl:w-[320px]">
        <label className="flex h-11 items-center gap-2.5 rounded-full bg-surface px-3.5 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted" aria-hidden />
          <input
            type="search"
            aria-label="Umumiy qidiruv"
            placeholder="Qidirish: ID, telefon, ism"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
          />
        </label>
      </form>
      <Link
        to={opPath.tasks}
        aria-label={unread ? `Bildirishnomalar, ${unread} ta yangi` : "Bildirishnomalar"}
        title="Bildirishnomalar"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-ink hover:bg-line focus-visible:outline-green"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && <span aria-hidden className="absolute right-2.5 top-2.5 h-[9px] w-[9px] rounded-full border-2 border-surface bg-green" />}
      </Link>
    </>
  );
}
