// API client for Fi Gateway communicating with Hermes.dev agent

const API_URL = import.meta.env.VITE_API_URL || 'https://fi.gisketch.com';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'fi-gisketch-dashboard';

export interface UsageData {
  ts: string;
  deepseek: {
    total: number;
    currency: string;
  };
  codex: {
    plan: string;
    '5hour': { used_percent: number };
    weekly: { used_percent: number };
  };
}

export interface RunStartResponse {
  run_id: string;
  status: string;
}

export interface ToolProgressEvent {
  event: 'tool.started' | 'tool.completed';
  tool: string;
  preview?: string;
  duration?: number;
  error?: boolean;
}

export interface MessageDeltaEvent {
  event: 'message.delta';
  delta: string;
}

export interface RunLifecycleEvent {
  event: 'run.created' | 'run.started' | 'run.completed' | 'run.failed';
  run_id: string;
  response?: string;
  error?: string;
}

export type HermesEvent = ToolProgressEvent | MessageDeltaEvent | RunLifecycleEvent;

/**
 * Starts a stateful run on the Hermes agent
 */
export async function startRun(input: string, model = 'deepseek-v4-flash'): Promise<RunStartResponse> {
  const response = await fetch(`${API_URL}/v1/runs`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      model,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to start run: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Stops a stateful run mid-execution
 */
export async function stopRun(runId: string): Promise<void> {
  const response = await fetch(`${API_URL}/v1/runs/${runId}/stop`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to stop run: ${response.statusText}`);
  }
}

/**
 * SSE stream consumer using standard fetch to support custom headers natively in iOS Safari
 */
export async function consumeRunEvents(
  runId: string,
  onEvent: (event: HermesEvent) => void,
  onClose: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_URL}/v1/runs/${runId}/events`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Accept': 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to connect to event stream: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error('Readable stream not supported in response');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Save last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') {
            continue;
          }
          try {
            const eventData = JSON.parse(dataStr) as HermesEvent;
            onEvent(eventData);
          } catch (e) {
            console.error('Failed to parse event JSON:', dataStr, e);
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      const dataStr = buffer.trim().slice(6).trim();
      if (dataStr !== '[DONE]') {
        try {
          const eventData = JSON.parse(dataStr) as HermesEvent;
          onEvent(eventData);
        } catch (e) {
          // ignore
        }
      }
    }

    onClose();
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Fetch DeepSeek balance and Codex usage data
 */
export async function getUsageData(): Promise<UsageData> {
  const response = await fetch('/usage-api/usage.json');
  if (!response.ok) {
    throw new Error(`Failed to fetch usage data: ${response.statusText}`);
  }
  return response.json();
}
