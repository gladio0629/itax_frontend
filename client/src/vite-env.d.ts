/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. https://api.example.com. Empty: dev proxy / "no server". */
  readonly VITE_API_URL?: string;
  /** "true" = mock adapter with sample data; anything else = the real backend. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
