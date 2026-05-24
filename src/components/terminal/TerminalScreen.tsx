import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, KeyRound, Menu, Plug, RefreshCw, Save, Server, Settings, X } from 'lucide-react';
import {
  TerminalGatewayClient,
  defaultTerminalProfile,
  terminalStorage,
  type TerminalSshProfile,
} from '../../services/terminalGateway';

type TerminalScreenProps = {
  active: boolean;
  onBack: () => void;
};

const normalizeProfile = (profile: TerminalSshProfile): TerminalSshProfile => ({
  host: profile.host.trim(),
  port: Math.max(1, Math.min(65535, Number(profile.port) || 22)),
  user: profile.user.trim() || 'root',
  password: profile.password,
});

const getViewportHeight = () => {
  if (typeof window === 'undefined') return undefined;
  return window.visualViewport?.height || window.innerHeight;
};

const getKeyboardOpen = () => {
  if (typeof window === 'undefined') return false;
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  return window.innerHeight - viewportHeight > 120;
};

const getArrowSequence = (direction: 'up' | 'down' | 'left' | 'right', shift: boolean, ctrl: boolean) => {
  const final = direction === 'up' ? 'A' : direction === 'down' ? 'B' : direction === 'right' ? 'C' : 'D';
  const modifier = ctrl && shift ? 6 : ctrl ? 5 : shift ? 2 : 0;
  return modifier ? `\x1b[1;${modifier}${final}` : `\x1b[${final}`;
};

