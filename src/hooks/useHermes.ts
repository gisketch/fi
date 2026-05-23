import { useState, useCallback, useRef } from 'react';
import { startRun, stopRun, consumeRunEvents, HermesEvent } from '../services/api';

export interface ToolActivity {
  id: string;
  tool: string;
  preview?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools: ToolActivity[];
  status: 'running' | 'completed' | 'failed';
}

export function useHermes() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeMessageRef = useRef<ChatMessage | null>(null);

  const stopActiveRun = useCallback(async () => {
    if (!currentRunId) return;
    try {
      await stopRun(currentRunId);
      setIsRunning(false);
      setCurrentRunId(null);
      
      // Update last assistant message status
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

    // 1. Add user message
    const userMessageId = Math.random().toString(36).substring(7);
    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      content: text,
      tools: [],
      status: 'completed',
    };

    // 2. Add empty assistant message skeleton
    const assistantMessageId = Math.random().toString(36).substring(7);
    const assistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      tools: [],
      status: 'running',
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    activeMessageRef.current = assistantMsg;

    let runId = '';
    try {
      // 3. Request Run session
      const runRes = await startRun(text, model);
      runId = runRes.run_id;
      setCurrentRunId(runId);

      // 4. Stream SSE Events
      await consumeRunEvents(
        runId,
        (event: HermesEvent) => {
          setMessages((prev) => {
            return prev.map((msg) => {
              if (msg.id !== assistantMessageId) return msg;

              let updatedContent = msg.content;
              let updatedTools = [...msg.tools];

              if (event.event === 'message.delta') {
                updatedContent += event.delta;
              } else if (event.event === 'tool.started') {
                // Add unique activity block
                const activityId = `${event.tool}-${updatedTools.length}`;
                updatedTools.push({
                  id: activityId,
                  tool: event.tool,
                  preview: event.preview,
                  status: 'running',
                });
              } else if (event.event === 'tool.completed') {
                // Find last running instance of this tool
                updatedTools = updatedTools.map((t) => {
                  if (t.tool === event.tool && t.status === 'running') {
                    return {
                      ...t,
                      status: event.error ? 'failed' : 'completed',
                      duration: event.duration,
                    };
                  }
                  return t;
                });
              } else if (event.event === 'run.completed') {
                return {
                  ...msg,
                  content: event.response || updatedContent,
                  status: 'completed',
                };
              } else if (event.event === 'run.failed') {
                return {
                  ...msg,
                  status: 'failed',
                };
              }

              return {
                ...msg,
                content: updatedContent,
                tools: updatedTools,
              };
            });
          });
        },
        () => {
          // Finished stream
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
        }
      );
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
  }, [isRunning]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isRunning,
    error,
    sendMessage,
    stopActiveRun,
    clearChat,
  };
}
