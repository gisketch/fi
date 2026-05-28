import { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import HermesGateway from '../services/hermesGateway';
import { hermesEventReducer, initialHermesState, messagesFromHistory } from '../state/hermesEventReducer';
import { hermesTransport } from '../services/hermesTransport';

export interface ToolActivity {
  id: string;
  tool: string;
  input?: unknown;
  output?: unknown;
  raw?: Record<string, unknown>;
  preview?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
}

export type ChatSegment =
  | { id: string; type: 'text'; content: string }
  | { id: string; type: 'thinking'; content: string }
  | { id: string; type: 'tool'; tool: ToolActivity };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: ToolActivity[];
  segments: ChatSegment[];
  status: 'running' | 'completed' | 'failed';
  runId?: string;
  threadId?: string;
  reasoning?: string;
  usage?: any;
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const renderCommandValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const commandOutputFromPayload = (payload: any): string => {
  const parts = [
    payload?.warning ? `Warning: ${payload.warning}` : '',
    payload?.output,
    payload?.text,
    payload?.message,
    payload?.result,
    payload?.stdout,
    payload?.stderr,
  ]
    .map(renderCommandValue)
    .filter(Boolean);

  if (parts.length) return parts.join('\n\n').trim();

  if (payload && typeof payload === 'object') {
    return renderCommandValue(payload);
  }

  return '';
};

const shouldSubmitCommandPayload = (payload: any): payload is { message: string; type: string } => (
  payload?.type === 'skill' &&
  typeof payload.message === 'string' &&
  payload.message.trim().length > 0
);

export function useHermes() {
  const [state, dispatch] = useReducer(hermesEventReducer, initialHermesState);
  const [currentThreadTitle, setCurrentThreadTitle] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  // Ref to hold the active session ID to avoid dependency closure issues
  const activeSessionIdRef = useRef<string | null>(null);

  // Sync session ID to ref and localStorage
  useEffect(() => {
    activeSessionIdRef.current = state.activeSessionId;
    if (state.activeSessionId) {
      localStorage.setItem('hermes_active_session_id', state.activeSessionId);
    }
  }, [state.activeSessionId]);

  // Hook up event subscriber
  useEffect(() => {
    const unsub = HermesGateway.onEvent((event) => {
      const eventSessionId = event.session_id || event.payload?.session_id;
      const activeSessionId = activeSessionIdRef.current;
      if (eventSessionId && eventSessionId !== activeSessionId) {
        return;
      }
      // Direct WS events are routed to our reducer
      dispatch(event);
    });

    // Handle connection status updates
    hermesTransport.connectionStatusCallback = (status: any) => {
      setConnectionStatus(status);
    };

    // Auto connect
    HermesGateway.connect().catch((err) => {
      console.error('Failed to auto-connect Hermes WS:', err);
    });

    return () => {
      unsub();
    };
  }, []);

  const resumeSession = useCallback(async (sessionId: string) => {
    // Optimistically transition to loading state instantly
    const previousSessionId = activeSessionIdRef.current;
    activeSessionIdRef.current = sessionId;
    dispatch({ type: 'session.resume_start', payload: { sessionId } });

    try {
      const res = await HermesGateway.resumeSession(sessionId);
      const activeSessionId = res.session_id || res.resumed || sessionId;
      activeSessionIdRef.current = activeSessionId;
      localStorage.setItem('hermes_active_session_id', activeSessionId);
      
      // Convert history messages
      const historyMessages = messagesFromHistory(res.messages || [], activeSessionId);

      let running = false;
      try {
        const status = await HermesGateway.getStatus(activeSessionId);
        running = Boolean(status?.running);
      } catch (statusErr) {
        console.warn('Failed to fetch session status:', statusErr);
      }
      
      // Sync to local state purely
      dispatch({
        type: 'session.resume_success',
        payload: {
          sessionId: activeSessionId,
          messages: historyMessages,
          config: res.info,
          running,
        }
      });
      
      // Get title safely without blocking successful resume
      try {
        const titleRes = await HermesGateway.getOrSetTitle(activeSessionId);
        setCurrentThreadTitle(titleRes.title || 'Session');
      } catch (titleErr) {
        console.warn('Failed to fetch session title:', titleErr);
        setCurrentThreadTitle('Session');
      }
      return activeSessionId;
    } catch (e: any) {
      console.error('Failed to resume session:', e);
      if (e.message?.toLowerCase().includes('not found')) {
        localStorage.removeItem('hermes_active_session_id');
        activeSessionIdRef.current = null;
        dispatch({ type: 'session.clear' });
      } else {
        activeSessionIdRef.current = previousSessionId;
      }
      dispatch({ type: 'error', payload: { message: `Failed to resume session: ${e.message}` } });
      throw e;
    }
  }, []);

  const loadThread = useCallback(async (threadId: string) => {
    // compatibility alias for resumeSession
    await resumeSession(threadId);
  }, [resumeSession]);

  const createSession = useCallback(async () => {
    try {
      const res = await HermesGateway.createSession(80);
      activeSessionIdRef.current = res.session_id;
      localStorage.setItem('hermes_active_session_id', res.session_id);
      dispatch({
        type: 'session.created',
        payload: {
          sessionId: res.session_id,
          info: res.info,
        }
      });
      return res.session_id;
    } catch (e: any) {
      dispatch({ type: 'error', payload: { message: `Failed to create session: ${e.message}` } });
      throw e;
    }
  }, []);

  const sendMessage = useCallback(async (text: string, model?: string) => {
    if (!text.trim() || state.isRunning) return;

    dispatch({ type: 'error', payload: { message: null } });

    // Step 1: Ensure active session exists
    let sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      try {
        sessionId = await createSession();
      } catch (err) {
        return;
      }
    }

    // Step 2: Append user message locally purely
    const userMsg: ChatMessage = {
      id: makeId('user'),
      role: 'user',
      content: text,
      tools: [],
      segments: [{ id: makeId('text'), type: 'text', content: text }],
      status: 'completed',
      threadId: sessionId || undefined,
    };

    dispatch({
      type: 'message.user_sent',
      payload: { message: userMsg }
    });

    // Step 3: Set model config if specified
    if (model) {
      try {
        await HermesGateway.setConfig('model', model, sessionId || undefined);
      } catch (e) {
        // ignore config set error, continue
      }
    }

    // Step 4: Set title if first user message
    const userMessageCount = state.messages.filter((m) => m.role === 'user').length;
    if (userMessageCount === 0) {
      const title = text.length > 40 ? `${text.slice(0, 40)}...` : text;
      try {
        await HermesGateway.getOrSetTitle(sessionId || '', title);
        setCurrentThreadTitle(title);
      } catch (e) {
        // ignore
      }
    }

    // Step 5: Submit prompt via WebSocket RPC
    try {
      await HermesGateway.submitPrompt(sessionId || '', text);
    } catch (e: any) {
      dispatch({ type: 'error', payload: { message: `Submit failed: ${e.message}` } });
    }
  }, [state.isRunning, state.messages, createSession]);

  const executeSlashCommand = useCallback(async (command: string) => {
    const trimmed = command.trim();
    if (!trimmed || state.isRunning) return;

    dispatch({ type: 'error', payload: { message: null } });

    let sessionId = activeSessionIdRef.current;
    if (!sessionId) {
      try {
        sessionId = await createSession();
      } catch {
        return;
      }
    }

    const userMsg: ChatMessage = {
      id: makeId('user'),
      role: 'user',
      content: trimmed,
      tools: [],
      segments: [{ id: makeId('text'), type: 'text', content: trimmed }],
      status: 'completed',
      threadId: sessionId || undefined,
    };

    dispatch({
      type: 'message.user_sent',
      payload: { message: userMsg }
    });

    const userMessageCount = state.messages.filter((m) => m.role === 'user').length;
    if (userMessageCount === 0) {
      const title = trimmed.length > 40 ? `${trimmed.slice(0, 40)}...` : trimmed;
      try {
        await HermesGateway.getOrSetTitle(sessionId || '', title);
        setCurrentThreadTitle(title);
      } catch {
        // ignore
      }
    }

    try {
      const [commandName, ...argParts] = trimmed.split(/\s+/);
      const args = argParts.join(' ');
      const res = await HermesGateway.dispatchCommand(sessionId || '', commandName, args);

      if (shouldSubmitCommandPayload(res)) {
        await HermesGateway.submitPrompt(sessionId || '', res.message);
        return;
      }

      const output = commandOutputFromPayload(res) || `Executed ${trimmed}`;

      dispatch({
        type: 'message.complete',
        payload: { text: output, status: 'completed' }
      });
    } catch (e: any) {
      try {
        const res = await HermesGateway.execSlash(sessionId || '', trimmed);
        const output = [
          res.warning ? `Warning: ${res.warning}` : '',
          res.output || '',
        ].filter(Boolean).join('\n\n') || `Executed ${trimmed}`;

        dispatch({
          type: 'message.complete',
          payload: { text: output, status: 'completed' }
        });
      } catch (fallbackErr: any) {
        const message = `Slash command failed: ${fallbackErr.message || e.message}`;
        dispatch({ type: 'error', payload: { message } });
        dispatch({
          type: 'message.complete',
          payload: { text: message, status: 'failed' }
        });
      }
    }
  }, [state.isRunning, state.messages, createSession]);

  const stopActiveRun = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;

    try {
      await HermesGateway.interrupt(sessionId);
      dispatch({
        type: 'message.complete',
        payload: { status: 'failed', reasoning: 'Interrupted by user' }
      });
    } catch (e: any) {
      dispatch({ type: 'error', payload: { message: `Failed to stop: ${e.message}` } });
    }
  }, []);

  const clearChat = useCallback(async () => {
    dispatch({ type: 'session.clear' });
    activeSessionIdRef.current = null;
    localStorage.removeItem('hermes_active_session_id');
    setCurrentThreadTitle(null);
  }, []);

  const startBlankDraft = useCallback(() => {
    dispatch({ type: 'session.clear' });
    activeSessionIdRef.current = null;
    localStorage.removeItem('hermes_active_session_id');
    setCurrentThreadTitle(null);
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'error', payload: { message: null } });
  }, []);

  // Blocking prompt responders
  const resolveBlockingRequest = useCallback(async (type: 'approval' | 'clarify' | 'sudo' | 'secret', choiceOrValue: string, all = false) => {
    const request = state.blockingRequests.find(r => r.type === type);
    if (!request) return;

    dispatch({ type: 'blocking.resolve', payload: { type } });

    try {
      if (type === 'approval') {
        const sessionId = activeSessionIdRef.current || '';
        await HermesGateway.respondApproval(sessionId, choiceOrValue, all);
      } else if (type === 'clarify') {
        await HermesGateway.respondClarify(request.payload.request_id, choiceOrValue);
      } else if (type === 'sudo') {
        await HermesGateway.respondSudo(request.payload.request_id, choiceOrValue);
      } else if (type === 'secret') {
        await HermesGateway.respondSecret(request.payload.request_id, choiceOrValue);
      }
      
      // Trigger a small refresh or notify
      dispatch({ type: 'status.update', payload: { text: `Submitted response for ${type}` } });
    } catch (err: any) {
      dispatch({ type: 'error', payload: { message: `Failed response: ${err.message}` } });
    }
  }, [state.blockingRequests]);

  // Compatibility facade methods
  const connectRun = useCallback(async (_runId: string, threadId?: string) => {
    if (threadId) {
      await loadThread(threadId);
    }
  }, [loadThread]);

  const reconnectRun = useCallback(async (_runId: string, threadId?: string) => {
    if (threadId) {
      await loadThread(threadId);
    }
  }, [loadThread]);

  return {
    // Compatibility Facade properties
    messages: state.messages,
    isRunning: state.isRunning,
    currentThreadId: state.activeSessionId,
    currentThreadTitle,
    error: state.error,
    clearError,
    sendMessage,
    executeSlashCommand,
    stopActiveRun,
    clearChat,
    loadThread,
    connectRun,
    reconnectRun,

    // Advanced Hermes states & actions
    connectionStatus,
    statusLine: state.statusLine,
    blockingRequests: state.blockingRequests,
    voiceState: state.voiceState,
    sessionInfo: state.sessionInfo,
    resolveBlockingRequest,
    resumeSession,
    createSession,
    startBlankDraft,
  };
}
