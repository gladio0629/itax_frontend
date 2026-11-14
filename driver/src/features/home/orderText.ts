import type { AddressDetails, OrderOption } from "@/api/types";
import type { TranslationKey } from "@/lib/i18n/provider";

type T = (key: TranslationKey, params?: Record<string, string | number>) => string;

/** "2-podyezd · 5-qavat · 34-kvartira" — only the parts the passenger filled in. */
export function detailsText(d: AddressDetails, t: T): string {
  return [
    d.entrance && t("addr.entrance", { v: d.entrance }),
    d.floor && t("addr.floor", { v: d.floor }),
    d.apartment && t("addr.apartment", { v: d.apartment }),
  ]
    .filter(Boolean)
    .join(" · ");
}

export function optionLabel(o: OrderOption, t: T): string {
  return o.kind === "child_seat" ? t("option.child_seat", { age: t(`childAge.${o.ageGroup}`) }) : t(`option.${o.kind}`);
}
