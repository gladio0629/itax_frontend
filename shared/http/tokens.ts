// Token storage.
// - client / driver: access token in memory only, refresh token in
//   localStorage (wrapped in try/catch: private mode or blocked storage
//   just means "log in again"). Native apps must move the refresh token to
//   the Keychain / Keystore.
// - admin: both in memory only (and the contract gives admin no refresh
//   token), so a reload or logout means a full login again.
// Nothing here ever logs a token.

export type TokenInput = { access_token: string; refresh_token?: string; expires_in?: number };

export type TokenStore = {
  getAccess(): string | null;
  getRefresh(): string | null;
  /** True when the access token is missing or within 30 s of expiry. */
  accessExpired(now?: number): boolean;
  set(tokens: TokenInput, now?: number): void;
  clear(): void;
  /** Anything to resume or use: an access or a refresh token. */
  hasSession(): boolean;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const EXPIRY_SKEW_MS = 30_000;

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export function createTokenStore(opts: { refreshStorageKey: string | null; storage?: StorageLike | null }): TokenStore {
  const storage = opts.refreshStorageKey ? (opts.storage === undefined ? defaultStorage() : opts.storage) : null;
  const key = opts.refreshStorageKey;
  let access: string | null = null;
  let expiresAt = 0;
  let refreshInMemory: string | null = null;

  const readRefresh = (): string | null => {
    if (refreshInMemory) return refreshInMemory;
    if (!storage || !key) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };

  const writeRefresh = (value: string | null) => {
    refreshInMemory = value;
    if (!storage || !key) return;
    try {
      if (value) storage.setItem(key, value);
      else storage.removeItem(key);
    } catch {
      /* storage unavailable: kept in memory for this tab only */
    }
  };

  return {
    getAccess: () => access,
    getRefresh: readRefresh,
    accessExpired: (now = Date.now()) => !access || (expiresAt > 0 && now >= expiresAt),
    set(tokens, now = Date.now()) {
      access = tokens.access_token;
      expiresAt = tokens.expires_in ? now + tokens.expires_in * 1000 - EXPIRY_SKEW_MS : 0;
      // The refresh token rotates: persist the new one before anything retries.
      if (tokens.refresh_token) writeRefresh(tokens.refresh_token);
    },
    clear() {
      access = null;
      expiresAt = 0;
      writeRefresh(null);
    },
    hasSession: () => Boolean(access || readRefresh()),
  };
}