export const TerminalScreen = ({ active, onBack }: TerminalScreenProps) => {
  const terminalRootRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const autoConnectRef = useRef(false);

  const [token, setToken] = useState(() => terminalStorage.getToken());
  const [tokenReady, setTokenReady] = useState(false);
  const [profile, setProfile] = useState<TerminalSshProfile>(() => terminalStorage.getProfile());
  const [status, setStatus] = useState('Checking terminal token...');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | undefined>(() => getViewportHeight());
  const [keyboardOpen, setKeyboardOpen] = useState(() => getKeyboardOpen());
  const [shiftActive, setShiftActive] = useState(false);
  const [ctrlActive, setCtrlActive] = useState(false);

  const fitTerminal = () => {
    const fit = fitRef.current;
    const xterm = xtermRef.current;
    if (!fit || !xterm) return;

    try {
      fit.fit();
    } catch {
      return;
    }

    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
    }
  };

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        setTokenReady(false);
        setStatus('App PIN required');
        return;
      }

      const ok = await TerminalGatewayClient.verify(token);
      if (cancelled) return;

      if (ok) {
        setTokenReady(true);
        setStatus('Unlocked by app PIN');
      } else {
        terminalStorage.clearToken();
        setToken('');
        setTokenReady(false);
        setStatus('App PIN expired');
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    const xterm = new XTerm({
      cursorBlink: true,
      fontFamily: '"GeistMono Nerd Font", "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.18,
      convertEol: true,
      allowProposedApi: false,
      theme: {
        background: '#050505',
        foreground: '#d4d4d8',
        cursor: '#ffffff',
        selectionBackground: '#3f3f46',
        black: '#000000',
        red: '#fca5a5',
        green: '#86efac',
        yellow: '#fde68a',
        blue: '#93c5fd',
        magenta: '#d8b4fe',
        cyan: '#67e8f9',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#fecaca',
        brightGreen: '#bbf7d0',
        brightYellow: '#fef3c7',
        brightBlue: '#bfdbfe',
        brightMagenta: '#e9d5ff',
        brightCyan: '#a5f3fc',
        brightWhite: '#ffffff',
      },
    });
    const fit = new FitAddon();
    xterm.loadAddon(fit);
    xtermRef.current = xterm;
    fitRef.current = fit;

    if (terminalRootRef.current) {
      xterm.open(terminalRootRef.current);
      window.requestAnimationFrame(() => {
        fitTerminal();
        if (active) xterm.focus();
      });
    }

    const disposable = xterm.onData((data) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      setViewportHeight(getViewportHeight());
      setKeyboardOpen(getKeyboardOpen());
      window.requestAnimationFrame(fitTerminal);
    };

    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
      disposable.dispose();
      wsRef.current?.close();
      xterm.dispose();
    };
  }, []);

  useEffect(() => {
    if (!active) return;

    const timer = window.setTimeout(() => {
      fitTerminal();
      xtermRef.current?.focus();
    }, 50);

    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (autoConnectRef.current || !tokenReady || !profile.password) return;
    autoConnectRef.current = true;
    void connectTerminal();
  }, [tokenReady, profile.password]);

  const writeLine = (line: string) => {
    xtermRef.current?.writeln(line);
  };

  const sendTerminalInput = (data: string) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'input', data }));
    }
    xtermRef.current?.focus();
  };

  const sendArrow = (direction: 'up' | 'down' | 'left' | 'right') => {
    sendTerminalInput(getArrowSequence(direction, shiftActive, ctrlActive));
  };

  const handleSaveProfile = () => {
    const next = normalizeProfile(profile);
    terminalStorage.setProfile(next);
    setProfile(next);
    setStatus('SSH profile saved');
  };

  const connectTerminal = async () => {
    if (!tokenReady || !token || connecting || connected) return;

    const nextProfile = normalizeProfile(profile);
    if (!nextProfile.host || !nextProfile.user || !nextProfile.password) {
      setError('SSH host, user, and password are required');
      setSettingsOpen(true);
      return;
    }

    terminalStorage.setProfile(nextProfile);
    setProfile(nextProfile);
    setError(null);
    setConnecting(true);
    setStatus('Opening gateway socket...');

    const xterm = xtermRef.current;
    fitTerminal();
    xterm?.clear();
    writeLine('[fi] opening gateway socket');
    writeLine(`[fi] target ${nextProfile.user}@${nextProfile.host}:${nextProfile.port}`);

    const ws = new WebSocket(TerminalGatewayClient.terminalWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('Gateway connected, starting SSH...');
      writeLine('[fi] gateway connected');
      writeLine('[fi] starting SSH shell...');
      ws.send(JSON.stringify({
        type: 'connect',
        host: nextProfile.host,
        port: nextProfile.port,
        user: nextProfile.user,
        password: nextProfile.password,
        cols: xterm?.cols || 80,
        rows: xterm?.rows || 24,
      }));
      xterm?.focus();
    };

    ws.onmessage = (event) => {
      try {
        const frame = JSON.parse(String(event.data));
        if (frame.type === 'output') {
          xterm?.write(String(frame.data || ''));
          return;
        }
        if (frame.type === 'status') {
          const message = String(frame.message || 'Terminal status');
          setStatus(message);
          writeLine(`[gateway] ${message}`);
          if (message.toLowerCase() === 'connected') {
            setConnected(true);
            setConnecting(false);
          }
          return;
        }
        if (frame.type === 'error') {
          const message = String(frame.message || 'Terminal error');
          setError(message);
          setConnected(false);
          setConnecting(false);
          writeLine(`\r\n[error] ${message}`);
        }
      } catch {
        xterm?.write(String(event.data));
      }
    };

    ws.onerror = () => {
      setError('Terminal WebSocket error');
      writeLine('\r\n[error] terminal websocket error');
      setConnected(false);
      setConnecting(false);
    };

    ws.onclose = (event) => {
      setConnected(false);
      setConnecting(false);
      setStatus('Terminal disconnected');
      writeLine(`\r\n[fi] terminal disconnected (${event.code || 'closed'})`);
    };
  };

  const disconnectTerminal = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setConnecting(false);
    setStatus('Terminal disconnected');
  };

  const forgetToken = () => {
    disconnectTerminal();
    terminalStorage.clearToken();
    setToken('');
    setTokenReady(false);
    setStatus('App PIN required');
  };

  const resetProfile = () => {
    const next = defaultTerminalProfile();
    terminalStorage.setProfile(next);
    setProfile(next);
    setStatus('SSH profile reset');
  };

  const showKeyboardHelpers = active && keyboardOpen && !settingsOpen;

  return (
    <div
      aria-hidden={!active}
      className={`fixed inset-0 z-[70] flex flex-col bg-black text-white safe-pt transition-opacity duration-150 ${
        active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={viewportHeight ? { height: `${viewportHeight}px` } : { height: '100dvh' }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="min-w-0">
          <div className="font-serif-hermes text-[18px] italic text-zinc-200">Terminal</div>
          <div className={`truncate font-mono text-[10px] uppercase tracking-wider ${error ? 'text-red-300/75' : 'text-neutral-600'}`}>
            {error || status}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 active:scale-95"
            aria-label="Open terminal settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 active:scale-95"
            aria-label="Back to Fi"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className={`min-h-0 flex-1 overflow-hidden bg-[#050505] p-2 ${showKeyboardHelpers ? 'pb-16' : ''}`}>
        <div ref={terminalRootRef} className="h-full w-full overflow-hidden" />
      </div>

      <AnimatePresence>
        {showKeyboardHelpers && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.14 }}
            className="fixed inset-x-0 bottom-0 z-[75] border-t border-white/[0.08] bg-black/95 px-2 py-2 backdrop-blur-xl"
          >
            <div className="mx-auto flex max-w-xl items-center gap-1 overflow-x-auto no-scrollbar">
              {([
                ['left', ArrowLeft],
                ['down', ArrowDown],
                ['up', ArrowUp],
                ['right', ArrowRight],
              ] as const).map(([direction, Icon]) => (
                <button
                  key={direction}
                  type="button"
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => sendArrow(direction)}
                  className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] text-neutral-300 active:scale-95"
                  aria-label={`Terminal arrow ${direction}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}

              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => sendTerminalInput('\t')}
                className="flex h-10 min-w-14 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 font-mono text-[11px] uppercase tracking-wider text-neutral-300 active:scale-95"
              >
                Tab
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => setShiftActive((value) => !value)}
                className={`flex h-10 min-w-16 items-center justify-center rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider active:scale-95 ${
                  shiftActive ? 'border-white/25 bg-white text-black' : 'border-white/[0.08] bg-white/[0.035] text-neutral-300'
                }`}
              >
                Shift
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => setCtrlActive((value) => !value)}
                className={`flex h-10 min-w-14 items-center justify-center rounded-xl border px-3 font-mono text-[11px] uppercase tracking-wider active:scale-95 ${
                  ctrlActive ? 'border-white/25 bg-white text-black' : 'border-white/[0.08] bg-white/[0.035] text-neutral-300'
                }`}
              >
                Ctrl
              </button>
              <button
                type="button"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => sendTerminalInput('\x03')}
                className="flex h-10 min-w-16 items-center justify-center rounded-xl border border-red-300/15 bg-red-500/10 px-3 font-mono text-[11px] uppercase tracking-wider text-red-200/85 active:scale-95"
              >
                Ctrl+C
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center">
            <motion.button
              type="button"
              aria-label="Close terminal settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={() => setSettingsOpen(false)}
              className="absolute inset-0 bg-black/55"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Terminal settings"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 18, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="relative max-h-[calc(100%-env(safe-area-inset-top)-1rem)] w-full max-w-xl overflow-y-auto border-t border-white/[0.08] bg-neutral-950 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 shadow-2xl sm:mb-4 sm:rounded-t-2xl sm:border sm:border-white/[0.08]"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-serif-hermes text-[18px] italic text-zinc-200">Settings</div>
                  <div className={`truncate font-mono text-[10px] uppercase tracking-wider ${error ? 'text-red-300/75' : 'text-neutral-600'}`}>
                    {error || status}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 active:scale-95"
                  aria-label="Close terminal settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
                  <KeyRound className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">App access</div>
                    <div className="truncate font-mono text-[12px] text-zinc-300">{tokenReady ? 'Unlocked' : 'Locked'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-[1fr_76px] gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                  <label className="flex min-w-0 items-center gap-2">
                    <Server className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                    <input
                      value={profile.host}
                      onChange={(event) => setProfile({ ...profile, host: event.target.value })}
                      placeholder="SSH host"
                      className="min-w-0 flex-1 bg-transparent font-mono text-[13px] text-zinc-200 outline-none placeholder:text-neutral-700"
                    />
                  </label>
                  <input
                    value={profile.port}
                    onChange={(event) => setProfile({ ...profile, port: Number.parseInt(event.target.value, 10) || 22 })}
                    inputMode="numeric"
                    className="min-w-0 bg-transparent text-center font-mono text-[13px] text-zinc-200 outline-none"
                    aria-label="SSH port"
                  />
                  <input
                    value={profile.user}
                    onChange={(event) => setProfile({ ...profile, user: event.target.value })}
                    placeholder="SSH user"
                    className="col-span-2 min-w-0 border-t border-white/[0.04] bg-transparent pt-2 font-mono text-[13px] text-zinc-200 outline-none placeholder:text-neutral-700"
                  />
                  <input
                    value={profile.password}
                    onChange={(event) => setProfile({ ...profile, password: event.target.value })}
                    type="password"
                    placeholder="SSH password"
                    className="col-span-2 min-w-0 border-t border-white/[0.04] bg-transparent pt-2 font-mono text-[13px] text-zinc-200 outline-none placeholder:text-neutral-700"
                  />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    className="flex h-11 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-400 active:scale-95"
                    aria-label="Save SSH profile"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={resetProfile}
                    className="flex h-11 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-500 active:scale-95"
                    aria-label="Reset SSH profile"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={forgetToken}
                    disabled={!tokenReady}
                    className="flex h-11 items-center justify-center rounded-xl border border-white/[0.08] text-neutral-500 disabled:text-neutral-800 active:scale-95"
                    aria-label="Forget PIN token"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={connected || connecting ? disconnectTerminal : () => void connectTerminal()}
                    disabled={!tokenReady}
                    className="flex h-11 items-center justify-center rounded-xl bg-white text-black disabled:bg-neutral-850 disabled:text-neutral-600 active:scale-95"
                    aria-label={connected || connecting ? 'Disconnect terminal' : 'Connect terminal'}
                  >
                    <Plug className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
