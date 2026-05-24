// Configuration file reading VITE_HERMES environment variables.

const rawApiUrl = import.meta.env.VITE_HERMES_API_URL || import.meta.env.VITE_API_URL || 'https://fi.gisketch.com';
// Strip trailing slash if present
export const HERMES_API_URL = rawApiUrl.replace(/\/$/, '');

export const HERMES_WEB_TOKEN = import.meta.env.VITE_HERMES_WEB_TOKEN || import.meta.env.VITE_API_TOKEN || '';

type HermesRuntimeConfig = {
  ok?: boolean;
  apiUrl?: string;
  webToken?: string;
};

let runtimeConfigPromise: Promise<HermesRuntimeConfig | null> | null = null;

export const getHermesWebToken = async () => {
  if (HERMES_WEB_TOKEN) return HERMES_WEB_TOKEN;
  if (typeof window === 'undefined') return HERMES_WEB_TOKEN;

  runtimeConfigPromise ||= fetch('/runtime-api/hermes-config', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return null;
      return await response.json() as HermesRuntimeConfig;
    })
    .catch(() => null);

  const runtimeConfig = await runtimeConfigPromise;
  return runtimeConfig?.webToken || HERMES_WEB_TOKEN;
};

export const HERMES_ADMIN_MODE = import.meta.env.VITE_HERMES_ADMIN_MODE || 'proxy';

export const USAGE_URL = import.meta.env.VITE_USAGE_URL || '/usage-api/usage.json';

// Derive WS URL safely handling relative or absolute targets
export const HERMES_WS_URL = (() => {
  const isRelative = HERMES_API_URL.startsWith('/');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://fi.gisketch.com';
  const absoluteUrl = isRelative ? `${origin}${HERMES_API_URL}` : HERMES_API_URL;
  
  try {
    const url = new URL(absoluteUrl);
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${url.host}/api/ws`;
  } catch (e) {
    // Fail-safe default
    console.error('Invalid HERMES_API_URL:', absoluteUrl, e);
    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'fi.gisketch.com';
    return `${wsProtocol}//${host}/api/ws`;
  }
})();

export const validateConfig = () => {
  if (!HERMES_API_URL) {
    console.warn('Hermes API URL is not set.');
  }
  if (!HERMES_WEB_TOKEN) {
    console.warn('Hermes Web Token is empty. Runtime config may still provide it before connecting.');
  }
};
