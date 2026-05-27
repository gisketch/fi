import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock3, ListTodo, RefreshCw, Search, Sparkles, X, XCircle } from 'lucide-react';
import { taskStatusLabels, useTaskList } from '../../hooks/useTaskList';
import type { TaskItem, TaskListStatus } from '../../types/tasks';
import { isOverdue, statusLabel, taskMeta, todayInManila } from './taskFormat';
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
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 backdrop-blur-xl sm:items-center"
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
        className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.04] px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-serif-hermes text-[18px] italic text-zinc-200">
              <ListTodo className="h-4 w-4 text-neutral-500" />
              Tasks
            </div>
            <div className="font-sans-hermes text-[11px] text-neutral-600">VPS task loop</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={openAddWithFi} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Add task with Fi">
              <Sparkles className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => void taskList.refresh()} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Refresh tasks">
              <RefreshCw className={`h-4 w-4 ${taskList.loading ? 'animate-spin' : ''}`} />
            </button>
            <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Close tasks">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {statusTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => taskList.setStatus(tab)}
                className={`shrink-0 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider active:scale-[0.98] ${
                  taskList.status === tab
                    ? 'bg-white text-black'
                    : 'border border-white/[0.06] text-neutral-500'
                }`}
              >
                {taskStatusLabels[tab]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="flex min-h-10 min-w-0 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3">
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
              className="max-w-[132px] rounded-2xl border border-white/[0.06] bg-neutral-950 px-2 font-mono text-[11px] text-neutral-400 outline-none"
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
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-red-950/20 p-3 font-sans-hermes text-[12px] text-red-200/70">
              <span className="min-w-0 truncate">Tasks unavailable: {taskList.error}</span>
              <button type="button" onClick={() => void taskList.refresh()} className="shrink-0 font-mono text-[10px] uppercase text-neutral-400">
                Retry
              </button>
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="min-h-[18rem] overflow-y-auto pr-1 ios-scrollable no-scrollbar">
              {taskList.loading && taskList.filteredTasks.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />)}
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
                      busy={taskList.busyTaskId === task.id}
                      onOpen={() => setSelectedTaskId(task.id)}
                      onDone={() => void taskList.markDone(task.id)}
                      onTomorrow={() => void taskList.postponeToTomorrow(task.id)}
                      onCancelTask={() => void taskList.cancelTask(task.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto rounded-2xl border border-white/[0.04] bg-black/20 p-3 ios-scrollable no-scrollbar">
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
      </motion.div>
    </div>
  );
};

const TaskRow = ({
  task,
  today,
  selected,
  busy,
  onOpen,
  onDone,
  onTomorrow,
  onCancelTask,
}: {
  task: TaskItem;
  today: string;
  selected: boolean;
  busy: boolean;
  onOpen: () => void;
  onDone: () => void;
  onTomorrow: () => void;
  onCancelTask: () => void;
}) => {
  const inactive = task.status === 'done' || task.status === 'cancelled';

  return (
    <div className={`rounded-2xl border p-3 ${selected ? 'border-white/15 bg-white/[0.06]' : 'border-white/[0.05] bg-white/[0.025]'}`}>
      <button type="button" onClick={onOpen} className="block w-full text-left active:scale-[0.99]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] text-zinc-200">{task.title}</div>
            <div className={`mt-1 truncate font-mono text-[10px] uppercase tracking-wider ${
              isOverdue(task, today) ? 'text-red-200/70' : 'text-neutral-600'
            }`}>
              {taskMeta(task, today)}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-white/[0.06] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-500">
            {statusLabel(task.status)}
          </span>
        </div>
      </button>
      <div className="mt-3 flex items-center gap-1.5">
        <SmallAction label="Open" onClick={onOpen} disabled={busy} />
        <SmallAction icon={<Check className="h-3 w-3" />} label="Done" onClick={onDone} disabled={busy || inactive} />
        <SmallAction icon={<Clock3 className="h-3 w-3" />} label="Tomorrow" onClick={onTomorrow} disabled={busy || inactive} />
        <SmallAction icon={<XCircle className="h-3 w-3" />} label="Cancel" onClick={onCancelTask} disabled={busy || task.status === 'cancelled'} danger />
      </div>
    </div>
  );
};

const SmallAction = ({
  icon,
  label,
  disabled,
  danger = false,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex min-h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-2 text-[10px] disabled:text-neutral-700 active:scale-[0.98] ${
      danger ? 'border-red-400/10 text-red-200/70' : 'border-white/[0.07] text-neutral-400'
    }`}
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);
