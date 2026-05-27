import { useCallback, useEffect, useState } from 'react';
import { TaskApi } from '../services/tasks';
import type { TaskWidgetResponse } from '../types/tasks';

export const useTaskWidget = (refreshKey = 0) => {
  const [data, setData] = useState<TaskWidgetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const widget = await TaskApi.getWidget();
      setData(widget);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tasks unavailable');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };

    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    const timer = window.setInterval(() => void load(true), 60_000);

    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
      window.clearInterval(timer);
    };
  }, [load]);

  const runAction = useCallback(async (taskId: number, action: 'done' | 'tomorrow') => {
    setBusyTaskId(taskId);
    setError(null);
    try {
      if (action === 'done') {
        await TaskApi.markDone(taskId);
      } else {
        await TaskApi.postponeToTomorrow(taskId);
      }
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Task action failed');
    } finally {
      setBusyTaskId(null);
    }
  }, [load]);

  return {
    data,
    loading,
    error,
    busyTaskId,
    refresh: () => load(),
    markDone: (taskId: number) => runAction(taskId, 'done'),
    postponeToTomorrow: (taskId: number) => runAction(taskId, 'tomorrow'),
  };
};
