import { useState, useRef, useEffect } from 'react';
import { useHermes, ToolActivity } from './hooks/useHermes';
import { getUsageData, UsageData } from './services/api';
import { 
  ArrowUp, 
  StopCircle, 
  DangerTriangle, 
  Restart 
} from '@solar-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

const getToolEmoji = (tool: string) => {
  switch (tool) {
    case 'terminal': return '⚡';
    case 'read_file': return '📖';
    case 'write_file': return '✏️';
    case 'patch': return '🔧';
    case 'search_files': return '🔍';
    case 'web_search': return '🌐';
    case 'browser': return '🖥️';
    case 'memory': return '🧠';
    case 'cronjob': return '⏰';
    case 'clarify': return '❓';
    default: return '🧩';
  }
};

export default function App() {
  const { messages, isRunning, error, sendMessage, stopActiveRun, clearChat } = useHermes();
  const [inputValue, setInputValue] = useState('');
  const selectedModel = 'deepseek-v4-flash';
  const [expandedMsgId, setExpandedMsgId] = useState<string | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);

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

  // Autofocus whenever isPromptExpanded changes
  useEffect(() => {
    if (isPromptExpanded) {
      // Small timeout ensures element is mounted and rendered before calling focus
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isPromptExpanded]);

  const handleSend = () => {
    if (!inputValue.trim() || isRunning) return;
    sendMessage(inputValue, selectedModel);
    setInputValue('');
    setIsPromptExpanded(false); // Collapse after sending
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeTool = (): ToolActivity | null => {
    if (!isRunning || messages.length === 0) return null;
    const latestMsg = messages[messages.length - 1];
    if (latestMsg.role !== 'assistant') return null;
    return latestMsg.tools.find(t => t.status === 'running') || null;
  };

  const runningTool = activeTool();


  return (
    <div className="flex flex-col h-full bg-black text-white safe-pt safe-pb select-none overflow-hidden relative font-sans-hermes">
      
      {/* Ultra-Minimalist Void Header: Big serif "Fi" logo on the left and status dot on the right */}
      <header className="w-full shrink-0 z-40 relative px-6 py-4 flex items-center justify-between border-b border-white/[0.015]">
        <div className="flex items-baseline gap-4">
          <span 
            onClick={clearChat}
            className="font-serif-hermes text-2xl font-bold tracking-tight text-white select-none cursor-pointer active:opacity-75 transition-opacity"
          >
            Fi
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Status Dot: pulsing white online, solid gray offline */}
          <div className="relative flex h-2 w-2 items-center justify-center">
            {isRunning ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white pulse-white-glow" />
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neutral-800" />
            )}
          </div>
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
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-24 space-y-5 select-none text-center"
            >
              <h2 className="font-serif-hermes text-2xl font-light leading-snug text-neutral-300 tracking-wide max-w-xs mx-auto">
                What shall we execute today?
              </h2>
              <p className="font-serif-hermes text-[11px] italic leading-relaxed text-neutral-500 max-w-[180px] mx-auto">
                An ethereal gateway to your Hermetic remote VPS server agent.
              </p>
            </motion.div>
          )}

          {/* Timeline of messages */}
          <div className="space-y-8 pb-24">
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const hasTools = msg.tools && msg.tools.length > 0;
                const isExpanded = expandedMsgId === msg.id;

                if (isUser) {
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-start pl-3 border-l border-white/5"
                    >
                      <div className="font-sans-hermes text-[12px] font-light text-neutral-400 whitespace-pre-wrap break-words leading-relaxed italic">
                        {msg.content}
                      </div>
                    </motion.div>
                  );
                }

                // AI Response block
                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-start space-y-4"
                  >
                    {msg.content ? (
                      <div className="font-serif-hermes text-[14px] leading-relaxed text-zinc-200 whitespace-pre-wrap break-words">
                        {msg.content}
                      </div>
                    ) : !hasTools ? (
                      /* Sleek loading blinker inside pure void */
                      <div className="flex gap-1.5 py-2 pl-1 select-none">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                      </div>
                    ) : null}

                    {/* Collapsible Tool Timeline */}
                    {hasTools && (
                      <div className="w-full pt-2 font-mono text-[9px] text-neutral-500 select-none">
                        <button
                          onClick={() => setExpandedMsgId(isExpanded ? null : msg.id)}
                          className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-300 transition-colors py-1 cursor-pointer"
                        >
                          <span>{isExpanded ? '[-]' : '[+]'}</span>
                          <span>VPS Executions ({msg.tools.length})</span>
                        </button>

                        <div className={`mt-2 space-y-1 pl-2.5 border-l border-white/5 overflow-hidden transition-all duration-300 ${
                          isExpanded ? 'max-h-60' : 'max-h-0'
                        }`}>
                          {msg.tools.map((t) => (
                            <div key={t.id} className="flex justify-between items-baseline py-0.5">
                              <span className="truncate pr-2 text-neutral-450">
                                {getToolEmoji(t.tool)} {t.tool} {t.preview && <span className="text-neutral-600">({t.preview})</span>}
                              </span>
                              <span className={t.status === 'running' ? 'text-white font-bold' : 'text-neutral-600'}>
                                {t.status === 'running' ? 'running' : t.status === 'failed' ? 'failed' : `${t.duration?.toFixed(1) || '0.1'}s`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* Floating active tool execution line */}
      {runningTool && !isPromptExpanded && (
        <div className="absolute bottom-28 left-6 right-6 z-35 flex justify-center pointer-events-none select-none">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="font-mono text-[9px] uppercase tracking-wider text-neutral-400 bg-neutral-950/80 backdrop-blur border border-white/5 py-1 px-3 rounded-full flex items-center gap-2"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white pulse-white-glow" />
            <span>Executing: {runningTool.tool}</span>
          </motion.div>
        </div>
      )}

      {/* Connection error panel */}
      {error && (
        <div className="mx-6 mb-4 px-4 py-2 bg-neutral-950 border border-neutral-900 rounded-xl flex items-center justify-between text-[10px] text-neutral-500 font-mono z-40 select-none">
          <span className="truncate pr-4 flex items-center gap-2">
            <DangerTriangle className="w-4 h-4 text-white shrink-0" />
            Connection offline / API gateway error
          </span>
          <button 
            onClick={() => window.location.reload()} 
            className="text-[9px] font-bold text-white uppercase border border-neutral-800 px-2 py-0.5 rounded cursor-pointer"
          >
            <Restart className="w-2.5 h-2.5 inline mr-1" />
            Sync
          </button>
        </div>
      )}

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
      <footer className="w-full shrink-0 px-4 pt-3 pb-safe-pb bg-transparent z-40 relative">
        <div className="max-w-xl mx-auto">
          
          <motion.div
            layout
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={`ethereal-card shadow-2xl relative mx-auto overflow-hidden rounded-[24px] ${
              isPromptExpanded 
                ? 'max-w-xl p-4 z-40' 
                : 'max-w-[240px] py-2.5 px-4 cursor-pointer hover:border-white/15 select-none active:scale-95'
            }`}
            onClick={!isPromptExpanded ? () => setIsPromptExpanded(true) : undefined}
          >
            <AnimatePresence mode="wait">
              {!isPromptExpanded ? (
                
                /* MODE 1: Collapsed Pill Content */
                <motion.div
                  key="collapsed-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-between w-full"
                >
                  <div className="flex items-center gap-2">
                    <div className="relative flex h-2 w-2">
                      {isRunning ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-white pulse-white-glow" />
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-neutral-650" />
                      )}
                    </div>
                    <span className="font-mono tracking-wide text-neutral-450 text-[11px]">
                      {isRunning ? 'Fi reasoning...' : 'Prompt Fi...'}
                    </span>
                  </div>
                  
                  {usage && (
                    <span className="text-[9px] text-neutral-500 font-mono tracking-wider">
                      ${usage.deepseek.total.toFixed(2)}
                    </span>
                  )}
                </motion.div>

              ) : (

                /* MODE 2: Expanded Ethereal Card Content */
                <motion.div
                  key="expanded-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, delay: 0.04 }}
                  className="flex flex-col gap-3 w-full"
                >
                  {/* Input Area */}
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Fi..."
                    className="w-full bg-transparent border-none outline-none text-[12px] font-light text-white placeholder-neutral-500 resize-none font-sans-hermes no-scrollbar min-h-[22px] max-h-32 pr-2 leading-relaxed"
                    style={{ height: '22px' }}
                  />

                  {/* Bottom Toolbar - Only Send/Stop Action Button */}
                  <div className="flex items-center justify-end pt-1 select-none">
                    
                    {/* Circular Action Button */}
                    {isRunning ? (
                      <button 
                        onClick={stopActiveRun}
                        className="w-7 h-7 rounded-full bg-white text-black flex items-center justify-center font-bold text-xs shadow-lg active:scale-90 transition-transform cursor-pointer"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button 
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        className="w-7 h-7 rounded-full bg-white disabled:bg-neutral-850 text-black disabled:text-neutral-600 flex items-center justify-center shadow-lg disabled:shadow-none active:scale-90 transition-transform cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    )}

                  </div>
                </motion.div>

              )}
            </AnimatePresence>
          </motion.div>

        </div>
      </footer>
    </div>
  );
}
