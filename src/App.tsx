import { memo, useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useHermes, ToolActivity, ChatMessage, ChatSegment } from './hooks/useHermes';
import { getUsageData, UsageData } from './services/api';
import HermesGateway from './services/hermesGateway';
import { StoredSession } from './types/hermes';
import { SessionsDialog } from './components/dialogs/SessionsDialog';
import { ControlCenterDialog } from './components/dialogs/ControlCenterDialog';
import { BlockingPromptsDialog } from './components/dialogs/BlockingPromptsDialog';
import { enableNotifications, getNotificationSupport } from './services/notifications';
import { 
  ArrowUp, 
  StopCircle, 
  DangerTriangle, 
  Code
} from '@solar-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Copy, Layers, Menu, X, Brain } from 'lucide-react';
import { MarkdownMessage } from './components/MarkdownMessage';
import { VirtualMessage } from './components/VirtualMessage';

const getToolStatusLabel = (tool: ToolActivity) => {
  const running = tool.status === 'running';

  switch (tool.tool) {
    case 'terminal':
      return running ? 'Running terminal…' : 'Ran terminal';
    case 'read_file':
      return running ? 'Reading file…' : 'Read file';
    case 'search_files':
      return running ? 'Searching files…' : 'Searched files';
    case 'memory':
      return running ? 'Searching session…' : 'Searched session';
    case 'write_file':
      return running ? 'Writing file…' : 'Wrote file';
    case 'patch':
      return running ? 'Editing file…' : 'Edited file';
    case 'web_search':
    case 'browser':
      return running ? 'Browsing web…' : 'Browsed web';
    case 'cronjob':
      return running ? 'Scheduling work…' : 'Scheduled work';
    case 'clarify':
      return running ? 'Clarifying intent…' : 'Clarified intent';
    default:
      return running ? 'Working through step…' : 'Finished step';
  }
};

const getToolDisplayName = (tool?: string) => {
  if (!tool) return 'Tool call';
  switch (tool) {
    case 'terminal':
      return 'Terminal';
    case 'read_file':
      return 'Read file';
    case 'write_file':
      return 'Write file';
    case 'patch':
      return 'Patch';
    case 'search_files':
      return 'Search files';
    case 'web_search':
      return 'Web search';
    case 'browser':
      return 'Browser';
    case 'memory':
      return 'Memory';
    case 'cronjob':
      return 'Schedule';
    case 'clarify':
      return 'Clarify';
    default:
      return tool.replace(/_/g, ' ');
  }
};

const getDeepSeekBalance = (usage: UsageData) => {
  const total = usage.deepseek?.total;
  return typeof total === 'number' ? `$${total.toFixed(2)}` : '$--';
};

const getWeeklyCodexLimit = (usage: UsageData) => {
  const percent = usage.codex?.weekly?.used_percent ?? usage.codex?.week?.used_percent;
  return typeof percent === 'number' ? `${percent}%` : '--%';
};

const isMobileKeyboard = () => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;

  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches;
};

const chatEntrance = {
  initial: { opacity: 0, y: 8, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.34, ease: 'easeOut' },
};

