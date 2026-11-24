import type {
  OpNote,
  OpNotes,
  OpPassengerBonus,
  OpPassengerCard,
  OpPassengerOrdersPage,
  OpPassengerOrdersQuery,
  OpPassengerPayments,
  OpPassengersPage,
  OpPassengersQuery,
  OpPaymentsQuery,
  OpSearchResult,
  OpSmsInfo,
  OpSmsPeriod,
  OpSubject,
} from "./types";

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

  // --- passenger card ---
  /** Header, tab counters, allowed actions and the "Umumiy" tab. */
  getOpPassenger(id: string): Promise<OpPassengerCard>;
  getOpPassengerOrders(id: string, query: OpPassengerOrdersQuery): Promise<OpPassengerOrdersPage>;
  getOpPassengerPayments(id: string, query: OpPaymentsQuery): Promise<OpPassengerPayments>;
  getOpPassengerBonus(id: string): Promise<OpPassengerBonus>;

  // --- both cards: login SMS and notes ---
  getOpSms(subject: OpSubject, period: OpSmsPeriod): Promise<OpSmsInfo>;
  /** "Limitni ochish": the server checks it is allowed and writes the audit entry. */
  unlockOpSms(subject: OpSubject, period: OpSmsPeriod): Promise<OpSmsInfo>;
  /** "Kodni qayta yuborish". */
  resendOpSmsCode(subject: OpSubject, period: OpSmsPeriod): Promise<OpSmsInfo>;
  /** "Murojaatlar": notes plus the manager requests about this person. */
  getOpNotes(subject: OpSubject): Promise<OpNotes>;
  addOpNote(subject: OpSubject, text: string): Promise<OpNote>;
}
