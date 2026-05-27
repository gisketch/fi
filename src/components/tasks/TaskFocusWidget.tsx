import { Check, Clock3, ListTodo, RefreshCw, Sparkles } from 'lucide-react';
import { useTaskWidget } from '../../hooks/useTaskWidget';
import { isOverdue, taskMeta } from './taskFormat';

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
    <section className="rounded-[22px] border border-white/[0.06] bg-white/[0.025] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onOpenTasks}
          className="flex min-w-0 items-center gap-2 text-left active:scale-[0.99]"
        >
          <ListTodo className="h-4 w-4 shrink-0 text-neutral-500" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">Tasks</span>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-600 active:scale-95"
            aria-label="Refresh tasks"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onAddWithFi}
            className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 active:scale-95"
            aria-label="Add task with Fi"
            title="Add with Fi"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded-full bg-white/[0.08]" />
          <div className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      ) : error && !data ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-400/10 bg-red-950/20 px-3 py-2">
          <span className="min-w-0 truncate font-mono text-[11px] text-red-200/70">Tasks unavailable</span>
          <button type="button" onClick={() => void refresh()} className="shrink-0 font-mono text-[10px] uppercase text-neutral-400">
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Pending" value={data?.pending_count || 0} />
            <Stat label="Doing" value={data?.in_progress_count || 0} />
            <Stat label="Overdue" value={data?.overdue_count || 0} alert={Boolean(data?.overdue_count)} />
          </div>

          {focus ? (
            <div className={`rounded-2xl border px-3 py-3 ${
              isOverdue(focus, data?.today)
                ? 'border-red-400/10 bg-red-950/15'
                : 'border-white/[0.05] bg-black/20'
            }`}>
              <div className="min-w-0 font-sans-hermes text-[13px] leading-snug text-zinc-200">
                {focus.title}
              </div>
              <div className="mt-1 truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">
                {taskMeta(focus, data?.today)}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void markDone(focus.id)}
                  disabled={busyTaskId === focus.id}
                  className="flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-full bg-white text-[11px] font-medium text-black disabled:bg-neutral-850 disabled:text-neutral-600 active:scale-[0.98]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => void postponeToTomorrow(focus.id)}
                  disabled={busyTaskId === focus.id}
                  className="flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-white/[0.08] text-[11px] text-neutral-300 disabled:text-neutral-700 active:scale-[0.98]"
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  Tomorrow
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.04] bg-black/20 px-3 py-4 text-center font-serif-hermes text-[14px] italic text-neutral-600">
              No active tasks.
            </div>
          )}

          {error && <div className="font-mono text-[10px] text-red-200/60">Tasks unavailable. Showing last sync.</div>}
        </div>
      )}
    </section>
  );
};

const Stat = ({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) => (
  <div className="rounded-2xl border border-white/[0.04] bg-black/20 px-2 py-2 text-center">
    <div className={`font-mono text-[15px] ${alert ? 'text-red-200/80' : 'text-zinc-200'}`}>{value}</div>
    <div className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-neutral-700">{label}</div>
  </div>
);
