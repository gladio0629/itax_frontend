import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Car, ClipboardList, Loader2, Search, UserRound, UsersRound } from "lucide-react";
import { api } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/cn";
import type { GlobalSearchHit, GlobalSearchKind } from "@/api/types";

const KIND: Record<GlobalSearchKind, { label: string; icon: typeof Car }> = {
  order: { label: "Buyurtma", icon: ClipboardList },
  driver: { label: "Haydovchi", icon: Car },
  passenger: { label: "Yo'lovchi", icon: UserRound },
  staff: { label: "Xodim", icon: UsersRound },
};

/** Where a hit opens. Detail routes arrive with groups 3 and 5; until then
 * the list page with its search prefilled (order id, or the person's name,
 * which is what those lists search by). */
export function searchHitPath(hit: GlobalSearchHit): string {
  const q = `?q=${encodeURIComponent(hit.kind === "order" ? hit.id : hit.title)}`;
  switch (hit.kind) {
    case "order":
      return `/orders${q}`;
    case "driver":
      return `/drivers${q}`;
    case "passenger":
      return `/passengers${q}`;
    case "staff":
      return `/staff${q}`;
  }
}

/** Header search (combobox): results come from api.globalSearch, which
 * returns only what the current admin may see. */
export function GlobalSearch({ className }: { className?: string }) {
  const navigate = useNavigate();
  const listId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<GlobalSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef<HTMLDivElement>(null);
  const q = useDebouncedValue(text.trim(), 250);

  useEffect(() => {
    if (q.length < 2) {
      setHits([]);
      setFailed(false);
      return;
    }
    let live = true;
    setLoading(true);
    api
      .globalSearch(q)
      .then((r) => live && (setHits(r), setFailed(false), setActive(-1)))
      .catch(() => live && (setHits([]), setFailed(true)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [q]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function go(hit: GlobalSearchHit) {
    setOpen(false);
    setText("");
    navigate(searchHitPath(hit));
  }

  const showList = open && q.length >= 2;

  return (
    <div ref={box} className={cn("relative", className)}>
      <label className="flex h-11 w-full items-center gap-2.5 rounded-full bg-surface px-3.5 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--ink),0_0_0_4px_var(--green-soft)]">
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" aria-hidden /> : <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
        <input
          type="search"
          role="combobox"
          aria-label="Umumiy qidiruv"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          placeholder="Qidirish: ID, telefon, ism"
          autoComplete="off"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(hits.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(-1, i - 1));
            } else if (e.key === "Enter" && active >= 0 && hits[active]) {
              e.preventDefault();
              go(hits[active]);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-ink shadow-none outline-none placeholder:font-medium placeholder:text-muted focus-visible:shadow-none"
        />
      </label>
      {showList && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-field bg-white shadow-pop animate-fade-in">
          <ul id={listId} role="listbox" aria-label="Qidiruv natijalari" className="max-h-[360px] overflow-y-auto p-1.5">
            {hits.map((h, i) => {
              const K = KIND[h.kind];
              return (
                <li
                  key={`${h.kind}-${h.id}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(h)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex min-h-12 cursor-pointer items-center gap-3 rounded-box px-3 py-2", i === active && "bg-surface")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface text-ink">
                    <K.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-bold text-ink">{h.title}</span>
                    <span className="truncate text-xs font-semibold text-muted">{h.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-2xs font-bold uppercase tracking-[0.6px] text-muted">{K.label}</span>
                </li>
              );
            })}
          </ul>
          {!loading && hits.length === 0 && (
            <p role="status" className="px-4 py-4 text-13 font-semibold text-muted">
              {failed ? "Qidirib bo'lmadi. Qayta urinib ko'ring." : "Hech narsa topilmadi."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
