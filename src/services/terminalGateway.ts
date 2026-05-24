export type TerminalSshProfile = {
  host: string;
  port: number;
  user: string;
  password: string;
};

export type TerminalUnlockResponse = {
  ok: boolean;
  token: string;
  expires_at: string;
};

const defaultGatewayUrl = 'https://fi-terminal.gisketch.com';
const terminalTokenKey = 'fi_terminal_gateway_token';
const terminalProfileKey = 'fi_terminal_ssh_profile';

export const TERMINAL_GATEWAY_URL = (
  import.meta.env.VITE_TERMINAL_GATEWAY_URL || defaultGatewayUrl
).replace(/\/+$/, '');

export const defaultTerminalProfile = (): TerminalSshProfile => ({
  host: import.meta.env.VITE_TERMINAL_DEFAULT_HOST || '167.254.240.228',
  port: Number.parseInt(import.meta.env.VITE_TERMINAL_DEFAULT_PORT || '22', 10) || 22,
  user: import.meta.env.VITE_TERMINAL_DEFAULT_USER || 'root',
  password: '',
});

export const terminalStorage = {
  getToken() {
    return window.localStorage.getItem(terminalTokenKey) || '';
  },

  setToken(token: string) {
    window.localStorage.setItem(terminalTokenKey, token);
  },

  clearToken() {
    window.localStorage.removeItem(terminalTokenKey);
  },

  getProfile(): TerminalSshProfile {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(terminalProfileKey) || '{}') as Partial<TerminalSshProfile>;
      return {
        ...defaultTerminalProfile(),
        ...parsed,
        port: Number.isInteger(parsed.port) ? parsed.port as number : defaultTerminalProfile().port,
      };
    } catch {
      return defaultTerminalProfile();
    }
  },

  setProfile(profile: TerminalSshProfile) {
    window.localStorage.setItem(terminalProfileKey, JSON.stringify(profile));
  },
};

const jsonRequest = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${TERMINAL_GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload.error || `Gateway request failed (${response.status})`));
  }

  return payload as T;
};

export class TerminalGatewayClient {
  static async unlock(pin: string): Promise<TerminalUnlockResponse> {
    return jsonRequest<TerminalUnlockResponse>('/auth/unlock', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  }

  static async verify(token: string): Promise<boolean> {
    if (!token) return false;

    try {
      await jsonRequest<{ ok: boolean }>('/auth/verify', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  static terminalWsUrl(token: string): string {
    const url = new URL(TERMINAL_GATEWAY_URL);
    url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
    url.pathname = '/terminal';
    url.search = '';
    url.searchParams.set('token', token);
    return url.toString();
  }
}
