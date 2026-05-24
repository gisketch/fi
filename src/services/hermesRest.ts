import { HERMES_API_URL, HERMES_WEB_TOKEN, getHermesWebToken } from '../config/hermes';
import { GatewayEvent } from '../types/hermes';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = HERMES_WEB_TOKEN || await getHermesWebToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

async function parseJsonError(response: Response, fallback: string): Promise<Error> {
  const text = await response.text().catch(() => '');
  let message = '';

  if (text) {
    try {
      const err = JSON.parse(text);
      message = err.error?.message || err.message || '';
    } catch {
      message = text.slice(0, 240);
    }
  }

  return new Error(message || `${fallback} (${response.status})`);
}

export class HermesRestClient {
  private static async request<T = any>(
    method: string,
    path: string,
    body?: any,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${HERMES_API_URL}${path}`;
    const headers: Record<string, string> = {
      ...await getAuthHeaders(),
      ...(options.headers as Record<string, string>),
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers: headers as HeadersInit,
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      throw await parseJsonError(response, `HTTP Error ${method} ${path}`);
    }

    return response.json();
  }

  public static async getHealth(): Promise<{ status: string; [key: string]: unknown }> {
    return this.request('GET', '/health');
  }

  // SSE Fallback Stream Consumer
  public static async consumeSSEEvents(
    onEvent: (event: GatewayEvent) => void,
    onClose: () => void,
    onError: (error: Error) => void
  ): Promise<() => void> {
    const controller = new AbortController();
    const url = `${HERMES_API_URL}/v1/events`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...await getAuthHeaders(),
          'Accept': 'text/event-stream',
        } as HeadersInit,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE stream failed: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('Readable stream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Run as background processing
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6).trim();
                if (dataStr === '[DONE]') continue;

                try {
                  const event = JSON.parse(dataStr) as GatewayEvent;
                  onEvent(event);
                } catch (e) {
                  console.error('SSE failed parsing JSON:', dataStr, e);
                }
              }
            }
          }
          onClose();
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            onError(err);
          }
        }
      })();

    } catch (e: any) {
      onError(e);
    }

    return () => {
      controller.abort();
    };
  }

  // REST wrappers
  public static async listSessions(): Promise<any> {
    return this.request('GET', '/v1/sessions');
  }

  public static async createSession(cols?: number): Promise<any> {
    return this.request('POST', '/v1/sessions', { cols });
  }

  public static async getSession(id: string): Promise<any> {
    return this.request('GET', `/v1/sessions/${id}`);
  }

  public static async deleteSession(id: string): Promise<any> {
    return this.request('DELETE', `/v1/sessions/${id}`);
  }

  public static async sendPrompt(sessionId: string, text: string): Promise<any> {
    return this.request('POST', `/v1/sessions/${sessionId}/messages`, { content: text });
  }

  public static async interrupt(sessionId: string): Promise<any> {
    return this.request('POST', `/v1/sessions/${sessionId}/interrupt`);
  }

  public static async steer(sessionId: string, text: string): Promise<any> {
    return this.request('POST', `/v1/sessions/${sessionId}/steer`, { text });
  }

  public static async undo(sessionId: string): Promise<any> {
    return this.request('POST', `/v1/sessions/${sessionId}/undo`);
  }

  public static async respondClarify(requestId: string, answer: string): Promise<any> {
    return this.request('POST', '/v1/clarify', { request_id: requestId, answer });
  }

  public static async respondApproval(sessionId: string, choice: string, all = false): Promise<any> {
    return this.request('POST', '/v1/approval', { session_id: sessionId, choice, all });
  }

  public static async respondSudo(requestId: string, password: string): Promise<any> {
    return this.request('POST', '/v1/sudo', { request_id: requestId, password });
  }

  public static async respondSecret(requestId: string, value: string): Promise<any> {
    return this.request('POST', '/v1/secret', { request_id: requestId, value });
  }

  public static async listCommands(): Promise<any> {
    return this.request('GET', '/v1/commands');
  }

  public static async listModels(): Promise<any> {
    return this.request('GET', '/v1/models');
  }

  public static async listSkills(): Promise<any> {
    return this.request('GET', '/v1/skills');
  }

  public static async listToolsets(): Promise<any> {
    return this.request('GET', '/v1/toolsets');
  }

  public static async getConfig(key = 'full'): Promise<any> {
    return this.request('GET', `/v1/config?key=${key}`);
  }

  public static async setConfig(key: string, value: any, sessionId?: string): Promise<any> {
    return this.request('POST', '/v1/config', { key, value, session_id: sessionId });
  }

  public static async execSlash(sessionId: string, command: string): Promise<any> {
    return this.request('POST', '/v1/slash', { session_id: sessionId, command });
  }

  public static async resizeTerminal(sessionId: string, cols: number): Promise<any> {
    return this.request('POST', '/v1/terminal/resize', { session_id: sessionId, cols });
  }
}
