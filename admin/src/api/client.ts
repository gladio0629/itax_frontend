import type { ApiAdapter } from "./adapterTypes";
// Resolved at build time (vite.config.ts): adapters/mock.ts when
// VITE_DEMO_MODE=true, adapters/http.ts otherwise. Screens only ever see
// this `api` object, so no screen or component changes between the two.
import { adapter } from "@active-adapter";

export const api: ApiAdapter = adapter;
