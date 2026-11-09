import type { ApiAdapter } from "./adapterTypes";
import { mockAdapter } from "./adapters/mock";
import { httpAdapter } from "./adapters/http";

// In demo mode we always talk to the mock adapter. To connect a real
// backend, implement every method in adapters/http.ts and flip this flag
// (VITE_DEMO_MODE=false) — no screen or component needs to change.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

export const api: ApiAdapter = DEMO_MODE ? mockAdapter : httpAdapter;
