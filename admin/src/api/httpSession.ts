// The admin app's one backend session (tokens in memory only — a reload or
// logout means a full login again; AdminToken has no refresh token and
// staff tokens get no WebSocket). Imported by the http adapter only.
import { createApiSession } from "@shared/http/session";
import { apiConfig } from "@/config";
import { adminErrorMessage } from "./httpErrors";

export const session = createApiSession({
  app: "admin",
  baseUrl: apiConfig.baseUrl,
  errorMessage: adminErrorMessage,
});
