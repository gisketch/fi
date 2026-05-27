import type { ReactNode } from 'react';
import { Check, Clock3, ListTodo, RefreshCw, Sparkles } from 'lucide-react';
import { useTaskWidget } from '../../hooks/useTaskWidget';
import { taskMeta } from './taskFormat';

interface TaskFocusWidgetProps {
  refreshKey?: number;
  onOpenTasks: () => void;
  onAddWithFi: () => void;
}

export const TaskFocusWidget = ({ refreshKey = 0, onOpenTasks, onAddWithFi }: TaskFocusWidgetProps) => {
  const {
    data,
    loading,
    error,
    busyTaskId,
    refresh,
    markDone,
    postponeToTomorrow,
  } = useTaskWidget(refreshKey);

  const focus = data?.focus || null;

  return (
    <section className="rounded-[20px] border border-white/[0.055] bg-white/[0.022] p-3">
      <div className="mb-2 flex min-h-10 items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenTasks}
          className="flex min-h-10 min-w-0 items-center gap-2 text-left active:scale-[0.99]"
        >
          <ListTodo className="h-4 w-4 shrink-0 text-neutral-500" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Tasks</span>
        </button>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-600 active:scale-95"
            aria-label="Refresh tasks"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onAddWithFi}
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-500 active:scale-95"
            aria-label="Add task with Fi"
            title="Add with Fi"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : error && !data ? (
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-white/[0.05] bg-black/20 px-3">
          <span className="min-w-0 truncate font-mono text-[11px] text-neutral-500">Tasks unavailable</span>
          <button type="button" onClick={() => void refresh()} className="shrink-0 font-mono text-[10px] uppercase text-neutral-400">
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
            {data?.pending_count || 0} pending <span className="text-neutral-800">/</span> {data?.in_progress_count || 0} doing <span className="text-neutral-800">/</span> {data?.overdue_count || 0} past due
          </div>

          {focus ? (
            <div className="rounded-2xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
              <button type="button" onClick={onOpenTasks} className="block w-full text-left active:scale-[0.99]">
                <div className="min-w-0 truncate font-sans-hermes text-[13px] leading-snug text-zinc-200">
                  {focus.title}
                </div>
                <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
                  {taskMeta(focus, data?.today)}
                </div>
              </button>
              <div className="mt-2 flex items-center gap-2">
                <ActionButton
                  label="Done"
                  icon={<Check className="h-3.5 w-3.5" />}
                  disabled={busyTaskId === focus.id}
                  primary
                  onClick={() => void markDone(focus.id)}
                />
                <ActionButton
                  label="Tomorrow"
                  icon={<Clock3 className="h-3.5 w-3.5" />}
                  disabled={busyTaskId === focus.id}
                  onClick={() => void postponeToTomorrow(focus.id)}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.04] bg-black/20 px-3 py-3 text-center font-serif-hermes text-[14px] italic text-neutral-600">
              No active tasks.
            </div>
          )}

          {error && <div className="font-mono text-[10px] text-neutral-600">Tasks unavailable. Showing last sync.</div>}
        </div>
      )}
    </section>
  );
};

const ActionButton = ({
  label,
  icon,
  disabled,
  primary = false,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  primary?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[12px] font-medium disabled:bg-neutral-850 disabled:text-neutral-600 active:scale-[0.98] ${
      primary
        ? 'bg-white text-black'
        : 'border border-white/[0.08] text-neutral-300'
    }`}
  >
    {icon}
    {label}
  </button>
);
