/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_TOKEN: string;
  readonly VITE_HERMES_API_URL: string;
  readonly VITE_HERMES_WEB_TOKEN: string;
  readonly VITE_PUSH_PUBLIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
