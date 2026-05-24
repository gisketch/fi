import { StoredSession } from '../../types/hermes';
import { motion } from 'framer-motion';
import { RefreshCw, X, Trash2, FolderGit, Edit } from 'lucide-react';

interface SessionsDialogProps {
  sessions: StoredSession[];
  loading: boolean;
  error: string | null;
  currentThreadId: string | null;
  onRefresh: () => void;
  onClose: () => void;
  onConnectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onBranchSession?: (sessionId: string) => void;
  onRenameSession?: (sessionId: string, newTitle: string) => void;
}

const formatSessionTime = (timestamp?: number) => {
  if (!timestamp) return 'unknown';
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'unknown';
  }
};

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
}: SessionsDialogProps) => {
  const handleRename = (id: string, currentTitle: string) => {
    if (!onRenameSession) return;
    const title = prompt('Enter new session title:', currentTitle);
    if (title && title.trim()) {
      onRenameSession(id, title.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 backdrop-blur-xl sm:items-center animate-fade-in"
      onClick={onClose}
    >
      <motion.div 
        role="dialog" 
        aria-modal="true" 
        aria-label="Hermes sessions"
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
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

          <div className="space-y-2">
            {sessions.map((session) => (
              <div 
                key={session.id} 
                className={`w-full rounded-2xl p-3 flex flex-col gap-2 relative transition-colors ${
                  currentThreadId === session.id 
                    ? 'bg-white/[0.06] border border-white/[0.06]' 
                    : 'bg-white/[0.025] hover:bg-white/[0.04]'
                }`}
              >
                <div 
                  onClick={() => onConnectSession(session.id)}
                  className="cursor-pointer flex-1"
                >
                  <div className="truncate font-serif-hermes text-[16px] italic text-zinc-200">
                    {session.title || 'Untitled Session'}
                  </div>
                  {session.preview && (
                    <div className="mt-1 line-clamp-1 font-sans-hermes text-[12px] text-neutral-500">
                      {session.preview}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between gap-3 font-sans-hermes text-[11px] text-neutral-600">
                    <span>{session.message_count ?? 0} messages</span>
                    <span>{formatSessionTime(session.updated_at || session.started_at)}</span>
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-end gap-3 pt-2 border-t border-white/[0.025]">
                  {onBranchSession && (
                    <button
                      onClick={() => onBranchSession(session.id)}
                      className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
                      title="Branch Session"
                    >
                      <FolderGit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {onRenameSession && (
                    <button
                      onClick={() => handleRename(session.id, session.title)}
                      className="p-1 rounded text-neutral-500 hover:text-white transition-colors"
                      title="Rename Session"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    className="p-1 rounded text-neutral-500 hover:text-red-400 transition-colors"
                    title="Delete Session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
