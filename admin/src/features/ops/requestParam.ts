import type { RequestSubjectKind } from "@/api/ops/types";

/** `?request=<passenger|driver|order>:<id>` opens "Menejerga so'rov" on any
 * operator page (route contract 2026-11-24). */
export const REQUEST_PARAM = "request";
const KINDS: RequestSubjectKind[] = ["passenger", "driver", "order"];

export const requestParam = (kind: RequestSubjectKind, id: string) => `${kind}:${id}`;

/** Split at the first colon; ids may contain colons themselves. */
export function parseRequestParam(value: string | null): { kind: RequestSubjectKind; id: string } | null {
  if (!value) return null;
  const at = value.indexOf(":");
  if (at < 1) return null;
  const kind = value.slice(0, at) as RequestSubjectKind;
  const id = value.slice(at + 1);
  return KINDS.includes(kind) && id ? { kind, id } : null;
}
