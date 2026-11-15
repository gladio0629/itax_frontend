// Idempotency-Key handling. The contract declares the header on exactly
// three operations: orderCreate, walletTopup and adminWalletCorrection.
// One UUID per user action: retrying the same action (same name, same
// payload) reuses it; a changed payload is a new action and gets a new key,
// because the server answers 409 IDEMPOTENCY_KEY_REUSED for the same key
// with a different body.
import { isRetryable } from "./errors.ts";
import { uuidV4 } from "./uuid.ts";

export type IdempotencyKeys = {
  keyFor(action: string, payload: unknown): string;
  release(action: string): void;
  /** Runs `send` with the action's key. The key survives failures that a
   * retry could fix (no response, 5xx) and is dropped otherwise. */
  run<T>(action: string, payload: unknown, send: (key: string) => Promise<T>): Promise<T>;
};

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
}

export function createIdempotencyKeys(newKey: () => string = uuidV4): IdempotencyKeys {
  const pending = new Map<string, { fingerprint: string; key: string }>();

  const keyFor = (action: string, payload: unknown) => {
    const fingerprint = stableJson(payload);
    const existing = pending.get(action);
    if (existing && existing.fingerprint === fingerprint) return existing.key;
    const key = newKey();
    pending.set(action, { fingerprint, key });
    return key;
  };
  const release = (action: string) => {
    pending.delete(action);
  };

  return {
    keyFor,
    release,
    async run(action, payload, send) {
      const key = keyFor(action, payload);
      try {
        const result = await send(key);
        release(action);
        return result;
      } catch (err) {
        if (!isRetryable(err)) release(action);
        throw err;
      }
    },
  };
}
