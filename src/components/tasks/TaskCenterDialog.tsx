import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Clock3, ListTodo, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { taskStatusLabels, useTaskList } from '../../hooks/useTaskList';
import { TaskApi } from '../../services/tasks';
import type { TaskItem, TaskListStatus } from '../../types/tasks';
import type { TaskWidgetResponse } from '../../types/tasks';
import { isOverdue, statusLabel, taskMeta, todayInManila } from './taskFormat';
import { TaskDetailPanel } from './TaskDetailPanel';

interface TaskCenterProps {
  focusId?: number | null;
  refreshKey?: number;
  reduceMotion?: boolean;
  onClose: () => void;
  onAddWithFi: () => void;
}

const statusTabs: TaskListStatus[] = ['active', 'pending', 'in_progress', 'done', 'cancelled', 'all'];

export const TaskCenter = ({
  focusId = null,
  refreshKey = 0,
  reduceMotion = false,
  onClose,
  onAddWithFi,
}: TaskCenterProps) => {
  const taskList = useTaskList(refreshKey);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [widget, setWidget] = useState<TaskWidgetResponse | null>(null);
  const [focusTask, setFocusTask] = useState<TaskItem | null>(null);
  const today = todayInManila();
  const selectedTask = useMemo(
    () => taskList.tasks.find((task) => task.id === selectedTaskId) || (focusTask?.id === selectedTaskId ? focusTask : null),
    [focusTask, selectedTaskId, taskList.tasks],
  );
  const shownFocusTask = focusTask || (focusId ? taskList.tasks.find((task) => task.id === focusId) || null : null);
  const groupedTasks = useMemo(() => groupTasks(taskList.filteredTasks, today), [taskList.filteredTasks, today]);

  const refreshTaskCenterData = async () => {
    const [nextWidget, nextFocusTask] = await Promise.all([
      TaskApi.getWidget().catch(() => null),
      focusId ? TaskApi.getTask(focusId).catch(() => null) : Promise.resolve(null),
    ]);
    if (nextWidget) setWidget(nextWidget);
    setFocusTask(nextFocusTask);
  };

  useEffect(() => {
    if (selectedTaskId && !selectedTask) setSelectedTaskId(null);
  }, [selectedTask, selectedTaskId]);

  useEffect(() => {
    void refreshTaskCenterData();
  }, [focusId, refreshKey]);

  const openAddWithFi = () => {
    onClose();
    onAddWithFi();
  };

  const refreshAll = async () => {
    await Promise.all([
      taskList.refresh(),
      refreshTaskCenterData(),
    ]);
  };

  const runAction = async (action: () => Promise<void>) => {
    await action();
    await refreshTaskCenterData();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl sm:items-center sm:px-4 sm:pb-4 sm:pt-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Tasks"
        initial={{ opacity: 0, y: 18, filter: reduceMotion ? 'blur(0px)' : 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, filter: reduceMotion ? 'blur(0px)' : 'blur(8px)' }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
        className="flex h-[92svh] max-h-[760px] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl sm:h-auto sm:max-h-[86vh] sm:rounded-[28px]"
      >
        <div className="flex min-h-[56px] items-center justify-between gap-3 border-b border-white/[0.04] px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            {selectedTask && (
              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-500 active:scale-95 md:hidden"
                aria-label="Back to task list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-serif-hermes text-[18px] italic text-zinc-200">
                <ListTodo className="h-4 w-4 text-neutral-500" />
                <span>{selectedTask ? 'Task' : 'Task Center'}</span>
              </div>
              <div className="truncate font-sans-hermes text-[11px] text-neutral-600">
                {selectedTask ? selectedTask.title : 'VPS task loop'}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" onClick={openAddWithFi} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 active:scale-95" aria-label="Add task with Fi">
              <Sparkles className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void refreshAll()} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 active:scale-95" aria-label="Refresh tasks">
              <RefreshCw className={`h-4 w-4 ${taskList.loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 active:scale-95" aria-label="Close tasks">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 ${selectedTask ? 'hidden md:flex' : 'flex'}`}>
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
            {widget?.pending_count ?? 0} pending <span className="text-neutral-800">/</span> {widget?.overdue_count ?? 0} overdue <span className="text-neutral-800">/</span> {widget?.done_today_count ?? 0} done today
          </div>

          {shownFocusTask && (
            <FocusCard
              task={shownFocusTask}
              today={today}
              busy={taskList.busyTaskId === shownFocusTask.id}
              onOpen={() => setSelectedTaskId(shownFocusTask.id)}
              onDone={() => void runAction(() => taskList.markDone(shownFocusTask.id))}
              onTomorrow={() => void runAction(() => taskList.postponeToTomorrow(shownFocusTask.id))}
            />
          )}

          <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {statusTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => taskList.setStatus(tab)}
                className={`min-h-10 shrink-0 rounded-full px-3 font-mono text-[10px] uppercase tracking-wider active:scale-[0.98] ${
                  taskList.status === tab
                    ? 'bg-white text-black'
                    : 'border border-white/[0.06] text-neutral-500'
                }`}
              >
                {taskStatusLabels[tab]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_112px] gap-2 sm:grid-cols-[1fr_auto]">
            <div className="flex min-h-11 min-w-0 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3">
              <Search className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
              <input
                value={taskList.query}
                onChange={(event) => taskList.setQuery(event.target.value)}
                placeholder="Search tasks"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-zinc-200 outline-none placeholder:text-neutral-700"
              />
            </div>
            <select
              value={taskList.category}
              onChange={(event) => taskList.setCategory(event.target.value)}
              className="min-h-11 rounded-2xl border border-white/[0.06] bg-neutral-950 px-2 font-mono text-[11px] text-neutral-400 outline-none sm:max-w-[132px]"
              aria-label="Filter task category"
            >
              <option value="">All</option>
              {taskList.category && !taskList.categories.includes(taskList.category) && (
                <option value={taskList.category}>{taskList.category}</option>
              )}
              {taskList.categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {taskList.error && (
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-black/20 px-3 font-sans-hermes text-[12px] text-neutral-500">
              <span className="min-w-0 truncate">Tasks unavailable: {taskList.error}</span>
              <button type="button" onClick={() => void refreshAll()} className="shrink-0 font-mono text-[10px] uppercase text-neutral-400">
                Retry
              </button>
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="min-h-0 overflow-y-auto pr-1 ios-scrollable no-scrollbar">
              {taskList.loading && taskList.filteredTasks.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />)}
                </div>
              ) : groupedTasks.every((group) => group.tasks.length === 0) ? (
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-8 text-center font-serif-hermes text-[15px] italic text-neutral-600">
                  {taskList.status === 'active' && !taskList.query.trim() ? "No pending tasks. You're caught up." : 'No matching tasks.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {groupedTasks.map((group) => group.tasks.length > 0 && (
                    <section key={group.key} className="space-y-2">
                      <div className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider ${
                        group.attention ? 'text-red-200/60' : 'text-neutral-650'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${group.attention ? 'bg-red-200/45' : 'bg-neutral-800'}`} />
                        {group.title}
                      </div>
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          today={today}
                          selected={selectedTaskId === task.id}
                          onOpen={() => setSelectedTaskId(task.id)}
                        />
                      ))}
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden min-h-0 overflow-y-auto rounded-2xl border border-white/[0.04] bg-black/20 p-3 ios-scrollable no-scrollbar md:block">
              {selectedTask ? (
                <TaskDetailPanel
                  task={selectedTask}
                  today={today}
                  busy={taskList.busyTaskId === selectedTask.id}
                  onSave={(taskId, patch) => runAction(() => taskList.updateTask(taskId, patch))}
                  onDone={(taskId) => runAction(() => taskList.markDone(taskId))}
                  onTomorrow={(taskId) => runAction(() => taskList.postponeToTomorrow(taskId))}
                  onCancelTask={(taskId) => runAction(() => taskList.cancelTask(taskId))}
                />
              ) : (
                <div className="flex min-h-[14rem] items-center justify-center text-center font-serif-hermes text-[15px] italic text-neutral-600">
                  Select a task.
                </div>
              )}
            </div>
          </div>
        </div>

        {selectedTask && (
          <div className="min-h-0 flex-1 overflow-y-auto p-3 ios-scrollable no-scrollbar md:hidden">
            <TaskDetailPanel
              task={selectedTask}
              today={today}
              busy={taskList.busyTaskId === selectedTask.id}
              onSave={(taskId, patch) => runAction(() => taskList.updateTask(taskId, patch))}
              onDone={(taskId) => runAction(() => taskList.markDone(taskId))}
              onTomorrow={(taskId) => runAction(() => taskList.postponeToTomorrow(taskId))}
              onCancelTask={(taskId) => runAction(() => taskList.cancelTask(taskId))}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export const TaskCenterDialog = TaskCenter;

type TaskGroup = {
  key: string;
  title: string;
  attention?: boolean;
  tasks: TaskItem[];
};

const groupTasks = (tasks: TaskItem[], today: string): TaskGroup[] => {
  const overdue: TaskItem[] = [];
  const dueToday: TaskItem[] = [];
  const upcoming: TaskItem[] = [];
  const noDeadline: TaskItem[] = [];

  tasks.forEach((task) => {
    if (!task.deadline) {
      noDeadline.push(task);
    } else if (isOverdue(task, today)) {
      overdue.push(task);
    } else if (task.deadline === today) {
      dueToday.push(task);
    } else {
      upcoming.push(task);
    }
  });

  return [
    { key: 'overdue', title: 'Overdue', attention: true, tasks: overdue },
    { key: 'today', title: 'Today', tasks: dueToday },
    { key: 'upcoming', title: 'Upcoming', tasks: upcoming },
    { key: 'none', title: 'No deadline', tasks: noDeadline },
  ];
};

const FocusCard = ({
  task,
  today,
  busy,
  onOpen,
  onDone,
  onTomorrow,
}: {
  task: TaskItem;
  today: string;
  busy: boolean;
  onOpen: () => void;
  onDone: () => void;
  onTomorrow: () => void;
}) => {
  const inactive = task.status === 'done' || task.status === 'cancelled';

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-3">
      <button type="button" onClick={onOpen} className="block w-full text-left active:scale-[0.99]">
        <div className="font-serif-hermes text-[17px] italic text-zinc-100">Focus</div>
        <div className="mt-2 text-[14px] leading-snug text-zinc-200">{task.title}</div>
        <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
          {taskMeta(task, today)}
        </div>
      </button>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onDone}
          disabled={busy || inactive}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-[12px] font-medium text-black disabled:bg-neutral-850 disabled:text-neutral-600 active:scale-[0.98]"
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </button>
        <button
          type="button"
          onClick={onTomorrow}
          disabled={busy || inactive}
          className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.08] text-[12px] text-neutral-300 disabled:text-neutral-700 active:scale-[0.98]"
        >
          <Clock3 className="h-3.5 w-3.5" />
          Tomorrow
        </button>
      </div>
    </div>
  );
};

const TaskRow = ({
  task,
  today,
  selected,
  onOpen,
}: {
  task: TaskItem;
  today: string;
  selected: boolean;
  onOpen: () => void;
}) => {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block min-h-[64px] w-full rounded-2xl border px-3 py-2.5 text-left active:scale-[0.99] ${
        selected ? 'border-white/15 bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.025]'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] text-zinc-200">{task.title}</div>
          <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
            {taskMeta(task, today)}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="max-w-[88px] truncate rounded-full border border-white/[0.06] px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
            {statusLabel(task.status)}
          </span>
          <ChevronRight className="h-4 w-4 text-neutral-700" />
        </div>
      </div>
    </button>
  );
};
