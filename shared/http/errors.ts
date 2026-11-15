// One error type for all three apps, in both modes. The mock adapter throws
// it with its own codes; the http client maps the contract's error envelope
// `{ "error": { "key", "params" } }` onto it. `code` is the server key
// (e.g. AUTH_OTP_INVALID); `message` is whatever the app's errorMessage()
// returns for it (an i18n key in client/driver, Uzbek text in admin), so the
// UI keeps showing errors the way it already does.

/** No response: offline, DNS/CORS failure, proxy target down, or timeout. */
export const NETWORK_ERROR = "NETWORK_ERROR";
/** A response that isn't the contract's error envelope. */
export const UNKNOWN_ERROR = "UNKNOWN_ERROR";

export type ErrorParams = Record<string, unknown>;

export class ApiError extends Error {
  readonly code: string;
  readonly params: ErrorParams;
  /** HTTP status; 0 when there was no response. */
  readonly status: number;

  constructor(code: string, message?: string, init?: { params?: ErrorParams; status?: number }) {
    super(message ?? code);
    this.name = "ApiError";
    this.code = code;
    this.params = init?.params ?? {};
    this.status = init?.status ?? 0;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Retrying the same action could still succeed (and must reuse its
 * Idempotency-Key): no response at all, or a 5xx. */
export function isRetryable(err: unknown): boolean {
  return isApiError(err) && (err.code === NETWORK_ERROR || err.status >= 500);
}

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/** Parses an error response body. Anything that isn't a well-formed
 * envelope becomes UNKNOWN_ERROR, so the app shows its generic message. */
export function parseErrorBody(body: unknown): { key: string; params: ErrorParams } {
  const err = (body as { error?: { key?: unknown; params?: unknown } } | null)?.error;
  if (err && typeof err.key === "string" && KEY_PATTERN.test(err.key)) {
    const params = err.params && typeof err.params === "object" && !Array.isArray(err.params) ? (err.params as ErrorParams) : {};
    return { key: err.key, params };
  }
  return { key: UNKNOWN_ERROR, params: {} };
}

/** Maps an error key to the text/i18n key the app shows. Apps pass their
 * own; unknown keys must fall back to a generic translated message. */
export type ErrorMessageFn = (key: string, params: ErrorParams) => string;