const CharacterEntranceText = memo(({ text }: { text: string }) => (
  <span aria-label={text} className="whitespace-pre-wrap break-words">
    {Array.from(text).map((char, index) => (
      <motion.span
        key={`${char}-${index}`}
        aria-hidden="true"
        initial={{ opacity: 0, filter: 'blur(6px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ duration: 0.28, delay: Math.min(index * 0.008, 0.35), ease: 'easeOut' }}
      >
        {char}
      </motion.span>
    ))}
  </span>
));
CharacterEntranceText.displayName = 'CharacterEntranceText';

const ToolStatusText = memo(({ text, active }: { text: string; active: boolean }) => (
  <span aria-label={text} className="inline-flex flex-wrap items-baseline">
    {Array.from(text).map((char, index) => {
      if (char === ' ') {
        return <span key={`space-${index}`} aria-hidden="true" className="inline-block w-[0.28em] shrink-0" />;
      }

      return (
        <motion.span
          key={`${char}-${index}`}
          aria-hidden="true"
          className="inline-block"
          animate={active ? {
            color: ['rgba(163,163,163,0.58)', 'rgba(244,244,245,0.85)', 'rgba(163,163,163,0.58)'],
          } : {
            color: 'rgba(163,163,163,0.85)',
          }}
          style={{ textShadow: 'none' }}
          transition={active ? {
            duration: 1.45,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: index * 0.045,
          } : { duration: 0.2 }}
        >
          {char}
        </motion.span>
      );
    })}
  </span>
));
ToolStatusText.displayName = 'ToolStatusText';

const ToolRunDialog = ({ tools, onClose }: { tools: ToolActivity[]; onClose: () => void }) => (
  <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 backdrop-blur-xl sm:items-center" onClick={onClose}>
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Tool call details"
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
      transition={{ duration: 0.22 }}
      onClick={(event) => event.stopPropagation()}
      className="max-h-[76vh] w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
        <div className="min-w-0">
          <div className="font-serif-hermes text-[17px] italic text-zinc-200">Work trace</div>
          <div className="font-sans-hermes text-[11px] text-neutral-600">{tools.length} agent step{tools.length === 1 ? '' : 's'}</div>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[64vh] space-y-2 overflow-auto p-4">
        {tools.map((tool, index) => (
          <div key={tool.id} className="rounded-2xl bg-white/[0.025] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-neutral-300">
                <Code className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                <span className="truncate font-sans-hermes text-[13px] capitalize">{getToolDisplayName(tool.tool)}</span>
              </div>
              <span className={`shrink-0 font-mono text-[11px] ${
                tool.status === 'failed' ? 'text-red-300/70' : tool.status === 'running' ? 'text-white/70' : 'text-neutral-600'
              }`}>
                {tool.status === 'running' ? 'running' : tool.status === 'failed' ? 'failed' : `${tool.duration?.toFixed(1) || 'done'}s`}
              </span>
            </div>
            {tool.preview && (
              <div className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-neutral-500 [overflow-wrap:anywhere]">
                {tool.preview}
              </div>
            )}
            {!tool.preview && (
              <div className="mt-2 font-serif-hermes text-[14px] italic text-neutral-600">
                {tool.status === 'running' ? `Step ${index + 1} is still in motion.` : `Step ${index + 1} finished without extra output.`}
              </div>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  </div>
);



const ToolSegmentLine = memo(({ tool, tools, onOpen, className }: { 
  tool: ToolActivity; 
  tools: ToolActivity[]; 
  onOpen: () => void;
  className?: string;
}) => {
  const active = tool.status === 'running';
  const failed = tool.status === 'failed';

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 4, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.2 }}
      className={`hover:text-neutral-300 font-serif-hermes text-[15px] italic text-neutral-400 cursor-pointer flex items-center gap-2 outline-none select-none active:scale-[0.99] text-left ${failed ? 'text-red-300/70' : ''} ${active ? '' : 'opacity-70'} ${className || ''}`}
      aria-label={`Open work trace with ${tools.length} tool calls`}
    >
      <Code className={`w-3.5 h-3.5 text-neutral-500 shrink-0 ${active ? 'animate-pulse' : ''}`} />
      <ToolStatusText text={getToolStatusLabel(tool)} active={active} />
    </motion.button>
  );
});
ToolSegmentLine.displayName = 'ToolSegmentLine';

const spinnerStyles = [
  ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], // Standard Braille
  ['⠁⠂⠄⡀', '⠂⠄⡀⢀', '⠄⡀⢀⠠', '⡀⢀⠠⠐', '⢀⠠⠐⠈', '⠠⠐⠈⠁', '⠐⠈⠁⠂', '⠈⠁⠂⠄'], // Braille Wave
  ['⠋⠉⠙⠚', '⠉⠙⠚⠒', '⠙⠚⠒⠂', '⠚⠒⠂⠂', '⠒⠂⠂⠒', '⠂⠂⠒⠲', '⠂⠒⠲⠴', '⠒⠲⠴⠤', '⠲⠴⠤⠄', '⠴⠤⠄⠋', '⠤⠄⠋⠉', '⠄⠋⠉⠙'] // DNA helix
];

const fiLoadingMessages = [
  "Computing probabilities...",
  "Analyzing structural parameters...",
  "Calculating optimal vectors...",
  "Accessing remote databanks...",
  "Measuring aura levels...",
  "Aligning local modules...",
  "Performing context assessment...",
  "Parsing structural intent...",
  "Calibrating system response...",
  "Retrieving knowledge shards...",
  "Scanning local workspace...",
  "Computing 97% probability..."
];

const FiPendingIndicator = memo(() => {
  const [frame, setFrame] = useState(0);
  const [message, setMessage] = useState(fiLoadingMessages[Math.floor(Math.random() * fiLoadingMessages.length)]);
  
  // Pick one random spinner style on mount
  const spinnerFramesRef = useRef(spinnerStyles[Math.floor(Math.random() * spinnerStyles.length)]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % spinnerFramesRef.current.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Cycle text message every 1.5s
    const msgTimer = setInterval(() => {
      setMessage(fiLoadingMessages[Math.floor(Math.random() * fiLoadingMessages.length)]);
    }, 1500);
    return () => clearInterval(msgTimer);
  }, []);

  const charCount = spinnerFramesRef.current[0]?.length || 1;
  const widthClass = charCount === 1 ? 'w-5' : 'w-12';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.2 }}
      className="flex items-center gap-3 pt-2 select-none font-serif-hermes text-[15px] italic text-neutral-400"
    >
      <span className={`font-mono text-[17px] text-white/70 h-5 ${widthClass} flex items-center justify-center animate-pulse`}>
        {spinnerFramesRef.current[frame]}
      </span>
      <span className="animate-pulse">{message}</span>
    </motion.div>
  );
});
FiPendingIndicator.displayName = 'FiPendingIndicator';

