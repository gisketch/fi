import { motion } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { SessionRowModel, SessionRows } from '../sessions/SessionRows';

interface SessionsDialogProps {
  sessions: SessionRowModel[];
  loading: boolean;
  error: string | null;
  currentThreadId: string | null;
  onRefresh: () => void;
  onClose: () => void;
  onConnectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onBranchSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
  onTogglePinSession?: (sessionId: string) => void;
  reduceMotion?: boolean;
}

export const SessionsDialog = ({
  sessions,
  loading,
  error,
  currentThreadId,
  onRefresh,
  onClose,
  onConnectSession,
  onDeleteSession,
  onBranchSession,
  onRenameSession,
  onTogglePinSession,
  reduceMotion = false,
}: SessionsDialogProps) => {
  return (
    <div 
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 backdrop-blur-xl sm:items-center animate-fade-in"
      onClick={onClose}
    >
      <motion.div 
        role="dialog" 
        aria-modal="true" 
        aria-label="Hermes sessions"
        initial={{ opacity: 0, y: 18, filter: reduceMotion ? 'blur(0px)' : 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, filter: reduceMotion ? 'blur(0px)' : 'blur(8px)' }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[82vh] w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
          <div>
            <div className="font-serif-hermes text-[18px] italic text-zinc-200">Hermes Sessions</div>
            <div className="font-sans-hermes text-[11px] text-neutral-600">Saved remote VPS container runs</div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button" 
              onClick={onRefresh} 
              className="rounded-full p-1 text-neutral-500 active:scale-95" 
              aria-label="Refresh sessions"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="rounded-full p-1 text-neutral-500 active:scale-95" 
              aria-label="Close sessions"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-auto p-4 ios-scrollable no-scrollbar">
          {error && <div className="rounded-2xl bg-red-950/20 p-3 font-sans-hermes text-[12px] text-red-200/70">{error}</div>}
          
          {sessions.length === 0 && !loading && (
            <div className="py-8 text-center font-serif-hermes text-[15px] italic text-neutral-600">
              No sessions found. Create a new turn in composer to start.
            </div>
          )}

          <SessionRows
            sessions={sessions}
            currentThreadId={currentThreadId}
            onConnectSession={onConnectSession}
            onDeleteSession={onDeleteSession}
            onBranchSession={onBranchSession}
            onRenameSession={onRenameSession}
            onTogglePinSession={onTogglePinSession}
          />
        </div>
      </motion.div>
    </div>
  );
};
