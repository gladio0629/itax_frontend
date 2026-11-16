// Shared implementation: ../../shared/scripts/check-no-network.mjs
import { loadEnv } from "vite";
import { checkNoNetwork } from "../../shared/scripts/check-no-network.mjs";

// mapbox: this app has the interactive map (only built in with VITE_MAPBOX_TOKEN).
checkNoNetwork({ loadEnv, mapbox: true });
