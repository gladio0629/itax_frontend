// Real-backend part of OpsAdapter (operator order page, manager requests,
// 2026-11-24). None of these endpoints is in api/openapi.yml yet; the
// expected contract is in docs/backend-gaps.md, "## admin (operator,
// 2026-11-24)". Responses are the OpsAdapter types in snake_case with ISO
// times; `fromWire` converts them. Imported only by adapters/http.ts.
import type { QueryValue } from "@shared/http/client";
import { session } from "../httpSession";
import type { OpsAdapter } from "../ops/adapter";
import type { CallResultOption, ManagerRequestQuery } from "../ops/types";
import type { HistoryResult } from "../types";

/** Results the current contract accepts: complete(result) plus the reject
 * endpoint, which requires a reason. Replaced by GET
 * /admin/v1/operator/call-results once the server has it (backend-gaps). */
const CONTRACT_RESULTS: HistoryResult[] = ["resolved", "no_answer", "callback", "escalated", "rejected"];

const http = session.http;
const enc = encodeURIComponent;

const OP_ORDER = (id: string) => `/admin/v1/operator/orders/${enc(id)}`;
const REQUESTS = "/admin/v1/requests";
const REQUEST = (id: string) => `${REQUESTS}/${enc(id)}`;

const isTimeKey = (k: string) => k === "at" || k === "until" || k.endsWith("_at");
const camel = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** snake_case → camelCase keys; ISO times (`at`, `until`, `*_at`) → epoch ms. */
function fromWire<T>(value: unknown): T {
  const walk = (v: unknown, key?: string): unknown => {
    if (Array.isArray(v)) return v.map((x) => walk(x));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) out[camel(k)] = walk(x, k);
      return out;
    }
    if (key && isTimeKey(key) && typeof v === "string") {
      const t = Date.parse(v);
      return Number.isNaN(t) ? null : t;
    }
    return v;
  };
  return walk(value) as T;
}

function listQuery(q: Partial<ManagerRequestQuery>): Record<string, QueryValue> {
  const pick = (v: string | undefined) => (v && v !== "all" ? v : undefined);
  return { status: pick(q.status), type: pick(q.type), operator_id: pick(q.operatorId), period: pick(q.period) };
}

export const httpOps: OpsAdapter = {
  async getCallResults() {
    return CONTRACT_RESULTS.map((result): CallResultOption => ({ result, reasonRequired: result === "rejected" }));
  },

  async getOpOrder(id) {
    return fromWire(await http.get(OP_ORDER(id)));
  },
  async restartOrderSearch(id) {
    return fromWire(await http.post(`${OP_ORDER(id)}/restart-search`));
  },
  async opCancelOrder(id, reason, comment) {
    const c = comment?.trim();
    return fromWire(await http.post(`${OP_ORDER(id)}/cancel`, { reason, ...(c ? { comment: c } : {}) }));
  },

  async getRequestForm(kind, id) {
    return fromWire(await http.get(`${REQUESTS}/form`, { subject_kind: kind, subject_id: id }));
  },
  async createManagerRequest(input) {
    const body = {
      subject_kind: input.subjectKind,
      subject_id: input.subjectId,
      type: input.type,
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.orderId ? { order_id: input.orderId } : {}),
      reason: input.reason.trim(),
    };
    return fromWire(await http.post(REQUESTS, body));
  },
  async getMyRequests(query) {
    return fromWire(await http.get(`${REQUESTS}/mine`, listQuery(query)));
  },
  async getMyTasksSummary() {
    return fromWire(await http.get(`${REQUESTS}/mine/summary`));
  },

  async getManagerRequests(query) {
    return fromWire(await http.get(REQUESTS, listQuery(query)));
  },
  async getManagerRequestCounts(query) {
    return fromWire(await http.get(`${REQUESTS}/counts`, listQuery(query)));
  },
  async getManagerRequestPreview(id) {
    return fromWire(await http.get(`${REQUEST(id)}/preview`));
  },
  async approveManagerRequest(id) {
    return fromWire(await http.post(`${REQUEST(id)}/approve`));
  },
  async rejectManagerRequest(id, reason) {
    return fromWire(await http.post(`${REQUEST(id)}/reject`, { reason: reason.trim() }));
  },
};
