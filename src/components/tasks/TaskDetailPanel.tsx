import { useEffect, useState } from 'react';
import { Check, ChevronLeft, Clock3, Save, XCircle } from 'lucide-react';
import type { TaskItem, TaskPriority, TaskStatus, TaskUpdateRequest } from '../../types/tasks';
import { deadlineLabel, priorityLabel, statusLabel } from './taskFormat';

interface TaskDetailPanelProps {
  task: TaskItem;
  today?: string;
  busy: boolean;
  onSave: (taskId: number, patch: TaskUpdateRequest) => Promise<void>;
  onDone: (taskId: number) => Promise<void>;
  onTomorrow: (taskId: number) => Promise<void>;
  onCancelTask: (taskId: number) => Promise<void>;
  onBack?: () => void;
}

const priorityOptions: TaskPriority[] = [1, 2, 3];
const statusOptions: TaskStatus[] = ['pending', 'in_progress', 'done', 'cancelled'];

export const TaskDetailPanel = ({
  task,
  today,
  busy,
  onSave,
  onDone,
  onTomorrow,
  onCancelTask,
  onBack,
}: TaskDetailPanelProps) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [deadline, setDeadline] = useState(task.deadline || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [category, setCategory] = useState(task.category || '');

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setDeadline(task.deadline || '');
    setPriority(task.priority);
    setStatus(task.status);
    setCategory(task.category || '');
  }, [task]);

  const canSave = title.trim().length > 0 && !busy;
  const inactive = task.status === 'done' || task.status === 'cancelled';

  const save = async () => {
    if (!canSave) return;
    await onSave(task.id, {
      title: title.trim(),
      description: description.trim(),
      deadline: deadline || null,
      priority,
      status,
      category: category.trim(),
    });
  };

  return (
    <div className="flex min-h-full flex-col gap-3">
      <div className="flex items-start gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.06] text-neutral-500 active:scale-95 md:hidden"
            aria-label="Back to tasks"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0">
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
            #{task.id} / {deadlineLabel(task, today)}
          </div>
          <div className="mt-1 truncate font-serif-hermes text-[17px] italic text-zinc-200">
            Task Detail
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2.5">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-600">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="min-h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 text-[14px] text-zinc-100 outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-600">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5 text-[13px] leading-relaxed text-zinc-200 outline-none no-scrollbar"
          />
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-600">Deadline</span>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 font-mono text-[12px] text-zinc-200 outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-600">Category</span>
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-11 w-full rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 text-[13px] text-zinc-200 outline-none"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-600">Priority</span>
            <select
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value) as TaskPriority)}
              className="min-h-11 w-full rounded-2xl border border-white/[0.06] bg-neutral-950 px-3 font-mono text-[12px] text-zinc-200 outline-none"
            >
              {priorityOptions.map((option) => (
                <option key={option} value={option}>{priorityLabel(option)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-neutral-600">Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              className="min-h-11 w-full rounded-2xl border border-white/[0.06] bg-neutral-950 px-3 font-mono text-[12px] text-zinc-200 outline-none"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>{statusLabel(option)}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-3 -mb-3 grid grid-cols-2 gap-2 border-t border-white/[0.04] bg-neutral-950/95 px-3 pb-3 pt-3 backdrop-blur-xl md:static md:mx-0 md:mb-0 md:border-0 md:bg-transparent md:p-0">
        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-white text-[12px] font-medium text-black disabled:bg-neutral-850 disabled:text-neutral-600 active:scale-[0.98]"
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </button>
        <button
          type="button"
          onClick={() => void onDone(task.id)}
          disabled={busy || inactive}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.08] text-[12px] text-neutral-300 disabled:text-neutral-700 active:scale-[0.98]"
        >
          <Check className="h-3.5 w-3.5" />
          Done
        </button>
        <button
          type="button"
          onClick={() => void onTomorrow(task.id)}
          disabled={busy || inactive}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.08] text-[12px] text-neutral-300 disabled:text-neutral-700 active:scale-[0.98]"
        >
          <Clock3 className="h-3.5 w-3.5" />
          Tomorrow
        </button>
        <button
          type="button"
          onClick={() => void onCancelTask(task.id)}
          disabled={busy || task.status === 'cancelled'}
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/[0.08] text-[12px] text-neutral-500 disabled:text-neutral-700 active:scale-[0.98]"
        >
          <XCircle className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  );
};
