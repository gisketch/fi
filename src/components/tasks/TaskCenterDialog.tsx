import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ListTodo, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { taskStatusLabels, useTaskList } from '../../hooks/useTaskList';
import type { TaskItem, TaskListStatus } from '../../types/tasks';
import { statusLabel, taskMeta, todayInManila } from './taskFormat';
import { TaskDetailPanel } from './TaskDetailPanel';

interface TaskCenterDialogProps {
  refreshKey?: number;
  reduceMotion?: boolean;
  onClose: () => void;
  onAddWithFi: () => void;
}

const statusTabs: TaskListStatus[] = ['active', 'pending', 'in_progress', 'done', 'cancelled', 'all'];

export const TaskCenterDialog = ({
  refreshKey = 0,
  reduceMotion = false,
  onClose,
  onAddWithFi,
}: TaskCenterDialogProps) => {
  const taskList = useTaskList(refreshKey);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const today = todayInManila();
  const selectedTask = useMemo(
    () => taskList.tasks.find((task) => task.id === selectedTaskId) || null,
    [selectedTaskId, taskList.tasks],
  );

  useEffect(() => {
    if (selectedTaskId && !selectedTask) setSelectedTaskId(null);
  }, [selectedTask, selectedTaskId]);

  const openAddWithFi = () => {
    onClose();
    onAddWithFi();
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
                <span>{selectedTask ? 'Task' : 'Tasks'}</span>
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
            <button type="button" onClick={() => void taskList.refresh()} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 active:scale-95" aria-label="Refresh tasks">
              <RefreshCw className={`h-4 w-4 ${taskList.loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 active:scale-95" aria-label="Close tasks">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`min-h-0 flex-1 flex-col gap-3 p-3 sm:p-4 ${selectedTask ? 'hidden md:flex' : 'flex'}`}>
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
              <button type="button" onClick={() => void taskList.refresh()} className="shrink-0 font-mono text-[10px] uppercase text-neutral-400">
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
              ) : taskList.filteredTasks.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-8 text-center font-serif-hermes text-[15px] italic text-neutral-600">
                  No matching tasks.
                </div>
              ) : (
                <div className="space-y-2">
                  {taskList.filteredTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      today={today}
                      selected={selectedTaskId === task.id}
                      onOpen={() => setSelectedTaskId(task.id)}
                    />
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
                  onSave={taskList.updateTask}
                  onDone={taskList.markDone}
                  onTomorrow={taskList.postponeToTomorrow}
                  onCancelTask={taskList.cancelTask}
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
              onSave={taskList.updateTask}
              onDone={taskList.markDone}
              onTomorrow={taskList.postponeToTomorrow}
              onCancelTask={taskList.cancelTask}
            />
          </div>
        )}
      </motion.div>
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
