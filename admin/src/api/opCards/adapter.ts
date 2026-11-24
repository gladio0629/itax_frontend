import type { OpPassengersPage, OpPassengersQuery, OpSearchResult } from "./types";

/**
 * Operator windows: search, passengers, passenger card, driver card
 * (doc 2.5 "Operator huquqlari", 2026-11-24). Part of ApiAdapter; kept in
 * its own file so other terminals' adapter changes do not conflict.
 * Endpoints: docs/backend-gaps.md "## admin (operator, 2026-11-24)".
 */
export interface OpCardsApi {
  /** Phone, name, order ID or plate; results grouped by kind. */
  opSearch(query: string): Promise<OpSearchResult>;
  /** "Yo'lovchilar" window: server-side search, status filter and pages. */
  getOpPassengers(query: OpPassengersQuery): Promise<OpPassengersPage>;
}
