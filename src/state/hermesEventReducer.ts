import { GatewayEvent, SessionInfo, HermesMessage } from '../types/hermes';
import { ChatMessage, ChatSegment, ToolActivity } from '../hooks/useHermes';

export interface HermesState {
  messages: ChatMessage[];
  activeSessionId: string | null;
  sessionInfo: SessionInfo | null;
  isRunning: boolean;
  error: string | null;
  statusLine: string | null;
  blockingRequests: Array<{
    type: 'approval' | 'clarify' | 'sudo' | 'secret';
    payload: any;
  }>;
  voiceState: {
    recording: boolean;
    tts: boolean;
    transcript: string | null;
  };
  skin: Record<string, any>;
  serverInfo: {
    name: string;
    auth_enabled: boolean;
  } | null;
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const initialHermesState: HermesState = {
  messages: [],
  activeSessionId: null,
  sessionInfo: null,
  isRunning: false,
  error: null,
  statusLine: null,
  blockingRequests: [],
  voiceState: {
    recording: false,
    tts: false,
    transcript: null,
  },
  skin: {},
  serverInfo: null,
};

const appendDeltaToSegments = (segments: ChatSegment[], delta: string): ChatSegment[] => {
  const next = [...segments];
  const last = next[next.length - 1];

  if (last?.type === 'text') {
    next[next.length - 1] = { ...last, content: last.content + delta };
  } else {
    next.push({ id: makeId('text'), type: 'text', content: delta });
  }

  return next;
};

const appendStreamingDelta = (existing: string, delta: string): string => {
  if (!existing || !delta) return existing + delta;
  if (existing.endsWith(delta)) return existing;
  if (delta.startsWith(existing)) return delta;

  const maxOverlap = Math.min(existing.length, delta.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    if (existing.endsWith(delta.slice(0, overlap))) {
      return existing + delta.slice(overlap);
    }
  }

  return existing + delta;
};

const appendThinkingToSegments = (segments: ChatSegment[], delta: string): ChatSegment[] => {
  const next = [...segments];
  const thinkingIndex = next.findIndex((s) => s.type === 'thinking');

  if (thinkingIndex !== -1) {
    const existing = next[thinkingIndex];
    if (existing.type === 'thinking') {
      next[thinkingIndex] = { ...existing, content: appendStreamingDelta(existing.content, delta) };
    }
  } else {
    next.unshift({ id: makeId('thinking'), type: 'thinking', content: delta });
  }

  return next;
};

export function hermesEventReducer(state: HermesState, event: GatewayEvent): HermesState {
  const payload: any = event.payload || {};

  switch (event.type) {
    case 'session.resume_start':
      return {
        ...state,
        messages: [],
        isRunning: true,
        statusLine: "Resuming session...",
        error: null,
      };

    case 'session.resume_success':
      return {
        ...state,
        activeSessionId: payload.sessionId,
        messages: payload.messages,
        sessionInfo: {
          ...state.sessionInfo,
          ...payload.config,
        },
        isRunning: false,
        statusLine: null,
      };

    case 'session.created':
      return {
        ...state,
        activeSessionId: payload.sessionId,
        sessionInfo: {
          ...state.sessionInfo,
          ...payload.info,
        },
      };

    case 'message.user_sent': {
      const pendingAssistantMsg: ChatMessage = {
        id: makeId('assistant'),
        role: 'assistant',
        content: '',
        tools: [],
        segments: [],
        status: 'running',
        threadId: state.activeSessionId || undefined,
      };
      return {
        ...state,
        isRunning: true,
        messages: [...state.messages, payload.message, pendingAssistantMsg],
      };
    }

    case 'session.clear':
      return {
        ...state,
        messages: [],
        activeSessionId: null,
        sessionInfo: null,
        isRunning: false,
        blockingRequests: [],
        statusLine: null,
      };

    case 'blocking.resolve':
      return {
        ...state,
        blockingRequests: state.blockingRequests.filter((r) => r.type !== payload.type),
      };

    case 'gateway.ready':
      return {
        ...state,
        skin: payload.skin || {},
        serverInfo: payload.server || null,
        sessionInfo: payload.config ? { ...state.sessionInfo, ...payload.config } : state.sessionInfo,
      };

    case 'session.info':
      return {
        ...state,
        sessionInfo: {
          ...state.sessionInfo,
          ...payload,
        },
      };

    case 'message.start': {
      // If the last message is already a running assistant message, reuse it
      const lastMsg = state.messages[state.messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'running') {
        return {
          ...state,
          isRunning: true,
        };
      }
      // Create running assistant message
      const assistantMessageId = makeId('assistant');
      const newAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        tools: [],
        segments: [],
        status: 'running',
        threadId: state.activeSessionId || undefined,
      };
      return {
        ...state,
        isRunning: true,
        messages: [...state.messages, newAssistantMessage],
      };
    }

    case 'message.delta': {
      // Find the last assistant message and append delta
      const text = payload.text || '';
      if (!text) return state;

      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          return {
            ...msg,
            content: msg.content + text,
            segments: appendDeltaToSegments(msg.segments, text),
          };
        }
        return msg;
      });

      return { ...state, messages };
    }

    case 'message.complete': {
      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          // If reasoning exists, append it as a segment or keep in metadata
          let segments = [...msg.segments];
          if (payload.reasoning && !segments.some(s => s.type === 'thinking')) {
            segments = [
              { id: makeId('thinking'), type: 'thinking', content: payload.reasoning },
              ...segments
            ];
          }
          return {
            ...msg,
            content: payload.text || msg.content,
            segments: payload.text ? appendDeltaToSegments(segments.filter(s => s.type !== 'text'), payload.text) : segments,
            status: payload.status === 'failed' ? 'failed' as const : 'completed' as const,
            reasoning: payload.reasoning || undefined,
            usage: payload.usage || undefined,
          };
        }
        return msg;
      });

      return {
        ...state,
        messages,
        isRunning: false,
        statusLine: null,
      };
    }

    case 'status.update':
      return {
        ...state,
        statusLine: payload.text || null,
      };

    case 'thinking.delta':
    case 'reasoning.delta': {
      const thinkingText = payload.text || '';
      if (!thinkingText) return state;

      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          return {
            ...msg,
            segments: appendThinkingToSegments(msg.segments, thinkingText),
          };
        }
        return msg;
      });

      return { ...state, messages };
    }

    case 'reasoning.available': {
      const fullReasoning = payload.reasoning || '';
      if (!fullReasoning) return state;

      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          let segments = [...msg.segments];
          const hasThinking = segments.some((s) => s.type === 'thinking');

          if (hasThinking) {
            segments = segments.map((s) =>
              s.type === 'thinking' ? { ...s, content: fullReasoning } : s
            );
          } else {
            segments = [
              { id: makeId('thinking'), type: 'thinking', content: fullReasoning },
              ...segments,
            ];
          }

          return {
            ...msg,
            reasoning: fullReasoning,
            segments,
          };
        }
        return msg;
      });
      return { ...state, messages };
    }

    case 'tool.start': {
      const toolName = payload.tool || payload.name || 'tool';
      const activityId = payload.id || `${toolName}-${Date.now()}`;
      const activity: ToolActivity = {
        id: activityId,
        tool: toolName,
        preview: payload.preview || `Executing ${toolName}...`,
        status: 'running',
      };

      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          if (msg.segments.some((s) => s.id === `segment-${activityId}`)) {
            return msg;
          }
          return {
            ...msg,
            tools: [...msg.tools, activity],
            segments: [...msg.segments, { id: `segment-${activityId}`, type: 'tool' as const, tool: activity }],
          };
        }
        return msg;
      });

      return { ...state, messages };
    }

    case 'tool.progress': {
      const toolId = payload.id;
      const toolName = payload.tool || payload.name || '';
      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          const tools = msg.tools.map((t) => {
            if ((toolId && t.id === toolId) || (!toolId && toolName && t.tool === toolName && t.status === 'running')) {
              return { ...t, preview: payload.preview || payload.text || t.preview };
            }
            return t;
          });

          const segments = msg.segments.map((s) => {
            if (s.type === 'tool' && ((toolId && s.tool.id === toolId) || (!toolId && toolName && s.tool.tool === toolName && s.tool.status === 'running'))) {
              return { ...s, tool: { ...s.tool, preview: payload.preview || payload.text || s.tool.preview } };
            }
            return s;
          });

          return { ...msg, tools, segments };
        }
        return msg;
      });

      return { ...state, messages };
    }

    case 'tool.complete': {
      const toolId = payload.id;
      const toolName = payload.tool || payload.name || '';
      const messages = state.messages.map((msg, index) => {
        if (index === state.messages.length - 1 && msg.role === 'assistant') {
          const tools = msg.tools.map((t) => {
            if ((toolId && t.id === toolId) || (!toolId && toolName && t.tool === toolName && t.status === 'running')) {
              return {
                ...t,
                status: payload.error ? ('failed' as const) : ('completed' as const),
                duration: payload.duration,
                preview: payload.output || t.preview,
              };
            }
            return t;
          });

          const segments = msg.segments.map((s) => {
            if (s.type === 'tool' && ((toolId && s.tool.id === toolId) || (!toolId && toolName && s.tool.tool === toolName && s.tool.status === 'running'))) {
              return {
                ...s,
                tool: {
                  ...s.tool,
                  status: payload.error ? ('failed' as const) : ('completed' as const),
                  duration: payload.duration,
                  preview: payload.output || s.tool.preview,
                },
              };
            }
            return s;
          });

          return { ...msg, tools, segments };
        }
        return msg;
      });

      return { ...state, messages };
    }

    case 'approval.request':
      return {
        ...state,
        blockingRequests: [...state.blockingRequests, { type: 'approval', payload }],
      };

    case 'clarify.request':
      return {
        ...state,
        blockingRequests: [...state.blockingRequests, { type: 'clarify', payload }],
      };

    case 'sudo.request':
      return {
        ...state,
        blockingRequests: [...state.blockingRequests, { type: 'sudo', payload }],
      };

    case 'secret.request':
      return {
        ...state,
        blockingRequests: [...state.blockingRequests, { type: 'secret', payload }],
      };

    case 'voice.status':
      return {
        ...state,
        voiceState: {
          ...state.voiceState,
          recording: payload.state === 'recording',
        },
      };

    case 'voice.transcript':
      return {
        ...state,
        voiceState: {
          ...state.voiceState,
          transcript: payload.text || null,
        },
      };

    case 'skin.changed':
      return {
        ...state,
        skin: { ...state.skin, ...payload },
      };

    case 'error': {
      let messages = state.messages;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'running' && !lastMsg.content && !lastMsg.segments.length && !lastMsg.tools.length) {
        messages = messages.slice(0, -1);
      }
      return {
        ...state,
        messages,
        error: payload.message !== undefined ? payload.message : 'Unknown error occurred',
        isRunning: false,
      };
    }

    default:
      return state;
  }
}

// Convert DB message history to UI messages
export function messagesFromHistory(messages: HermesMessage[], threadId?: string): ChatMessage[] {
  const result: ChatMessage[] = [];

  for (const m of messages) {
    if (!m.role) continue;
    const isUser = m.role === 'user';
    const text = m.text || (typeof m.content === 'string' ? m.content : '');
    const reasoning = m.reasoning || '';

    if (!text && !reasoning) continue;

    const segments: ChatSegment[] = [];
    
    // Restore reasoning from database history
    if (reasoning) {
      segments.push({
        id: makeId('thinking'),
        type: 'thinking',
        content: reasoning,
      });
    }

    if (text) {
      segments.push({
        id: makeId('text'),
        type: 'text',
        content: text,
      });
    }

    result.push({
      id: makeId(m.role),
      role: isUser ? 'user' : 'assistant',
      content: text,
      tools: [],
      segments,
      status: 'completed',
      threadId,
      reasoning: reasoning || undefined,
    });
  }

  return result;
}
