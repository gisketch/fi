// API client for Fi Gateway communicating with Hermes.dev agent

const API_URL = import.meta.env.VITE_API_URL || 'https://fi.gisketch.com';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || 'fi-gisketch-dashboard';

const authHeaders = {
  'Authorization': `Bearer ${API_TOKEN}`,
};

export interface UsageData {
  ts: string;
  deepseek: {
    total: number;
    currency: string;
  };
  codex?: {
    plan?: string;
    '5hour'?: { used_percent?: number };
    weekly?: { used_percent?: number };
    week?: { used_percent?: number };
  };
}

export interface RunStartResponse {
  run_id: string;
  status: string;
  thread_id?: string;
  message_id?: number;
}

export interface RunSummary {
  run_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | string;
  model?: string;
  created_at?: number;
  updated_at?: number;
  thread_id?: string;
  session_id?: string;
  output?: string;
  last_event?: string;
}

export interface RunsListResponse {
  object: 'list';
  data: RunSummary[];
}

export interface ThreadSummary {
  id: string;
  title?: string;
  created_at?: number;
  updated_at?: number;
  message_count?: number;
}

export interface ThreadMessage {
  id: number | string;
  role: 'user' | 'assistant' | string;
  content: string;
  run_id?: string;
}

export interface ThreadDetail extends ThreadSummary {
  messages: ThreadMessage[];
}

export interface ThreadsListResponse {
  object: 'list';
  data: ThreadSummary[];
}

export interface ToolProgressEvent {
  event: 'tool.started' | 'tool.completed';
  tool: string;
  preview?: string;
  duration?: number;
  error?: boolean;
  seq?: number;
}

export interface MessageDeltaEvent {
  event: 'message.delta';
  delta: string;
  seq?: number;
}

export interface RunLifecycleEvent {
  event: 'run.created' | 'run.started' | 'run.completed' | 'run.failed';
  run_id: string;
  response?: string;
  output?: string;
  error?: string;
  seq?: number;
}

export type HermesEvent = ToolProgressEvent | MessageDeltaEvent | RunLifecycleEvent;

async function parseJsonError(response: Response, fallback: string): Promise<Error> {
  const err = await response.json().catch(() => ({}));
  return new Error(err.error?.message || fallback);
}

/**
 * Starts a stateful run on the Hermes agent
 */
export async function startRun(input: string, model = 'deepseek-v4-flash', threadId?: string): Promise<RunStartResponse> {
  const response = await fetch(`${API_URL}/v1/runs`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      model,
      ...(threadId ? { thread_id: threadId } : {}),
    }),
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to start run: ${response.statusText}`);
  }

  return response.json();
}

export async function createThread(title: string): Promise<ThreadSummary> {
  const response = await fetch(`${API_URL}/v1/threads`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to create thread: ${response.statusText}`);
  }

  return response.json();
}

export async function listThreads(): Promise<ThreadSummary[]> {
  const response = await fetch(`${API_URL}/v1/threads`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to list threads: ${response.statusText}`);
  }

  const data = await response.json() as ThreadsListResponse;
  return data.data || [];
}

export async function getThread(threadId: string): Promise<ThreadDetail> {
  const response = await fetch(`${API_URL}/v1/threads/${threadId}`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to get thread: ${response.statusText}`);
  }

  return response.json();
}

export async function sendThreadMessage(threadId: string, content: string, model = 'deepseek-v4-flash'): Promise<RunStartResponse> {
  const response = await fetch(`${API_URL}/v1/threads/${threadId}/messages`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, model }),
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to send thread message: ${response.statusText}`);
  }

  return response.json();
}

export async function listRuns(): Promise<RunSummary[]> {
  const response = await fetch(`${API_URL}/v1/runs`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to list runs: ${response.statusText}`);
  }

  const data = await response.json() as RunsListResponse;
  return data.data || [];
}

export async function getRun(runId: string): Promise<RunSummary> {
  const response = await fetch(`${API_URL}/v1/runs/${runId}`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw await parseJsonError(response, `Failed to get run: ${response.statusText}`);
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
      ...authHeaders,
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
  onError: (error: Error) => void,
  since?: number
): Promise<void> {
  try {
    const url = `${API_URL}/v1/runs/${runId}/events${since && since > 0 ? `?since=${since}` : ''}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...authHeaders,
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
