import { useState, useCallback, useRef } from 'react';
import {
  createThread,
  getRun,
  getThread,
  sendThreadMessage,
  stopRun,
  consumeRunEvents,
  HermesEvent,
  ThreadDetail,
} from '../services/api';

export interface ToolActivity {
  id: string;
  tool: string;
  preview?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
}

export type ChatSegment =
  | { id: string; type: 'text'; content: string }
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
}

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getThreadTitle = (text: string) => {
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned || 'New Session';
};

const textSegmentFromContent = (content: string): ChatSegment[] =>
  content ? [{ id: makeId('text'), type: 'text', content }] : [];

const messagesFromThread = (thread: ThreadDetail): ChatMessage[] =>
  (thread.messages || [])
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: String(message.id),
      role: message.role as 'user' | 'assistant',
      content: message.content || '',
      tools: [],
      segments: message.role === 'assistant' ? textSegmentFromContent(message.content || '') : [],
      status: 'completed',
      runId: message.run_id,
      threadId: thread.id,
    }));

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

const updateTool = (tool: ToolActivity, event: { error?: boolean; duration?: number }): ToolActivity => ({
  ...tool,
  status: event.error ? 'failed' : 'completed',
  duration: event.duration,
});

function applyRunEvent(message: ChatMessage, event: HermesEvent): ChatMessage {
  let updatedContent = message.content;
  let updatedTools = [...message.tools];
  let updatedSegments = [...message.segments];

  if (event.event === 'message.delta') {
    updatedContent += event.delta;
    updatedSegments = appendDeltaToSegments(updatedSegments, event.delta);
  } else if (event.event === 'tool.started') {
    const activityId = `${event.tool}-${event.seq ?? updatedTools.length}-${Date.now()}`;
    const activity: ToolActivity = {
      id: activityId,
      tool: event.tool,
      preview: event.preview,
      status: 'running',
    };
    updatedTools.push(activity);
    updatedSegments.push({ id: `segment-${activityId}`, type: 'tool', tool: activity });
  } else if (event.event === 'tool.completed') {
    let matchedToolId: string | null = null;

    for (let index = updatedTools.length - 1; index >= 0; index -= 1) {
      const tool = updatedTools[index];
      if (tool.tool === event.tool && tool.status === 'running') {
        const completed = updateTool(tool, event);
        updatedTools[index] = completed;
        matchedToolId = tool.id;
        break;
      }
    }

    if (matchedToolId) {
      updatedSegments = updatedSegments.map((segment) => {
        if (segment.type === 'tool' && segment.tool.id === matchedToolId) {
          return { ...segment, tool: updateTool(segment.tool, event) };
        }
        return segment;
      });
    }
  } else if (event.event === 'run.completed') {
    const finalOutput = event.response || event.output || '';
    if (!updatedContent && finalOutput) {
      updatedContent = finalOutput;
      updatedSegments = appendDeltaToSegments(updatedSegments, finalOutput);
    }
    return {
      ...message,
      content: updatedContent,
      tools: updatedTools,
      segments: updatedSegments,
      status: 'completed',
    };
  } else if (event.event === 'run.failed') {
    return {
      ...message,
      tools: updatedTools,
      segments: updatedSegments,
      status: 'failed',
    };
  }

  return {
    ...message,
    content: updatedContent,
    tools: updatedTools,
    segments: updatedSegments,
  };
}

