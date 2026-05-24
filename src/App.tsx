import { memo, useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { useHermes } from './hooks/useHermes';
import type { ToolActivity, ChatMessage, ChatSegment } from './hooks/useHermes';
import { getUsageData, UsageData } from './services/api';
import HermesGateway from './services/hermesGateway';
import { HermesRestClient } from './services/hermesRest';
import { StoredSession, Usage } from './types/hermes';
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
import { Check, Coins, Copy, Gauge, Layers, Menu, Terminal, X, Brain, Cpu } from 'lucide-react';
import { MarkdownMessage } from './components/MarkdownMessage';
import { VirtualMessage } from './components/VirtualMessage';
import {
  formatToolGroupLabel,
  getToolDisplayLabel,
  getToolGroupCount,
  groupChatToolSegments,
} from './utils/toolTrace';
import type { ToolTraceGroup } from './utils/toolTrace';

const getDeepSeekBalance = (usage: UsageData) => {
  const total = usage.deepseek?.total;
  return typeof total === 'number' ? `$${total.toFixed(2)}` : '$--';
};

const getWeeklyCodexLimit = (usage: UsageData) => {
  const percent = usage.codex?.weekly?.used_percent ?? usage.codex?.week?.used_percent;
  return typeof percent === 'number' ? `${percent}%` : '--%';
};

const reasoningOptions = ['auto', 'medium', 'high', 'low', 'none'];

const formatModelName = (model?: string) => {
  if (!model) return 'model';
  const shortName = model.includes('/') ? model.split('/').pop() || model : model;
  return shortName.replace(/[-_]+/g, ' ');
};

const getContextPercent = (usage: Usage | null) => {
  if (!usage) return null;
  if (typeof usage.context_percent === 'number') return Math.round(usage.context_percent);
  if (typeof usage.context_used === 'number' && typeof usage.context_max === 'number' && usage.context_max > 0) {
    return Math.round((usage.context_used / usage.context_max) * 100);
  }
  return null;
};

const clampPercent = (value: number | null) => Math.max(0, Math.min(100, value ?? 0));

const isMobileKeyboard = () => {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;

  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    || window.matchMedia('(max-width: 767px) and (pointer: coarse)').matches;
};

type SlashCommandOption = {
  command: string;
  description: string;
  score: number;
};

type ContextCompletionItem = {
  text: string;
  display: string;
  meta: string;
};

type ContextCompletionToken = {
  word: string;
  start: number;
  end: number;
};

type MotionMode = 'full' | 'less';
type FontMode = 'current' | 'terminal';

type AppearanceSettings = {
  motionMode: MotionMode;
  fontMode: FontMode;
};

const appearanceStorageKey = 'fi_appearance_settings';

const defaultAppearance: AppearanceSettings = {
  motionMode: 'full',
  fontMode: 'current',
};

const readAppearanceSettings = (): AppearanceSettings => {
  if (typeof window === 'undefined') return defaultAppearance;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(appearanceStorageKey) || '{}') as Partial<AppearanceSettings>;
    return {
      motionMode: parsed.motionMode === 'less' ? 'less' : 'full',
      fontMode: parsed.fontMode === 'terminal' ? 'terminal' : 'current',
    };
  } catch {
    return defaultAppearance;
  }
};