const AssistantSegments = memo(({ segments, tools, fallbackContent, isRunning, onOpenTools }: {
  segments: ChatSegment[];
  tools: ToolActivity[];
  fallbackContent: string;
  isRunning: boolean;
  onOpenTools: () => void;
}) => {
  if (!segments.length && fallbackContent) {
    return <MarkdownMessage content={fallbackContent} />;
  }

  if (!segments.length && isRunning) {
    return (
      <FiPendingIndicator />
    );
  }

  return (
    <div className="w-full min-w-0 flex flex-col items-start break-words [overflow-wrap:anywhere]">
      {segments.map((segment, index) => {
        const isText = segment.type === 'text';
        const prevSegment = index > 0 ? segments[index - 1] : null;
        const prevIsText = prevSegment?.type === 'text';

        // Determine spacing class
        let spacingClass = '';
        if (index > 0) {
          if (isText || prevIsText) {
            spacingClass = 'mt-5';
          } else {
            spacingClass = 'mt-2';
          }
        }

        const isThinkingActive = isRunning && index === segments.length - 1;

        return isText ? (
          <div key={segment.id} className={`w-full min-w-0 break-words [overflow-wrap:anywhere] ${spacingClass}`}>
            <MarkdownMessage content={segment.content} />
          </div>
        ) : segment.type === 'thinking' ? (
          <details key={segment.id} className={`w-full select-none space-y-1 ${spacingClass}`}>
            <summary className="hover:text-neutral-300 font-serif-hermes text-[15px] italic text-neutral-400 cursor-pointer flex items-center gap-2 outline-none list-none [&::-webkit-details-marker]:hidden">
              <Brain className={`w-3.5 h-3.5 text-neutral-500 shrink-0 ${isThinkingActive ? 'animate-pulse' : ''}`} />
              <ToolStatusText text={isThinkingActive ? "Thinking process" : "Reasoning"} active={isThinkingActive} />
            </summary>
            <div className="pt-2 text-neutral-500 font-serif-hermes text-[15px] italic leading-relaxed pl-6 border-l border-neutral-800">
              <MarkdownMessage content={segment.content} />
            </div>
          </details>
        ) : (
          <ToolSegmentLine key={segment.id} tool={segment.tool} tools={tools} onOpen={onOpenTools} className={spacingClass} />
        );
      })}
    </div>
  );
});
AssistantSegments.displayName = 'AssistantSegments';

