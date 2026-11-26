/**
 * Operator routes (shared route contract, 2026-11-24). The app already had
 * operator windows under /operators, so the contract's /op/* tails live
 * under that prefix: /operators/queue, /operators/orders/:id, ...
 * /op/* links redirect here (routes.tsx), so either form works.
 */
export const OP_BASE = "/operators";

export const opPath = {
  queue: `${OP_BASE}/queue`,
  search: `${OP_BASE}/search`,
  orders: `${OP_BASE}/orders`,
  order: (id: string) => `${OP_BASE}/orders/${encodeURIComponent(id)}`,
  drivers: `${OP_BASE}/drivers`,
  driver: (id: string, tab?: string) => `${OP_BASE}/drivers/${encodeURIComponent(id)}${tab ? `/${tab}` : ""}`,
  passengers: `${OP_BASE}/passengers`,
  passenger: (id: string, tab?: string) => `${OP_BASE}/passengers/${encodeURIComponent(id)}${tab ? `/${tab}` : ""}`,
  tasks: `${OP_BASE}/tasks`,
};

/** Manager "So'rovlar" page. */
export const REQUESTS_PATH = "/requests";
