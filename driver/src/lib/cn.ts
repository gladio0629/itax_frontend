// Class joiner with a minimal "last one wins" merge for the utility groups
// this app overrides (radius, height, padding, text size/colour, weight,
// background, shadow, ring colour). No tailwind-merge dependency.
type Falsy = false | null | undefined | 0 | "";

// Arbitrary text-[…] counts as a size only when it carries a length unit.
const SIZE = /^text-(xs|sm|base|lg|xl|[234]xl|\[[\d.]+(px|em|rem|%)\])$/;
const ALIGN = /^text-(left|center|right|justify)$/;

function group(cls: string): string | null {
  const i = cls.lastIndexOf(":");
  const variant = i >= 0 ? cls.slice(0, i + 1) : "";
  const base = i >= 0 ? cls.slice(i + 1) : cls;
  let g: string | null = null;
  if (/^rounded(-|$)/.test(base) && !/^rounded-[tblr]{1,2}-/.test(base)) g = "rounded";
  else if (/^h-/.test(base)) g = "h";
  else if (/^px-/.test(base)) g = "px";
  else if (/^py-/.test(base)) g = "py";
  else if (/^p-/.test(base)) g = "p";
  else if (SIZE.test(base)) g = "text-size";
  else if (ALIGN.test(base)) g = "text-align";
  else if (/^text-/.test(base)) g = "text-color";
  else if (/^font-(medium|bold)$/.test(base)) g = "font-weight";
  else if (/^bg-gradient/.test(base)) g = "bg-image";
  else if (/^bg-/.test(base)) g = "bg";
  else if (/^shadow(-|$)/.test(base)) g = "shadow";
  else if (/^ring-(?!\d|inset|offset)/.test(base)) g = "ring-color";
  return g ? variant + g : null;
}

export function cn(...parts: Array<string | Falsy>): string {
  const list = parts.filter(Boolean).join(" ").split(/\s+/).filter(Boolean);
  const seen = new Map<string, number>();
  list.forEach((c, idx) => {
    const g = group(c);
    if (g) seen.set(g, idx);
  });
  return list.filter((c, idx) => {
    const g = group(c);
    return !g || seen.get(g) === idx;
  }).join(" ");
}
