import { HERMES_API_URL, HERMES_WEB_TOKEN, getHermesWebToken } from '../config/hermes';
import type {
  TaskCreateRequest,
  TaskItem,
  TaskListResponse,
  TaskListStatus,
  TaskPostponeRequest,
  TaskUpdateRequest,
  TaskWidgetResponse,
} from '../types/tasks';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const token = HERMES_WEB_TOKEN || await getHermesWebToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const parseTaskError = async (response: Response, fallback: string): Promise<Error> => {
  const text = await response.text().catch(() => '');
  if (!text) return new Error(`${fallback} (${response.status})`);

  try {
    const payload = JSON.parse(text);
    const detail = payload?.detail;
    const message = payload?.message || payload?.error?.message;
    if (typeof detail === 'string') return new Error(detail);
    if (Array.isArray(detail) && detail[0]?.msg) return new Error(String(detail[0].msg));
    if (message) return new Error(String(message));
  } catch {
    return new Error(text.slice(0, 240));
  }

  return new Error(`${fallback} (${response.status})`);
};

const taskRequest = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
  const headers: Record<string, string> = {
    ...await getAuthHeaders(),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${HERMES_API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw await parseTaskError(response, `Task API ${method} ${path}`);
  }

  return response.json() as Promise<T>;
};

const queryString = (params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const rendered = query.toString();
  return rendered ? `?${rendered}` : '';
};

export class TaskApi {
  public static getWidget(): Promise<TaskWidgetResponse> {
    return taskRequest('GET', '/v1/tasks/widget');
  }

  public static listTasks(params: {
    status?: TaskListStatus;
    category?: string;
    limit?: number;
  } = {}): Promise<TaskListResponse> {
    return taskRequest('GET', `/v1/tasks${queryString({
      status: params.status || 'active',
      category: params.category,
      limit: params.limit || 200,
    })}`);
  }

  public static getTask(id: number): Promise<TaskItem> {
    return taskRequest('GET', `/v1/tasks/${id}`);
  }

  public static createTask(data: TaskCreateRequest): Promise<TaskItem> {
    return taskRequest('POST', '/v1/tasks', data);
  }

  public static updateTask(id: number, patch: TaskUpdateRequest): Promise<TaskItem> {
    return taskRequest('PATCH', `/v1/tasks/${id}`, patch);
  }

  public static markDone(id: number): Promise<TaskItem> {
    return taskRequest('PATCH', `/v1/tasks/${id}/done`);
  }

  public static cancelTask(id: number): Promise<TaskItem> {
    return taskRequest('PATCH', `/v1/tasks/${id}/cancel`);
  }

  public static postponeTask(id: number, data: TaskPostponeRequest = {}): Promise<TaskItem> {
    return taskRequest('PATCH', `/v1/tasks/${id}/postpone`, data);
  }

  public static postponeToTomorrow(id: number): Promise<TaskItem> {
    return this.postponeTask(id);
  }
}