export function useHermes() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentThreadTitle, setCurrentThreadTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runSeqRef = useRef<Record<string, number>>({});

  const streamRun = useCallback(async (runId: string, assistantMessageId: string, since = 0) => {
    setIsRunning(true);
    setCurrentRunId(runId);

    await consumeRunEvents(
      runId,
      (event: HermesEvent) => {
        if (event.seq) {
          runSeqRef.current[runId] = Math.max(runSeqRef.current[runId] || 0, event.seq);
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? applyRunEvent(msg, event) : msg
          )
        );
      },
      () => {
        setIsRunning(false);
        setCurrentRunId(null);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId && msg.status === 'running'
              ? { ...msg, status: 'completed' }
              : msg
          )
        );
      },
      (streamErr) => {
        setError(streamErr.message);
        setIsRunning(false);
        setCurrentRunId(null);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, status: 'failed' }
              : msg
          )
        );
      },
      since
    );
  }, []);

  const stopActiveRun = useCallback(async () => {
    if (!currentRunId) return;
    try {
      await stopRun(currentRunId);
      setIsRunning(false);
      setCurrentRunId(null);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.status === 'running' ? { ...msg, status: 'failed' } : msg
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to interrupt execution');
    }
  }, [currentRunId]);

  const sendMessage = useCallback(async (text: string, model = 'deepseek-v4-flash') => {
    if (!text.trim() || isRunning) return;

    setError(null);
    setIsRunning(true);

    const userMsg: ChatMessage = {
      id: makeId('user'),
      role: 'user',
      content: text,
      tools: [],
      segments: [],
      status: 'completed',
      threadId: currentThreadId || undefined,
    };

    const assistantMessageId = makeId('assistant');
    const assistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      tools: [],
      segments: [],
      status: 'running',
      threadId: currentThreadId || undefined,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let threadId = currentThreadId;
      if (!threadId) {
        const thread = await createThread(getThreadTitle(text));
        threadId = thread.id;
        setCurrentThreadId(thread.id);
        setCurrentThreadTitle(thread.title || getThreadTitle(text));
      }

      const runRes = await sendThreadMessage(threadId, text, model);
      const runId = runRes.run_id;
      runSeqRef.current[runId] = 0;

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMessageId) {
            return { ...msg, runId, threadId };
          }
          if (msg.id === userMsg.id) {
            return { ...msg, threadId };
          }
          return msg;
        })
      );

      await streamRun(runId, assistantMessageId, 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error launching run');
      setIsRunning(false);
      setCurrentRunId(null);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, status: 'failed' } : msg
        )
      );
    }
  }, [currentThreadId, isRunning, streamRun]);

  const loadThread = useCallback(async (threadId: string) => {
    setError(null);
    const thread = await getThread(threadId);
    setCurrentThreadId(thread.id);
    setCurrentThreadTitle(thread.title || 'Session');
    setMessages(messagesFromThread(thread));
  }, []);

  const reconnectRun = useCallback(async (runId: string, threadId?: string) => {
    setError(null);

    if (threadId) {
      try {
        await loadThread(threadId);
      } catch {
        // Fall back to run-only view below.
      }
    }

    const assistantMessageId = makeId('assistant');

    setMessages((prev) => [
      ...prev,
      {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        tools: [],
        segments: [],
        status: 'running',
        runId,
        threadId,
      },
    ]);

    runSeqRef.current[runId] = 0;
    await streamRun(runId, assistantMessageId, 0);
  }, [loadThread, streamRun]);

  const connectRun = useCallback(async (runId: string, threadId?: string) => {
    setError(null);
    const run = await getRun(runId).catch(() => null);

    if (threadId || run?.thread_id) {
      await loadThread(threadId || run?.thread_id || '');
    }

    if (run?.status === 'running' || run?.status === 'queued') {
      await reconnectRun(runId, threadId || run?.thread_id);
      return;
    }

    if (!threadId && !run?.thread_id && run?.output) {
      setMessages([
        {
          id: makeId('assistant'),
          role: 'assistant',
          content: run.output,
          tools: [],
          segments: textSegmentFromContent(run.output),
          status: run.status === 'failed' ? 'failed' : 'completed',
          runId,
        },
      ]);
    }
  }, [loadThread, reconnectRun]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setCurrentRunId(null);
    setCurrentThreadId(null);
    setCurrentThreadTitle(null);
  }, []);

  return {
    messages,
    isRunning,
    currentRunId,
    currentThreadId,
    currentThreadTitle,
    error,
    sendMessage,
    stopActiveRun,
    clearChat,
    loadThread,
    connectRun,
    reconnectRun,
  };
}
