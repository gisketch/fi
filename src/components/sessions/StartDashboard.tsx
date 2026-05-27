import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Search, X } from 'lucide-react';
import { SessionRowModel, SessionRows } from './SessionRows';
import { randomDashboardHeroCopy } from '../../copy/fiPersonality';
import { TaskFocusWidget } from '../tasks/TaskFocusWidget';

interface StartDashboardProps {
  sessions: SessionRowModel[];
  currentThreadId: string | null;
  loading: boolean;
  error: string | null;
  onOpenSession: (sessionId: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onRefresh: () => void;
  onOpenTasks: () => void;
  onAddTaskWithFi: () => void;
  taskRefreshKey?: number;
}

export const StartDashboard = ({
  sessions,
  currentThreadId,
  loading,
  error,
  onOpenSession,
  onTogglePinSession,
  onDeleteSession,
  onRefresh,
  onOpenTasks,
  onAddTaskWithFi,
  taskRefreshKey = 0,
}: StartDashboardProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const heroCopy = useMemo(() => randomDashboardHeroCopy(), []);
  const filteredSessions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sessions;

    return sessions
      .map((session) => ({ session, score: fuzzyScore(`${session.title || ''} ${session.preview || ''}`.toLowerCase(), needle) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.session);
  }, [query, sessions]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="flex h-full min-h-0 flex-col gap-5 py-8"
    >
      <div className="shrink-0 space-y-5 select-none text-center">
        <h2 className="mx-auto max-w-xs font-serif-hermes text-[26px] font-light leading-snug tracking-wide text-neutral-300">
          {heroCopy.title}
        </h2>
        <p className="mx-auto max-w-[190px] font-serif-hermes text-[14px] italic leading-relaxed text-neutral-500">
          {heroCopy.subtitle}
        </p>
      </div>

      <TaskFocusWidget
        refreshKey={taskRefreshKey}
        onOpenTasks={onOpenTasks}
        onAddWithFi={onAddTaskWithFi}
      />

      <div className="flex shrink-0 items-center justify-between gap-4 pt-2">
        {searchOpen ? (
          <div className="flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="fzf sessions"
              className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-zinc-300 outline-none placeholder:text-neutral-700"
            />
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
              className="shrink-0 text-neutral-600 active:scale-95"
              aria-label="Close session search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Recent</div>
        )}
        <div className="flex shrink-0 items-center gap-2">
          {!searchOpen && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.025] text-neutral-500 active:scale-95"
              aria-label="Search sessions"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.06] bg-white/[0.025] text-neutral-500 active:scale-95"
            aria-label="Refresh sessions"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-2xl border border-red-400/10 bg-red-950/20 p-3 font-mono text-[11px] text-red-200/70">
          {error}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-black to-transparent" />
        <div className="h-full min-h-[12rem]">
          {filteredSessions.length > 0 ? (
            <SessionRows
              sessions={filteredSessions}
              currentThreadId={currentThreadId}
              onConnectSession={onOpenSession}
              onTogglePinSession={onTogglePinSession}
              onDeleteSession={onDeleteSession}
              virtualized
              showActions={false}
              className="h-full"
            />
          ) : (
            <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] px-4 py-6 text-center font-serif-hermes text-[14px] italic text-neutral-600">
              {loading ? 'Loading sessions...' : query.trim() ? 'No matching sessions.' : 'No saved sessions found.'}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const fuzzyScore = (haystack: string, needle: string) => {
  let score = 0;
  let lastIndex = -1;

  for (const char of needle) {
    const index = haystack.indexOf(char, lastIndex + 1);
    if (index === -1) return -1;
    score += index === lastIndex + 1 ? 8 : Math.max(1, 6 - (index - lastIndex));
    lastIndex = index;
  }

  if (haystack.startsWith(needle)) score += 20;
  return score;
};
