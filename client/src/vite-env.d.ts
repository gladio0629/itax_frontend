/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://api.example.com. Empty: dev proxy / "no server". */
  readonly VITE_API_URL?: string;
  /** "true" = mock adapter with sample data; anything else = the real backend. */
  readonly VITE_DEMO_MODE?: string;
  /** Mapbox public token (pk.…) for the interactive map. Empty: the drawn map is used and the build has no Mapbox code. */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
