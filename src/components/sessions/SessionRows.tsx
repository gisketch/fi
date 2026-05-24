import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { motion } from 'framer-motion';
import { StoredSession } from '../../types/hermes';
import { FolderGit, Pencil, Pin, Radio, Trash2 } from 'lucide-react';

export type SessionStatusLabel = 'running' | 'idle' | 'unknown';

export interface SessionRowModel extends StoredSession {
  running?: boolean;
  statusLabel?: SessionStatusLabel;
  statusError?: string;
  isLastOpened?: boolean;
  isPinned?: boolean;
  isActive?: boolean;
}

interface SessionRowsProps {
  sessions: SessionRowModel[];
  currentThreadId: string | null;
  onConnectSession: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onBranchSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  onTogglePinSession?: (sessionId: string) => void;
  limit?: number;
  virtualized?: boolean;
  showActions?: boolean;
  className?: string;
}

const virtualRowHeight = 78;
const virtualOverscan = 4;
const swipeThreshold = 72;
const swipeLimit = 96;

type SwipeState = {
  pointerId: number;
  startX: number;
  startY: number;
  mode: 'pending' | 'horizontal' | 'vertical';
} | null;

export const formatSessionTime = (timestamp?: number) => {
  if (!timestamp) return 'unknown';
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'unknown';
  }
};

