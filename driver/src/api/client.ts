import type { ApiAdapter } from "./adapterTypes";
import { mockAdapter } from "./adapters/mock";
import { httpAdapter } from "./adapters/http";

// Demo mode always uses the mock adapter. To connect a real backend,
// implement adapters/http.ts and set VITE_DEMO_MODE=false — no screen changes.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== "false";

export const api: ApiAdapter = DEMO_MODE ? mockAdapter : httpAdapter;
export const isDemo = DEMO_MODE;
