import { createApiSession } from "@shared/http/session";
import { apiConfig } from "@/config";

/**
 * The driver app's one backend session (tokens, HTTP client, WebSocket),
 * created once per tab so the refresh single-flight is shared by every call.
 * The access token lives in memory, the refresh token in localStorage; the
 * native app must move the refresh token to the Keychain / Keystore.
 *
 * Error messages: ApiError.code is the contract key (AUTH_OTP_INVALID, …);
 * screens translate it through lib/errors.ts (`error.<code>`, unknown codes
 * → the generic message), so the message itself is just the key.
 */
export const session = createApiSession({
  app: "driver",
  baseUrl: apiConfig.baseUrl,
  errorMessage: (key) => key,
});