const uniqueSlashCommands = (commands: SlashCommandOption[]) => {
  const seen = new Set<string>();
  return commands.filter((option) => {
    const key = option.command.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeSlashCommandCatalog = (payload: any): SlashCommandOption[] => {
  const fromPairs = Array.isArray(payload?.pairs)
    ? (payload.pairs as unknown[])
      .filter((pair): pair is [unknown, unknown] => Array.isArray(pair) && pair.length >= 2)
      .map(([command, description]) => ({
        command: String(command).startsWith('/') ? String(command) : `/${String(command)}`,
        description: String(description || ''),
        score: 0,
      }))
    : [];

  const fromCategories = Array.isArray(payload?.categories)
    ? payload.categories.flatMap((category: any) => {
      const items = Array.isArray(category?.items) ? category.items : Array.isArray(category?.commands) ? category.commands : [];
      return items.map((item: any) => ({
        command: String(item?.command || item?.name || item?.text || '').startsWith('/')
          ? String(item?.command || item?.name || item?.text || '')
          : `/${String(item?.command || item?.name || item?.text || '')}`,
        description: String(item?.description || item?.help || item?.meta || category?.title || ''),
        score: 0,
      }));
    }).filter((option: SlashCommandOption) => option.command.length > 1)
    : [];

  return uniqueSlashCommands([...fromPairs, ...fromCategories])
    .sort((a, b) => a.command.localeCompare(b.command));
};

const getSlashToken = (value: string) => {
  if (!value.startsWith('/') || value.includes('\n')) return null;
  const match = value.match(/^\/[^\s]*/);
  return match?.[0] || null;
};

const orderedFuzzyScore = (candidate: string, query: string) => {
  let cursor = 0;
  let score = 0;

  for (const char of query) {
    const index = candidate.indexOf(char, cursor);
    if (index === -1) return 0;
    score += Math.max(1, 12 - (index - cursor));
    cursor = index + 1;
  }

  return score;
};

const scoreSlashCommand = (option: SlashCommandOption, token: string) => {
  const query = token.toLowerCase();
  const command = option.command.toLowerCase();
  const body = command.slice(1);
  const description = option.description.toLowerCase();

  if (query === '/') return 50;
  const bareQuery = query.slice(1);
  if (command === query) return 1000;
  if (command.startsWith(query)) return 800 - command.length;
  if (body.startsWith(bareQuery)) return 700 - command.length;
  if (command.includes(bareQuery)) return 400 - command.indexOf(bareQuery);
  if (description.includes(bareQuery)) return 180;
  return orderedFuzzyScore(body, bareQuery);
};

const getSlashSuggestions = (commands: SlashCommandOption[], value: string) => {
  const token = getSlashToken(value);
  if (!token) return [];
  if (token === '/') {
    return commands.map((option) => ({ ...option, score: 50 }));
  }

  return commands
    .map((option) => ({ ...option, score: scoreSlashCommand(option, token) }))
    .filter((option) => option.score > 0)
    .sort((a, b) => b.score - a.score || a.command.localeCompare(b.command))
    .slice(0, 8);
};

const stringifyDisplay = (display: unknown, fallback: string) => {
  if (typeof display === 'string') return display;
  if (Array.isArray(display)) {
    return display
      .flatMap((part) => Array.isArray(part) ? part : [part])
      .map((part) => String(part || ''))
      .join('') || fallback;
  }
  return fallback;
};

const normalizeContextCompletions = (payload: any): ContextCompletionItem[] => {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return items
    .map((item: any) => {
      const text = String(item?.text || item?.value || '');
      if (!text) return null;
      return {
        text,
        display: stringifyDisplay(item?.display, text),
        meta: String(item?.meta || ''),
      };
    })
    .filter((item: ContextCompletionItem | null): item is ContextCompletionItem => Boolean(item));
};

const isContextCompletionWord = (word: string) => {
  if (!word) return false;
  return word.startsWith('@')
    || word.startsWith('./')
    || word.startsWith('../')
    || word.startsWith('~/')
    || word.includes('/');
};

const getContextCompletionToken = (value: string, cursor: number): ContextCompletionToken | null => {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  let start = safeCursor;
  let end = safeCursor;

  while (start > 0 && !/\s/.test(value[start - 1])) start -= 1;
  while (end < value.length && !/\s/.test(value[end])) end += 1;

  const word = value.slice(start, end);
  if (!isContextCompletionWord(word)) return null;
  return { word, start, end };
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }
};

const chatEntrance = {
  initial: { opacity: 0, y: 8, filter: 'blur(8px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
  transition: { duration: 0.34, ease: 'easeOut' },
};

const instantEntrance = {
  initial: false,
  animate: { opacity: 1 },
  transition: { duration: 0 },
};

const CharacterEntranceText = memo(({ text, reduceMotion }: { text: string; reduceMotion: boolean }) => (
  <span aria-label={text} className="whitespace-pre-wrap break-words">
    {reduceMotion ? text : Array.from(text).map((char, index) => (
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

const ToolStatusText = memo(({ text, active, reduceMotion }: { text: string; active: boolean; reduceMotion: boolean }) => {
  if (reduceMotion || !active) {
    return <span>{text}</span>;
  }

  return (
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
  );
});
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
          <div className="font-sans-hermes text-[11px] text-neutral-600">
            {tools.length} call{tools.length === 1 ? '' : 's'} | {getToolGroupCount(tools)} group{getToolGroupCount(tools) === 1 ? '' : 's'}
          </div>
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
                <div className="min-w-0">
                  <div className="truncate font-sans-hermes text-[13px]">{getToolDisplayLabel(tool.tool)}</div>
                  <div className="truncate font-mono text-[10px] text-neutral-700">{tool.tool}</div>
                </div>
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



const ToolSegmentLine = memo(({ group, tools, onOpen, className, reduceMotion }: {
  group: ToolTraceGroup;
  tools: ToolActivity[]; 
  onOpen: () => void;
  className?: string;
  reduceMotion: boolean;
}) => {
  const active = group.status === 'running';
  const failed = group.status === 'failed';

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      {...(reduceMotion ? instantEntrance : {
        initial: { opacity: 0, y: 4, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.2 },
      })}
      className={`hover:text-neutral-300 font-serif-hermes text-[15px] italic text-neutral-400 cursor-pointer flex items-center gap-2 outline-none select-none active:scale-[0.99] text-left ${failed ? 'text-red-300/70' : ''} ${active ? '' : 'opacity-70'} ${className || ''}`}
      aria-label={`Open work trace with ${tools.length} tool calls`}
    >
      <Code className={`w-3.5 h-3.5 text-neutral-500 shrink-0 ${active ? 'animate-pulse fi-motion-pulse' : ''}`} />
      <ToolStatusText text={formatToolGroupLabel(group)} active={active} reduceMotion={false} />
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

const FiPendingIndicator = memo(({ reduceMotion }: { reduceMotion: boolean }) => {
  const [frame, setFrame] = useState(0);
  const [message, setMessage] = useState(fiLoadingMessages[Math.floor(Math.random() * fiLoadingMessages.length)]);
  
  // Pick one random spinner style on mount
  const spinnerFramesRef = useRef(spinnerStyles[Math.floor(Math.random() * spinnerStyles.length)]);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % spinnerFramesRef.current.length);
    }, 80);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  useEffect(() => {
    // Cycle text message every 1.5s
    const msgTimer = setInterval(() => {
      setMessage(fiLoadingMessages[Math.floor(Math.random() * fiLoadingMessages.length)]);
    }, 1500);
    return () => clearInterval(msgTimer);
  }, [reduceMotion]);

  const charCount = spinnerFramesRef.current[0]?.length || 1;
  const widthClass = charCount === 1 ? 'w-5' : 'w-12';

  return (
    <motion.div
      {...(reduceMotion ? instantEntrance : {
        initial: { opacity: 0, y: 4, filter: 'blur(4px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { duration: 0.2 },
      })}
      className="flex items-center gap-3 pt-2 select-none font-serif-hermes text-[15px] italic text-neutral-400"
    >
      <span className={`font-mono text-[17px] text-white/70 h-5 ${widthClass} flex items-center justify-center animate-pulse fi-motion-pulse`}>
        {spinnerFramesRef.current[frame]}
      </span>
      <span className="animate-pulse fi-motion-pulse">{message}</span>
    </motion.div>
  );
});
FiPendingIndicator.displayName = 'FiPendingIndicator';

const AssistantSegments = memo(({ segments, tools, fallbackContent, isRunning, onOpenTools, reduceMotion }: {
  segments: ChatSegment[];
  tools: ToolActivity[];
  fallbackContent: string;
  isRunning: boolean;
  onOpenTools: () => void;
  reduceMotion: boolean;
}) => {
  if (!segments.length && fallbackContent) {
    return <MarkdownMessage content={fallbackContent} reduceMotion={reduceMotion} />;
  }

  if (!segments.length && isRunning) {
    return (
      <FiPendingIndicator reduceMotion={reduceMotion} />
    );
  }

  const groupedSegments = groupChatToolSegments(segments);

  return (
    <div className="w-full min-w-0 flex flex-col items-start break-words [overflow-wrap:anywhere]">
      {groupedSegments.map((segment, index) => {
        const isText = segment.type === 'text';
        const prevSegment = index > 0 ? groupedSegments[index - 1] : null;
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

        const isThinkingActive = isRunning && index === groupedSegments.length - 1;

        return isText ? (
          <div key={segment.id} className={`w-full min-w-0 break-words [overflow-wrap:anywhere] ${spacingClass}`}>
            <MarkdownMessage content={segment.content} reduceMotion={reduceMotion} />
          </div>
        ) : segment.type === 'thinking' ? (
          <details key={segment.id} className={`w-full select-none space-y-1 ${spacingClass}`}>
            <summary className="hover:text-neutral-300 font-serif-hermes text-[15px] italic text-neutral-400 cursor-pointer flex items-center gap-2 outline-none list-none [&::-webkit-details-marker]:hidden">
              <Brain className={`w-3.5 h-3.5 text-neutral-500 shrink-0 ${isThinkingActive && !reduceMotion ? 'animate-pulse' : ''}`} />
              <ToolStatusText text={isThinkingActive ? "Thinking process" : "Reasoning"} active={isThinkingActive} reduceMotion={reduceMotion} />
            </summary>
            <div className="pt-2 text-neutral-500 font-serif-hermes text-[15px] italic leading-relaxed pl-6 border-l border-neutral-800">
              <MarkdownMessage content={segment.content} reduceMotion={reduceMotion} />
            </div>
          </details>
        ) : segment.type === 'tool-group' ? (
          <ToolSegmentLine key={segment.id} group={segment} tools={tools} onOpen={onOpenTools} className={spacingClass} reduceMotion={reduceMotion} />
        ) : null;
      })}
    </div>
  );
});
AssistantSegments.displayName = 'AssistantSegments';

const ChatMessageItem = memo(({ msg, onOpenTools, reduceMotion }: { msg: ChatMessage; onOpenTools: (tools: ToolActivity[]) => void; reduceMotion: boolean }) => {
  if (msg.role === 'user') {
    return (
      <motion.div 
        {...(reduceMotion ? instantEntrance : chatEntrance)}
        className="flex justify-end"
      >
        <div className="max-w-[86%] text-right font-sans-hermes text-[15px] font-light text-neutral-300 whitespace-pre-wrap break-words leading-relaxed">
          <CharacterEntranceText text={msg.content} reduceMotion={reduceMotion} />
        </div>
      </motion.div>
    );
  }

  if (!msg.segments.length && !msg.content && msg.status !== 'running') {
    return null;
  }

  return (
    <motion.div 
      {...(reduceMotion ? instantEntrance : chatEntrance)}
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
            reduceMotion={reduceMotion}
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
            <div className="font-sans-hermes text-[11px] text-neutral-600">PWA push notification setup</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Close notifications"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-4">
          <p className="font-serif-hermes text-[16px] italic leading-relaxed text-neutral-400">
            Notifications need HTTPS, service workers, and browser permission. On iPhone, Web Push works from an installed Home Screen PWA on iOS 16.4+.
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

const AppearanceDialog = ({ settings, onChange, onClose }: {
  settings: AppearanceSettings;
  onChange: (settings: AppearanceSettings) => void;
  onClose: () => void;
}) => {
  const lessAnimation = settings.motionMode === 'less';
  const terminalFont = settings.fontMode === 'terminal';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 px-4 pb-4 backdrop-blur-xl sm:items-center" onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Appearance settings"
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        transition={{ duration: 0.18 }}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3">
          <div>
            <div className="font-serif-hermes text-[18px] italic text-zinc-200">Appearance</div>
            <div className="font-sans-hermes text-[11px] text-neutral-600">Phone performance and text style</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Close appearance">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <button
            type="button"
            onClick={() => onChange({ ...settings, motionMode: lessAnimation ? 'full' : 'less' })}
            className={`flex w-full items-start justify-between gap-4 rounded-2xl border p-4 text-left ${
              lessAnimation ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.025]'
            }`}
          >
            <span className="flex min-w-0 gap-3">
              <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
              <span className="min-w-0">
                <span className="block font-sans-hermes text-[13px] font-medium text-zinc-200">Less Animation</span>
                <span className="mt-1 block font-sans-hermes text-[12px] leading-relaxed text-neutral-500">
                  Removes blur and heavy chat transitions while keeping tool-call pulse, spinner, and status message motion.
                </span>
              </span>
            </span>
            {lessAnimation && <Check className="h-4 w-4 shrink-0 text-white" />}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ ...settings, fontMode: 'current' })}
              className={`min-h-24 rounded-2xl border p-3 text-left ${
                !terminalFont ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.025]'
              }`}
            >
              <span className="block font-serif-hermes text-[17px] italic text-zinc-200">Current</span>
              <span className="mt-1 block font-sans-hermes text-[11px] leading-relaxed text-neutral-500">Fraunces + Space Grotesk</span>
            </button>

            <button
              type="button"
              onClick={() => onChange({ ...settings, fontMode: 'terminal' })}
              className={`min-h-24 rounded-2xl border p-3 text-left ${
                terminalFont ? 'border-white/20 bg-white/[0.06]' : 'border-white/[0.06] bg-white/[0.025]'
              }`}
            >
              <span className="flex items-center gap-2 font-mono text-[14px] uppercase text-zinc-200">
                <Terminal className="h-3.5 w-3.5" />
                Terminal
              </span>
              <span className="mt-2 block font-mono text-[11px] leading-relaxed text-neutral-500">Geist Mono stack, sharp borders.</span>
            </button>
          </div>
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
    executeSlashCommand,
    stopActiveRun,
    clearChat,
    connectionStatus,
    statusLine,
    blockingRequests,
    resolveBlockingRequest,
    resumeSession,
    sessionInfo,
  } = useHermes();
  const [inputValue, setInputValue] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek-v4-flash');
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [footerPicker, setFooterPicker] = useState<'model' | 'reasoning' | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [sessionUsage, setSessionUsage] = useState<Usage | null>(null);
  const [reasoningLevel, setReasoningLevel] = useState<string>('auto');
  const [toolDialogTools, setToolDialogTools] = useState<ToolActivity[] | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSessionsOpen, setIsSessionsOpen] = useState(false);
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [appearanceSettings, setAppearanceSettings] = useState<AppearanceSettings>(readAppearanceSettings);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [slashCommands, setSlashCommands] = useState<SlashCommandOption[]>([]);
  const [slashCommandsLoading, setSlashCommandsLoading] = useState(false);
  const [slashCommandsError, setSlashCommandsError] = useState<string | null>(null);
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
  const [composerCursor, setComposerCursor] = useState(0);
  const [contextCompletions, setContextCompletions] = useState<ContextCompletionItem[]>([]);
  const [contextCompletionLoading, setContextCompletionLoading] = useState(false);
  const [contextCompletionError, setContextCompletionError] = useState<string | null>(null);
  const [selectedContextIndex, setSelectedContextIndex] = useState(0);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const slashSuggestions = getSlashSuggestions(slashCommands, inputValue);
  const slashToken = getSlashToken(inputValue);
  const isSlashPrompt = Boolean(slashToken);
  const contextCompletionToken = isSlashPrompt ? null : getContextCompletionToken(inputValue, composerCursor);
  const isContextCompletionPrompt = Boolean(contextCompletionToken);
  const reduceMotion = appearanceSettings.motionMode === 'less';
  const terminalFont = appearanceSettings.fontMode === 'terminal';

  useEffect(() => {
    window.localStorage.setItem(appearanceStorageKey, JSON.stringify(appearanceSettings));
    document.documentElement.dataset.motionMode = appearanceSettings.motionMode;
    document.documentElement.dataset.fontMode = appearanceSettings.fontMode;
  }, [appearanceSettings]);

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

  useEffect(() => {
    if (!currentThreadId) {
      setSessionUsage(null);
    }

    let cancelled = false;

    const fetchSessionDetails = async () => {
      try {
        const [usageRes, reasoningRes] = await Promise.all([
          currentThreadId ? HermesGateway.getUsage(currentThreadId).catch(() => null) : Promise.resolve(null),
          HermesGateway.getConfig('reasoning', currentThreadId || undefined).catch(() => null),
        ]);
        if (cancelled) return;

        const nextUsage = ((usageRes as any)?.usage || usageRes) as Usage | null;
        if (nextUsage) {
          setSessionUsage(nextUsage);
          if (nextUsage.model) setSelectedModel(nextUsage.model);
        }

        const reasoning = (reasoningRes as any)?.value
          ?? (reasoningRes as any)?.reasoning
          ?? (reasoningRes as any)?.config?.reasoning
          ?? (reasoningRes as any)?.config?.value;
        if (reasoning !== undefined && reasoning !== null) {
          setReasoningLevel(String(reasoning));
        }
      } catch {
        // Keep stale session details rather than disturbing prompt input.
      }
    };

    void fetchSessionDetails();

    return () => {
      cancelled = true;
    };
  }, [currentThreadId, messages.length, isRunning, connectionStatus]);

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

  useEffect(() => {
    if (!isPromptExpanded || !isSlashPrompt || slashCommands.length > 0 || slashCommandsLoading) return;

    let cancelled = false;
    setSlashCommandsLoading(true);
    setSlashCommandsError(null);

    const loadSlashCommands = async () => {
      try {
        const catalog = await withTimeout(HermesRestClient.listCommands(), 4000, 'Slash command catalog')
          .catch(() => withTimeout(HermesGateway.catalogCommands(), 4000, 'Slash command catalog'));
        if (cancelled) return;
        setSlashCommands(normalizeSlashCommandCatalog(catalog));
      } catch (e) {
        if (!cancelled) {
          setSlashCommandsError(e instanceof Error ? e.message : 'Failed to load slash commands');
        }
      } finally {
        if (!cancelled) setSlashCommandsLoading(false);
      }
    };

    void loadSlashCommands();

    return () => {
      cancelled = true;
    };
  }, [isPromptExpanded, isSlashPrompt, slashCommands.length]);

  useEffect(() => {
    setSelectedSlashIndex(0);
  }, [inputValue, slashCommands.length]);

  useEffect(() => {
    if (!isPromptExpanded || !contextCompletionToken) {
      setContextCompletions([]);
      setContextCompletionLoading(false);
      setContextCompletionError(null);
      return;
    }

    let cancelled = false;
    setContextCompletionLoading(true);
    setContextCompletionError(null);

    const loadContextCompletions = async () => {
      try {
        const completion = await withTimeout(
          HermesGateway.completePath(contextCompletionToken.word),
          4000,
          'Context completion'
        );
        if (cancelled) return;
        setContextCompletions(normalizeContextCompletions(completion));
      } catch (e) {
        if (!cancelled) {
          setContextCompletions([]);
          setContextCompletionError(e instanceof Error ? e.message : 'Failed to load context completions');
        }
      } finally {
        if (!cancelled) setContextCompletionLoading(false);
      }
    };

    void loadContextCompletions();

    return () => {
      cancelled = true;
    };
  }, [isPromptExpanded, contextCompletionToken?.word]);

  useEffect(() => {
    setSelectedContextIndex(0);
  }, [contextCompletionToken?.word, contextCompletions.length]);

  const loadModelOptions = async () => {
    try {
      const res = await HermesGateway.getModelOptions(currentThreadId || undefined);
      const providers = Array.isArray((res as any)?.providers) ? (res as any).providers : [];
      const models = providers
        .flatMap((provider: any) => Array.isArray(provider?.models) ? provider.models : [])
        .map((model: unknown) => String(model))
        .filter(Boolean);
      setModelOptions(Array.from(new Set(models)));
    } catch {
      setModelOptions([]);
    }
  };

  const toggleFooterPicker = (picker: 'model' | 'reasoning') => {
    setFooterPicker((current) => {
      const next = current === picker ? null : picker;
      if (next === 'model') void loadModelOptions();
      return next;
    });
  };

  const handleSelectFooterModel = async (model: string) => {
    setSelectedModel(model);
    setFooterPicker(null);
    try {
      await HermesGateway.setConfig('model', model, currentThreadId || undefined);
    } catch (e) {
      console.warn('Failed to set model:', e);
    }
  };

  const handleSelectFooterReasoning = async (reasoning: string) => {
    setReasoningLevel(reasoning);
    setFooterPicker(null);
    try {
      await HermesGateway.setConfig('reasoning', reasoning, currentThreadId || undefined);
    } catch (e) {
      console.warn('Failed to set reasoning:', e);
    }
  };

  const completeSlashSelection = (appendSpace = true) => {
    const token = getSlashToken(inputValue);
    const selected = slashSuggestions[selectedSlashIndex] || slashSuggestions[0];
    if (!token || !selected) return false;

    selectSlashCommand(selected, appendSpace);
    return true;
  };

  const selectSlashCommand = (option: SlashCommandOption, appendSpace = true) => {
    const token = getSlashToken(inputValue);
    if (!token) return;

    const rest = inputValue.slice(token.length).replace(/^\s*/, '');
    const nextValue = `${option.command}${appendSpace ? ' ' : ''}${rest}`;
    const cursor = `${option.command}${appendSpace ? ' ' : ''}`.length;
    setInputValue(nextValue);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const selectContextCompletion = (item: ContextCompletionItem, appendSpace = !item.text.endsWith('/')) => {
    if (!contextCompletionToken) return false;

    const suffix = appendSpace ? ' ' : '';
    const nextValue = `${inputValue.slice(0, contextCompletionToken.start)}${item.text}${suffix}${inputValue.slice(contextCompletionToken.end)}`;
    const cursor = contextCompletionToken.start + item.text.length + suffix.length;
    setInputValue(nextValue);
    setComposerCursor(cursor);
    setContextCompletions([]);

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
    return true;
  };

  const completeContextSelection = () => {
    const selected = contextCompletions[selectedContextIndex] || contextCompletions[0];
    if (!selected) return false;
    return selectContextCompletion(selected);
  };

  const handleSend = () => {
    if (!inputValue.trim() || isRunning) return;
    const text = inputValue.trim();
    if (text.startsWith('/')) {
      void executeSlashCommand(text);
    } else {
      sendMessage(inputValue, selectedModel);
    }
    setInputValue('');
    setFooterPicker(null);
    setIsPromptExpanded(false); // Collapse after sending
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    setComposerCursor(event.currentTarget.selectionStart);

    if (isSlashPrompt && slashSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedSlashIndex((index) => (index + 1) % slashSuggestions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedSlashIndex((index) => (index - 1 + slashSuggestions.length) % slashSuggestions.length);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        completeSlashSelection(true);
        return;
      }

      if (event.key === ' ' && slashToken && slashToken !== (slashSuggestions[selectedSlashIndex] || slashSuggestions[0])?.command) {
        event.preventDefault();
        completeSlashSelection(true);
        return;
      }
    }

    if (isContextCompletionPrompt && contextCompletions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedContextIndex((index) => (index + 1) % contextCompletions.length);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedContextIndex((index) => (index - 1 + contextCompletions.length) % contextCompletions.length);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        completeContextSelection();
        return;
      }

      if (event.key === ' ' && contextCompletionToken?.word !== (contextCompletions[selectedContextIndex] || contextCompletions[0])?.text) {
        event.preventDefault();
        completeContextSelection();
        return;
      }
    }

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

  const openAppearance = () => {
    setIsMenuOpen(false);
    setIsAppearanceOpen(true);
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

  const modelLabel = formatModelName(
    selectedModel
      || (typeof sessionInfo?.model === 'string' ? sessionInfo.model : undefined)
      || sessionUsage?.model
  );
  const contextPercent = getContextPercent(sessionUsage);
  const contextRingPercent = clampPercent(contextPercent);

  return (
    <div
      data-motion-mode={appearanceSettings.motionMode}
      data-font-mode={appearanceSettings.fontMode}
      className={`flex flex-col h-full bg-black text-white safe-pt select-none overflow-hidden relative font-sans-hermes ${reduceMotion ? 'fi-less-motion' : ''} ${terminalFont ? 'fi-terminal' : ''}`}
    >
      
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
                <button
                  type="button"
                  onClick={openAppearance}
                  className="w-full rounded-xl px-3 py-2 text-left font-mono text-[12px] uppercase tracking-wider text-neutral-400 active:bg-white/[0.04]"
                >
                  Appearance
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
                  <ToolStatusText text="Resuming session..." active={true} reduceMotion={reduceMotion} />
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
                const body = <ChatMessageItem msg={msg} onOpenTools={setToolDialogTools} reduceMotion={reduceMotion} />;

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

      <AnimatePresence>
        {isAppearanceOpen && (
          <AppearanceDialog
            settings={appearanceSettings}
            onChange={setAppearanceSettings}
            onClose={() => setIsAppearanceOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {footerPicker && isPromptExpanded && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.75rem)]">
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setFooterPicker(null)}
              className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={footerPicker === 'model' ? 'Select model' : 'Select reasoning'}
              initial={{ opacity: 0, y: 12, scale: 0.98, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(8px)' }}
              transition={{ duration: 0.16 }}
              className="relative w-full max-w-xl overflow-hidden rounded-[22px] border border-white/[0.07] bg-neutral-950/95 p-2 shadow-2xl"
            >
              {footerPicker === 'model' ? (
                <div className="max-h-[48vh] overflow-y-auto no-scrollbar">
                  {(modelOptions.length ? modelOptions : [selectedModel]).map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => void handleSelectFooterModel(model)}
                      className={`flex min-h-10 w-full items-center gap-2 rounded-2xl px-3 text-left font-mono text-[11px] uppercase tracking-wider ${
                        selectedModel === model
                          ? 'bg-white/[0.08] text-white'
                          : 'text-neutral-500 active:bg-white/[0.04]'
                      }`}
                    >
                      <Cpu className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                      <span className="truncate">{formatModelName(model)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-1">
                  {reasoningOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => void handleSelectFooterReasoning(option)}
                      className={`flex min-h-10 items-center gap-2 rounded-2xl px-3 font-mono text-[11px] uppercase tracking-wider ${
                        reasoningLevel === option
                          ? 'bg-white/[0.08] text-white'
                          : 'text-neutral-500 active:bg-white/[0.04]'
                      }`}
                    >
                      <Brain className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
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
            onClick={() => {
              setFooterPicker(null);
              setIsPromptExpanded(false);
            }}
            className="fixed inset-0 bg-black z-35 cursor-pointer"
          />
        )}
      </AnimatePresence>

      {/* Bottom Message Composition - Unified Single Container layout transition */}
      <footer className="w-full shrink-0 px-4 pt-2 pb-0 sm:pb-[calc(env(safe-area-inset-bottom)+0.25rem)] bg-transparent z-40 relative">
        <div className="relative max-w-xl mx-auto">
          {isPromptExpanded && isSlashPrompt && (slashCommandsLoading || slashCommandsError || slashSuggestions.length > 0) && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto rounded-[22px] border border-white/[0.08] bg-neutral-950/95 p-1 shadow-2xl backdrop-blur-xl no-scrollbar">
              {slashCommandsLoading && (
                <div className="px-3 py-2 font-mono text-[11px] text-neutral-500">Loading commands...</div>
              )}
              {slashCommandsError && !slashCommandsLoading && (
                <div className="px-3 py-2 font-mono text-[11px] text-red-300/70">{slashCommandsError}</div>
              )}
              {!slashCommandsLoading && !slashCommandsError && slashSuggestions.map((option, index) => (
                <button
                  key={option.command}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setSelectedSlashIndex(index);
                    selectSlashCommand(option, true);
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                    index === selectedSlashIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="w-[104px] shrink-0 truncate font-mono text-[12px] text-zinc-200">{option.command}</span>
                  <span className="min-w-0 flex-1 truncate font-sans-hermes text-[12px] leading-5 text-neutral-500">{option.description}</span>
                </button>
              ))}
            </div>
          )}
          {isPromptExpanded && !isSlashPrompt && isContextCompletionPrompt && (contextCompletionLoading || contextCompletionError || contextCompletions.length > 0) && (
            <div className="absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-50 max-h-[260px] overflow-y-auto rounded-[22px] border border-white/[0.08] bg-neutral-950/95 p-1 shadow-2xl backdrop-blur-xl no-scrollbar">
              {contextCompletionLoading && (
                <div className="px-3 py-2 font-mono text-[11px] text-neutral-500">Loading context...</div>
              )}
              {contextCompletionError && !contextCompletionLoading && (
                <div className="px-3 py-2 font-mono text-[11px] text-red-300/70">{contextCompletionError}</div>
              )}
              {!contextCompletionLoading && !contextCompletionError && contextCompletions.map((item, index) => (
                <button
                  key={`${item.text}-${index}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setSelectedContextIndex(index);
                    selectContextCompletion(item);
                  }}
                  className={`flex w-full items-start gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                    index === selectedContextIndex ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="w-[156px] shrink-0 truncate font-mono text-[12px] text-zinc-200">{item.display}</span>
                  <span className="min-w-0 flex-1 truncate font-sans-hermes text-[12px] leading-5 text-neutral-500">{item.meta}</span>
                </button>
              ))}
            </div>
          )}
          
          <div
            className={`ethereal-card shadow-2xl relative mx-auto overflow-hidden rounded-[24px] ${
              isPromptExpanded 
                ? 'max-w-xl px-4 pt-3 pb-2 sm:pb-2 z-40' 
                : 'max-w-[240px] py-2.5 sm:pb-2.5 px-4 cursor-pointer hover:border-white/15 select-none active:scale-95'
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
              className={`flex flex-col gap-2.5 w-full transition-all duration-200 ${
                isPromptExpanded ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none absolute inset-0 p-4'
              }`}
            >
              {/* Input Area */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setComposerCursor(e.target.selectionStart);
                }}
                onKeyDown={handleComposerKeyDown}
                onKeyUp={(e) => setComposerCursor(e.currentTarget.selectionStart)}
                onClick={(e) => setComposerCursor(e.currentTarget.selectionStart)}
                onSelect={(e) => setComposerCursor(e.currentTarget.selectionStart)}
                placeholder="Ask Fi..."
                wrap="soft"
                className="w-full bg-transparent border-none outline-none text-[15px] font-light text-white placeholder-neutral-500 resize-none font-sans-hermes no-scrollbar min-h-[26px] max-h-32 pr-2 leading-relaxed caret-white select-text overflow-x-hidden overflow-y-auto whitespace-pre-wrap break-words"
                style={{ height: '26px', userSelect: 'text', WebkitUserSelect: 'text', caretColor: '#fff', overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
              />

              {/* Bottom Toolbar */}
              <div className="flex min-h-8 items-center justify-between gap-3 select-none">
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  <button
                    type="button"
                    onClick={() => toggleFooterPicker('model')}
                    className="flex min-h-7 min-w-0 items-center gap-1.5 rounded-lg pr-1 text-left active:scale-[0.98]"
                    title={`Model: ${modelLabel}`}
                  >
                    <Cpu className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                    <span className="max-w-[135px] truncate text-neutral-400">{modelLabel}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFooterPicker('reasoning')}
                    className="flex min-h-7 items-center gap-1.5 rounded-lg pr-1 active:scale-[0.98]"
                    title={`Reasoning: ${reasoningLevel}`}
                  >
                    <Brain className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                    <span className="text-neutral-400">{reasoningLevel}</span>
                  </button>
                  <span className="flex min-h-7 items-center gap-1.5" title="Context utilization">
                    <span
                      className="relative h-3.5 w-3.5 shrink-0 rounded-full"
                      style={{
                        background: `conic-gradient(rgba(245,245,245,0.82) ${contextRingPercent * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
                      }}
                    >
                      <span className="absolute inset-[3px] rounded-full bg-neutral-950" />
                    </span>
                    <span className="text-neutral-400">{contextPercent ?? 0}%</span>
                  </span>
                </div>
                
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