const SessionRow = ({
  session,
  currentThreadId,
  onConnectSession,
  onDeleteSession,
  onBranchSession,
  onRenameSession,
  onTogglePinSession,
  showActions = true,
}: Omit<SessionRowsProps, 'sessions' | 'limit' | 'virtualized' | 'className'> & { session: SessionRowModel }) => {
  const active = currentThreadId === session.id || Boolean(session.isActive);
  const running = Boolean(session.running);
  const canSwipePin = Boolean(onTogglePinSession);
  const canSwipeDelete = Boolean(onDeleteSession);
  const [pinFlash, setPinFlash] = useState(false);
  const [deleteFlash, setDeleteFlash] = useState(false);
  const [swipeReveal, setSwipeReveal] = useState<'pin' | 'delete' | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const suppressClickRef = useRef(false);
  const swipeRef = useRef<SwipeState>(null);
  const swipeXRef = useRef(0);

  const handleRename = (id: string, currentTitle: string) => {
    if (!onRenameSession) return;
    const title = prompt('Enter new session title:', currentTitle);
    if (title && title.trim()) {
      onRenameSession(id, title.trim());
    }
  };

  const triggerPin = () => {
    if (!onTogglePinSession) return;
    onTogglePinSession(session.id);
    setPinFlash(true);
    window.setTimeout(() => setPinFlash(false), 700);
  };

  const triggerDelete = () => {
    if (!onDeleteSession) return;
    setDeleteFlash(true);
    suppressClickRef.current = true;
    window.setTimeout(() => {
      onDeleteSession(session.id);
      setDeleteFlash(false);
    }, 120);
  };

  const resetSwipe = () => {
    swipeXRef.current = 0;
    setSwipeX(0);
    setSwipeReveal(null);
    swipeRef.current = null;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canSwipePin && !canSwipeDelete) return;
    swipeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mode: 'pending',
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - swipe.startX;
    const deltaY = event.clientY - swipe.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (swipe.mode === 'pending') {
      if (absY > 8 && absY > absX) {
        swipeRef.current = { ...swipe, mode: 'vertical' };
        return;
      }
      if (absX < 12 || absX < absY * 1.2) return;
      swipeRef.current = { ...swipe, mode: 'horizontal' };
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    if (swipeRef.current?.mode !== 'horizontal') return;
    event.preventDefault();

    const nextX = Math.max(canSwipeDelete ? -swipeLimit : 0, Math.min(canSwipePin ? swipeLimit : 0, deltaX));
    swipeXRef.current = nextX;
    setSwipeX(nextX);
    if (nextX > 12) {
      setSwipeReveal('pin');
    } else if (nextX < -12) {
      setSwipeReveal('delete');
    } else {
      setSwipeReveal(null);
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const swipe = swipeRef.current;
    if (!swipe || swipe.pointerId !== event.pointerId) return;

    const horizontal = swipe.mode === 'horizontal';
    const finalX = swipeXRef.current;
    resetSwipe();

    if (horizontal) {
      if (canSwipePin && finalX > swipeThreshold) {
        triggerPin();
      } else if (canSwipeDelete && finalX < -swipeThreshold) {
        triggerDelete();
      }
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 650);
    }
  };

  return (
    <div className="relative h-[72px] overflow-hidden rounded-2xl">
      {canSwipePin && (
        <div className={`absolute inset-y-0 left-0 flex w-24 items-center justify-start pl-4 text-zinc-100 transition-opacity ${pinFlash || swipeReveal === 'pin' ? 'opacity-100' : 'opacity-0'}`}>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.06] ${pinFlash ? 'animate-ping' : ''}`} />
          <Pin className={`absolute left-6 h-4 w-4 ${session.isPinned ? 'fill-current text-zinc-100' : 'text-neutral-400'} ${pinFlash ? 'pulse-white-glow' : ''}`} />
        </div>
      )}
      {canSwipeDelete && (
        <div className={`absolute inset-y-0 right-0 flex w-24 items-center justify-end pr-4 text-red-200 transition-opacity ${deleteFlash || swipeReveal === 'delete' ? 'opacity-100' : 'opacity-0'}`}>
          <span className={`flex h-8 w-8 items-center justify-center rounded-full border border-red-300/10 bg-red-500/10 ${deleteFlash ? 'animate-ping' : ''}`} />
          <Trash2 className={`absolute right-6 h-4 w-4 ${deleteFlash ? 'text-red-200' : 'text-red-300/70'}`} />
        </div>
      )}

      <motion.div
        animate={{ x: swipeX, scale: swipeX ? 0.99 : 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.65 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        className={`relative flex h-full w-full flex-col justify-center rounded-2xl px-3 py-2 transition-colors ${
          active
            ? 'border border-white/[0.08] bg-neutral-900'
            : session.isPinned
              ? 'border border-white/[0.08] bg-white/[0.045]'
              : session.isLastOpened
                ? 'border border-white/[0.06] bg-white/[0.035]'
                : 'bg-white/[0.022] hover:bg-white/[0.035]'
        }`}
        style={{ touchAction: 'pan-y' }}
      >
        <button
          type="button"
          onClick={() => {
            if (suppressClickRef.current) return;
            onConnectSession(session.id);
          }}
          className="min-w-0 cursor-pointer text-left active:scale-[0.99]"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-serif-hermes text-[14px] italic text-zinc-200">
                {session.title || 'Untitled Session'}
              </div>
              {session.preview && (
                <div className="mt-0.5 line-clamp-1 font-sans-hermes text-[11px] text-neutral-500">
                  {session.preview}
                </div>
              )}
            </div>
            {running && (
              <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-emerald-200">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                <span>Running</span>
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 font-sans-hermes text-[10px] text-neutral-600">
            <span className="truncate">{session.isPinned ? 'Pinned' : active ? 'Active' : session.isLastOpened ? 'Last opened' : ''}</span>
            <span>{formatSessionTime(session.updated_at || session.started_at)}</span>
          </div>
        </button>

        {showActions && (onBranchSession || onRenameSession || onDeleteSession) && (
          <div className="absolute bottom-1.5 right-2 flex items-center gap-2">
            {onBranchSession && (
              <button
                type="button"
                onClick={() => onBranchSession(session.id)}
                className="rounded p-1 text-neutral-500 transition-colors hover:text-white"
                title="Branch session"
                aria-label="Branch session"
              >
                <FolderGit className="h-3.5 w-3.5" />
              </button>
            )}
            {onRenameSession && (
              <button
                type="button"
                onClick={() => handleRename(session.id, session.title)}
                className="rounded p-1 text-neutral-500 transition-colors hover:text-white"
                title="Rename session"
                aria-label="Rename session"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onDeleteSession && (
              <button
                type="button"
                onClick={() => onDeleteSession(session.id)}
                className="rounded p-1 text-neutral-500 transition-colors hover:text-red-400"
                title="Delete session"
                aria-label="Delete session"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {showActions && (session.isPinned || session.isLastOpened || active) && (
          <div className="pointer-events-none absolute bottom-2 left-3 text-neutral-600">
            {session.isPinned ? <Pin className="h-2.5 w-2.5 fill-current" /> : <Radio className={`h-2.5 w-2.5 ${active ? 'text-emerald-300' : ''}`} />}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export const SessionRows = ({
  sessions,
  currentThreadId,
  onConnectSession,
  onDeleteSession,
  onBranchSession,
  onRenameSession,
  onTogglePinSession,
  limit,
  virtualized = false,
  showActions = true,
  className,
}: SessionRowsProps) => {
  const visibleSessions = typeof limit === 'number' ? sessions.slice(0, limit) : sessions;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(360);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!virtualized || !scrollRef.current) return;
    const node = scrollRef.current;
    const updateHeight = () => setViewportHeight(node.clientHeight || 360);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [virtualized]);

  const virtualWindow = useMemo(() => {
    if (!virtualized) {
      return { start: 0, end: visibleSessions.length, offsetY: 0, totalHeight: 0 };
    }

    const start = Math.max(0, Math.floor(scrollTop / virtualRowHeight) - virtualOverscan);
    const end = Math.min(
      visibleSessions.length,
      Math.ceil((scrollTop + viewportHeight) / virtualRowHeight) + virtualOverscan
    );
    return {
      start,
      end,
      offsetY: start * virtualRowHeight,
      totalHeight: visibleSessions.length * virtualRowHeight,
    };
  }, [scrollTop, viewportHeight, visibleSessions.length, virtualized]);

  if (!virtualized) {
    return (
      <div className={`space-y-1.5 ${className || ''}`}>
        {visibleSessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            currentThreadId={currentThreadId}
            onConnectSession={onConnectSession}
            onDeleteSession={onDeleteSession}
            onBranchSession={onBranchSession}
            onRenameSession={onRenameSession}
            onTogglePinSession={onTogglePinSession}
            showActions={showActions}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      className={`overflow-y-auto py-3 pr-1 ios-scrollable no-scrollbar ${className || ''}`}
    >
      <div style={{ height: virtualWindow.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${virtualWindow.offsetY}px)` }} className="space-y-1.5">
          {visibleSessions.slice(virtualWindow.start, virtualWindow.end).map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              currentThreadId={currentThreadId}
              onConnectSession={onConnectSession}
              onDeleteSession={onDeleteSession}
              onBranchSession={onBranchSession}
              onRenameSession={onRenameSession}
              onTogglePinSession={onTogglePinSession}
              showActions={showActions}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
