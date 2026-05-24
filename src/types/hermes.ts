export interface StoredSession {
  id: string;
  title: string;
  preview: string;
  started_at: number;
  message_count: number;
  source: string;
  updated_at?: number;
}

export interface SessionInfo {
  model?: string;
  provider?: string;
  cwd?: string;
  tools?: Record<string, unknown>;
  skills?: Record<string, unknown>;
  profile_name?: string;
  [key: string]: unknown;
}

export interface HermesMessage {
  role?: 'user' | 'assistant' | string;
  text?: string;
  content?: unknown;
  rendered?: unknown;
  reasoning?: string;
}

export interface Usage {
  input?: number;
  output?: number;
  total?: number;
  model?: string;
  cache_read?: number;
  cache_write?: number;
  reasoning?: number | string;
  prompt?: number;
  completion?: number;
  calls?: number;
  context_used?: number;
  context_max?: number;
  context_percent?: number;
  compressions?: number;
  cost_usd?: number;
  [key: string]: unknown;
}

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params: Record<string, unknown>;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface GatewayEvent<T = unknown> {
  type: string;
  session_id?: string;
  payload?: T;
}

// Tool events
export interface ToolStartPayload {
  tool: string;
  id?: string;
  arguments?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ToolProgressPayload {
  tool: string;
  id?: string;
  text?: string;
  preview?: string;
  [key: string]: unknown;
}

export interface ToolCompletePayload {
  tool: string;
  id?: string;
  output?: string;
  error?: boolean;
  duration?: number;
  [key: string]: unknown;
}

export interface ToolGeneratingPayload {
  tool: string;
  id?: string;
  [key: string]: unknown;
}

// Blocking prompt events
export interface ApprovalRequestPayload {
  session_id: string;
  request_id: string;
  tool?: string;
  arguments?: Record<string, unknown>;
  message?: string;
  [key: string]: unknown;
}

export interface ClarifyRequestPayload {
  request_id: string;
  question: string;
  options?: string[];
  [key: string]: unknown;
}

export interface SudoRequestPayload {
  request_id: string;
  message?: string;
  [key: string]: unknown;
}

export interface SecretRequestPayload {
  request_id: string;
  name: string;
  message?: string;
  [key: string]: unknown;
}

// Config payloads
export interface ConfigPayload {
  [key: string]: unknown;
}

export interface ModelOptionsPayload {
  providers: Array<{
    provider: string;
    models: string[];
  }>;
}

export interface SkillsPayload {
  skills: Array<{
    name: string;
    description?: string;
    installed?: boolean;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface ToolsetsPayload {
  toolsets: Array<{
    name: string;
    description?: string;
    enabled?: boolean;
    tool_count?: number;
    [key: string]: unknown;
  }>;
}
