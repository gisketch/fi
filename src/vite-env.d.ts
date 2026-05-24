/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_TOKEN: string;
  readonly VITE_HERMES_API_URL: string;
  readonly VITE_HERMES_WEB_TOKEN: string;
  readonly VITE_PUSH_PUBLIC_KEY: string;
  readonly VITE_TERMINAL_GATEWAY_URL: string;
  readonly VITE_TERMINAL_DEFAULT_HOST: string;
  readonly VITE_TERMINAL_DEFAULT_PORT: string;
  readonly VITE_TERMINAL_DEFAULT_USER: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
