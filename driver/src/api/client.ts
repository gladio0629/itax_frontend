import type { ApiAdapter } from "./adapterTypes";
// Resolved at build time (vite.config.ts): adapters/mock.ts when
// VITE_DEMO_MODE=true, adapters/http.ts otherwise — no screen changes.
import { adapter } from "@active-adapter";
import { DEMO_MODE } from "@/config";

export const api: ApiAdapter = adapter;
export const isDemo = DEMO_MODE;
