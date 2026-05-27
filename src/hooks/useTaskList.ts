import { useCallback, useEffect, useMemo, useState } from 'react';
import { TaskApi } from '../services/tasks';
import type { TaskItem, TaskListStatus, TaskUpdateRequest } from '../types/tasks';

export const taskStatusLabels: Record<TaskListStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  cancelled: 'Cancelled',
  all: 'All',
};

export const useTaskList = (refreshKey = 0) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [status, setStatus] = useState<TaskListStatus>('active');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTaskId, setBusyTaskId] = useState<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const result = await TaskApi.listTasks({
        status,
        category: category || undefined,
        limit: 300,
      });
      setTasks(result.tasks || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tasks unavailable');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [load]);

  const categories = useMemo(() => (
    Array.from(new Set(tasks.map((task) => task.category.trim()).filter(Boolean))).sort()
  ), [tasks]);

  const filteredTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tasks;
    return tasks.filter((task) => (
      `${task.title} ${task.description} ${task.category}`.toLowerCase().includes(needle)
    ));
  }, [query, tasks]);

  const runTaskAction = useCallback(async (taskId: number, action: () => Promise<unknown>) => {
    setBusyTaskId(taskId);
    setError(null);
    try {
      await action();
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Task action failed');
    } finally {
      setBusyTaskId(null);
    }
  }, [load]);

  return {
    tasks,
    filteredTasks,
    categories,
    status,
    setStatus,
    category,
    setCategory,
    query,
    setQuery,
    loading,
    error,
    busyTaskId,
    refresh: () => load(),
    markDone: (taskId: number) => runTaskAction(taskId, () => TaskApi.markDone(taskId)),
    postponeToTomorrow: (taskId: number) => runTaskAction(taskId, () => TaskApi.postponeToTomorrow(taskId)),
    cancelTask: (taskId: number) => runTaskAction(taskId, () => TaskApi.cancelTask(taskId)),
    updateTask: (taskId: number, patch: TaskUpdateRequest) => runTaskAction(taskId, () => TaskApi.updateTask(taskId, patch)),
  };
};