const ChatMessageItem = memo(({ msg, onOpenTools }: { msg: ChatMessage; onOpenTools: (tools: ToolActivity[]) => void }) => {
  if (msg.role === 'user') {
    return (
      <motion.div 
        {...chatEntrance}
        className="flex justify-end"
      >
        <div className="max-w-[86%] text-right font-sans-hermes text-[15px] font-light text-neutral-300 whitespace-pre-wrap break-words leading-relaxed">
          <CharacterEntranceText text={msg.content} />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      {...chatEntrance}
      className="flex w-full min-w-0 flex-col items-start space-y-4"
    >
      {msg.segments.length || msg.content || msg.status === 'running' ? (
        <div className="w-full min-w-0 font-serif-hermes text-[17px] leading-relaxed text-zinc-200 break-words [overflow-wrap:anywhere]">
          <AssistantSegments
            segments={msg.segments}
            tools={msg.tools}
            fallbackContent={msg.content}
            isRunning={msg.status === 'running'}
            onOpenTools={() => onOpenTools(msg.tools)}
          />
        </div>
      ) : (
        <div className="flex gap-1.5 py-2 pl-1 select-none">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
        </div>
      )}
    </motion.div>
  );
});
ChatMessageItem.displayName = 'ChatMessageItem';

const NotificationsDialog = ({ message, error, onEnable, onClose }: {
  message: string | null;
  error: string | null;
  onEnable: () => void;
  onClose: () => void;
}) => {
  const support = getNotificationSupport();

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 backdrop-blur-xl sm:items-center" onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label="Notifications" initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }} transition={{ duration: 0.22 }} onClick={(event) => event.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
          <div>
            <div className="font-serif-hermes text-[18px] italic text-zinc-200">Notifications</div>
            <div className="font-sans-hermes text-[11px] text-neutral-600">PWA local notification test</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Close notifications"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-4">
          <p className="font-serif-hermes text-[16px] italic leading-relaxed text-neutral-400">
            Notifications need HTTPS, service workers, and browser permission. On iPhone, web push/local notifications work from an installed Home Screen PWA on iOS 16.4+.
          </p>
          <div className="rounded-2xl bg-white/[0.025] p-3 font-sans-hermes text-[12px] text-neutral-500">
            Permission: {support.permission}
            {support.reason && <div className="mt-1 text-neutral-600">{support.reason}</div>}
          </div>
          {message && <div className="rounded-2xl bg-white/[0.035] p-3 font-sans-hermes text-[12px] text-neutral-300">{message}</div>}
          {error && <div className="rounded-2xl bg-red-950/20 p-3 font-sans-hermes text-[12px] text-red-200/70">{error}</div>}
          <button type="button" onClick={onEnable} className="w-full rounded-2xl bg-white px-4 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-black active:scale-[0.99] disabled:opacity-40" disabled={!support.supported}>
            Enable notifications
          </button>
        </div>
      </motion.div>
    </div>
  );
};



export default function App() {
  const {
    messages,
    isRunning,
    currentThreadId,
    currentThreadTitle,
    error,
    clearError,
    sendMessage,
    stopActiveRun,
    clearChat,
    connectionStatus,
    statusLine,
    blockingRequests,
    resolveBlockingRequest,
    resumeSession,
  } = useHermes();
  const [inputValue, setInputValue] = useState('');
  const selectedModel = 'deepseek-v4-flash';
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [toolDialogTools, setToolDialogTools] = useState<ToolActivity[] | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync usage balance silently in background
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const data = await getUsageData();
        setUsage(data);
      } catch (e) {
        // ignore
      }
    };
    fetchUsage();
  }, [messages]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isRunning]);


  // Locked Visual Viewport controller to scale height and block iOS scroll-shifting
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const root = document.getElementById('root');
        if (root) {
          root.style.height = `${window.visualViewport.height}px`;
        }
        // Force layout offset reset to lock app at top
        window.scrollTo(0, 0);
      }
    };

    const handleWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportChange);
    window.visualViewport?.addEventListener('scroll', handleViewportChange);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    
    // Initial viewport height match
    handleViewportChange();

    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportChange);
      window.visualViewport?.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, []);


  useEffect(() => {
    if (isPromptExpanded) {
      // Small timeout ensures element is mounted and rendered before calling focus
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isPromptExpanded]);

  const syncTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  };

  useEffect(() => {
    syncTextareaHeight();
  }, [inputValue, isPromptExpanded]);

  const handleSend = () => {
    if (!inputValue.trim() || isRunning) return;
    sendMessage(inputValue, selectedModel);
    setInputValue('');
    setIsPromptExpanded(false); // Collapse after sending
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || isMobileKeyboard()) return;

    event.preventDefault();
    handleSend();
  };

  const refreshSessions = async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await HermesGateway.listSessions();
      setSessions(res.sessions || []);
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : 'Failed to load sessions');
    } finally {
      setSessionsLoading(false);
    }
  };

  const openSessions = () => {
    setIsMenuOpen(false);
    setIsSessionsOpen(true);
    void refreshSessions();
  };

  const openNotifications = () => {
    setIsMenuOpen(false);
    setNotificationMessage(null);
    setNotificationError(null);
    setIsNotificationsOpen(true);
  };

  const openControlCenter = () => {
    setIsMenuOpen(false);
    setIsControlCenterOpen(true);
  };

  const handleEnableNotifications = async () => {
    setNotificationMessage(null);
    setNotificationError(null);
    try {
      const message = await enableNotifications();
      setNotificationMessage(message);
    } catch (e) {
      setNotificationError(e instanceof Error ? e.message : 'Failed to enable notifications');
    }
  };

  const handleConnectSession = async (sessionId: string) => {
    setIsSessionsOpen(false);
    try {
      await resumeSession(sessionId);
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : 'Failed to connect session');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;
    try {
      await HermesGateway.deleteSession(sessionId);
      void refreshSessions();
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : 'Failed to delete session');
    }
  };

  const handleBranchSession = async (sessionId: string) => {
    try {
      const res = await HermesGateway.branchSession(sessionId);
      setIsSessionsOpen(false);
      await resumeSession(res.session_id);
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : 'Failed to branch session');
    }
  };

  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    try {
      await HermesGateway.getOrSetTitle(sessionId, newTitle);
      void refreshSessions();
    } catch (e) {
      setSessionsError(e instanceof Error ? e.message : 'Failed to rename session');
    }
  };

  const copyError = async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(error);
    } catch {
      const el = document.createElement('textarea');
      el.value = error;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };


  return (
    <div className="flex flex-col h-full bg-black text-white safe-pt safe-pb select-none overflow-hidden relative font-sans-hermes">
      
      {/* Ultra-Minimalist Void Header */}
      <header className="w-full shrink-0 z-40 relative px-6 py-4 flex items-center justify-between border-b border-white/[0.015]">
        <div className="flex min-w-0 items-baseline gap-4">
          <span 
            onClick={clearChat}
            className="font-serif-hermes text-[27px] font-bold tracking-tight text-white select-none cursor-pointer active:opacity-75 transition-opacity flex items-center gap-2"
          >
            Fi
            {connectionStatus === 'connecting' && <span className="h-1.5 w-1.5 rounded-full bg-yellow-500/80 animate-pulse shrink-0" />}
            {connectionStatus === 'connected' && <span className="h-1.5 w-1.5 rounded-full bg-green-500/80 shrink-0" />}
            {connectionStatus === 'disconnected' && <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0" />}
          </span>
          {currentThreadTitle && (
            <span className="min-w-0 truncate font-serif-hermes text-[13px] italic text-neutral-600">
              {currentThreadTitle}
            </span>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 active:scale-95"
            aria-label="Open menu"
          >
            {isRunning && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-white pulse-white-glow" />}
            <Menu className="h-5 w-5" />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -4, filter: 'blur(6px)' }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-11 z-50 w-40 rounded-2xl border border-white/[0.06] bg-neutral-950/95 p-2 shadow-2xl backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={openSessions}
                  className="w-full rounded-xl px-3 py-2 text-left font-mono text-[12px] uppercase tracking-wider text-neutral-400 active:bg-white/[0.04]"
                >
                  Sessions
                </button>
                <button
                  type="button"
                  onClick={openControlCenter}
                  className="w-full rounded-xl px-3 py-2 text-left font-mono text-[12px] uppercase tracking-wider text-neutral-400 active:bg-white/[0.04]"
                >
                  Controls
                </button>
                <button
                  type="button"
                  onClick={openNotifications}
                  className="w-full rounded-xl px-3 py-2 text-left font-mono text-[12px] uppercase tracking-wider text-neutral-400 active:bg-white/[0.04]"
                >
                  Notifications
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Spacious chat Timeline viewport - Dimmed and Blurred when prompt is expanded */}
      <main 
        ref={chatContainerRef}
        className="flex-1 ios-scrollable px-6 py-4 space-y-8 z-10 relative no-scrollbar"
      >
        <div className="max-w-xl mx-auto space-y-8">
          
          {/* Ethereal suggestions shown when chat is completely empty */}
          {messages.length === 0 && (
            statusLine === "Resuming session..." ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-24 space-y-5 select-none text-center"
              >
                <h2 className="font-serif-hermes text-[26px] font-light leading-snug text-neutral-300 tracking-wide max-w-xs mx-auto">
                  <ToolStatusText text="Resuming session..." active={true} />
                </h2>
                <p className="font-serif-hermes text-[14px] italic leading-relaxed text-neutral-500 max-w-[240px] mx-auto animate-pulse">
                  Measuring aura levels and calibrating thread parameters...
                </p>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-24 space-y-5 select-none text-center"
              >
                <h2 className="font-serif-hermes text-[26px] font-light leading-snug text-neutral-300 tracking-wide max-w-xs mx-auto">
                  What shall we execute today?
                </h2>
                <p className="font-serif-hermes text-[14px] italic leading-relaxed text-neutral-500 max-w-[190px] mx-auto">
                  An ethereal gateway to your Hermetic remote VPS server agent.
                </p>
              </motion.div>
            )
          )}

          {/* Timeline of messages */}
          <div className="space-y-8 pb-24">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => {
                const shouldVirtualize = index < messages.length - 6 && msg.status !== 'running';
                const body = <ChatMessageItem msg={msg} onOpenTools={setToolDialogTools} />;

                return shouldVirtualize ? (
                  <VirtualMessage key={msg.id} rootRef={chatContainerRef} estimate={msg.role === 'user' ? 64 : 180}>
                    {body}
                  </VirtualMessage>
                ) : (
                  <div key={msg.id}>{body}</div>
                );
              })}
            </AnimatePresence>

            {statusLine && statusLine !== "Resuming session..." && (
              <motion.div 
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-[11px] text-neutral-500 italic flex items-center gap-2 pl-3 border-l border-white/[0.04]"
              >
                <span className="h-1 w-1 rounded-full bg-neutral-500 animate-ping" />
                <span>{statusLine}</span>
              </motion.div>
            )}
          </div>
        </div>
      </main>


      {/* Non-fatal sync/error panel */}
      {error && (
        <div className="mx-6 mb-4 px-4 py-2 bg-neutral-950 border border-neutral-900 rounded-xl flex items-center justify-between text-[13px] text-neutral-500 font-mono z-40 select-none">
          <span className="min-w-0 truncate pr-4 flex items-center gap-2">
            <DangerTriangle className="w-4 h-4 text-white shrink-0" />
            <span className="truncate">Sync issue: {error}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button 
              tabIndex={-1}
              onClick={copyError} 
              className="text-[12px] font-bold text-white uppercase border border-neutral-800 px-2 py-0.5 rounded cursor-pointer"
            >
              <Copy className="w-2.5 h-2.5 inline mr-1" />
              Copy
            </button>
            <button 
              tabIndex={-1}
              onClick={clearError} 
              className="text-[12px] font-bold text-white uppercase border border-neutral-800 px-2 py-0.5 rounded cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {toolDialogTools && (
          <ToolRunDialog tools={toolDialogTools} onClose={() => setToolDialogTools(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSessionsOpen && (
          <SessionsDialog
            sessions={sessions}
            loading={sessionsLoading}
            error={sessionsError}
            currentThreadId={currentThreadId}
            onRefresh={refreshSessions}
            onClose={() => setIsSessionsOpen(false)}
            onConnectSession={handleConnectSession}
            onDeleteSession={handleDeleteSession}
            onBranchSession={handleBranchSession}
            onRenameSession={handleRenameSession}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isControlCenterOpen && (
          <ControlCenterDialog
            sessionId={currentThreadId}
            onClose={() => setIsControlCenterOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {blockingRequests && blockingRequests.length > 0 && (
          <BlockingPromptsDialog
            request={blockingRequests[0]}
            onResolve={resolveBlockingRequest}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNotificationsOpen && (
          <NotificationsDialog
            message={notificationMessage}
            error={notificationError}
            onEnable={() => void handleEnableNotifications()}
            onClose={() => setIsNotificationsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Backdrop overlay for focus dismissal when input card is expanded */}
      <AnimatePresence>
        {isPromptExpanded && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.8 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => setIsPromptExpanded(false)}
            className="fixed inset-0 bg-black z-35 cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Bottom Message Composition - Unified Single Container layout transition */}
      <footer className="w-full shrink-0 px-4 pt-3 pb-0 sm:pb-[calc(env(safe-area-inset-bottom)+1rem)] bg-transparent z-40 relative">
        <div className="max-w-xl mx-auto">
          
          <div
            className={`ethereal-card shadow-2xl relative mx-auto overflow-hidden rounded-[24px] ${
              isPromptExpanded 
                ? 'max-w-xl p-4 sm:pb-5 z-40' 
                : 'max-w-[240px] py-2.5 sm:pb-3.5 px-4 cursor-pointer hover:border-white/15 select-none active:scale-95'
            }`}
            onClick={!isPromptExpanded ? () => {
              setIsPromptExpanded(true);
              textareaRef.current?.focus();
            } : undefined}
          >
            {/* MODE 1: Collapsed Pill Content */}
            <div
              className={`flex items-center justify-center w-full transition-all duration-200 ${
                !isPromptExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0 py-2.5 px-4'
              }`}
            >
              {usage ? (
                <div className="flex items-center gap-3 font-sans-hermes text-[13px] font-medium tracking-tight text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{getDeepSeekBalance(usage)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-neutral-500" />
                    <span>{getWeeklyCodexLimit(usage)}</span>
                  </span>
                </div>
              ) : (
                <div className="relative flex h-2 w-2">
                  {isRunning && statusLine !== "Resuming session..." ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-white pulse-white-glow" />
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neutral-650" />
                  )}
                </div>
              )}
            </div>

            {/* MODE 2: Expanded Ethereal Card Content */}
            <div
              className={`flex flex-col gap-3 w-full transition-all duration-200 ${
                isPromptExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0 p-4'
              }`}
            >
              {/* Input Area */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Ask Fi..."
                wrap="soft"
                className="w-full bg-transparent border-none outline-none text-[15px] font-light text-white placeholder-neutral-500 resize-none font-sans-hermes no-scrollbar min-h-[26px] max-h-32 pr-2 leading-relaxed caret-white select-text overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words"
                style={{ height: '26px', userSelect: 'text', WebkitUserSelect: 'text', caretColor: '#fff', overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
              />

              {/* Bottom Toolbar - Only Send/Stop Action Button */}
              <div className="flex items-center justify-end pt-1 select-none">
                
                {/* Circular Action Button */}
                {isRunning ? (
                  <button 
                    tabIndex={-1}
                    onClick={stopActiveRun}
                    className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shadow-lg active:scale-90 transition-transform cursor-pointer"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button 
                    tabIndex={-1}
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                    className="w-7 h-7 rounded-full bg-white disabled:bg-neutral-850 text-black disabled:text-neutral-600 flex items-center justify-center shadow-lg disabled:shadow-none active:scale-90 transition-transform cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}

              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
