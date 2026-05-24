import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Check, KeyRound, Monitor, Plug, RefreshCw, Save, Server, X } from 'lucide-react';
import {
  TerminalGatewayClient,
  defaultTerminalProfile,
  terminalStorage,
  type TerminalSshProfile,
} from '../../services/terminalGateway';

type TerminalDialogProps = {
  onClose: () => void;
};

const normalizeProfile = (profile: TerminalSshProfile): TerminalSshProfile => ({
  host: profile.host.trim(),
  port: Math.max(1, Math.min(65535, Number(profile.port) || 22)),
  user: profile.user.trim() || 'root',
  password: profile.password,
});

export const TerminalDialog = ({ onClose }: TerminalDialogProps) => {
  const terminalRootRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const autoConnectRef = useRef(false);

  const [pin, setPin] = useState('');
  const [token, setToken] = useState(() => terminalStorage.getToken());
  const [tokenReady, setTokenReady] = useState(false);
  const [profile, setProfile] = useState<TerminalSshProfile>(() => terminalStorage.getProfile());
  const [status, setStatus] = useState('Checking terminal token...');
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      if (!token) {
        setTokenReady(false);
        setStatus('PIN required');
        return;
      }

      const ok = await TerminalGatewayClient.verify(token);
      if (cancelled) return;

      if (ok) {
        setTokenReady(true);
        setStatus('Terminal unlocked');
      } else {
        terminalStorage.clearToken();
        setToken('');
        setTokenReady(false);
        setStatus('PIN expired');
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
        fit.fit();
        xterm.focus();
      });
    }

    const disposable = xterm.onData((data) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const handleResize = () => {
      fit.fit();
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: xterm.cols, rows: xterm.rows }));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      disposable.dispose();
      wsRef.current?.close();
      xterm.dispose();
    };
  }, []);

  useEffect(() => {
    if (autoConnectRef.current || !tokenReady || !profile.password) return;
    autoConnectRef.current = true;
    void connectTerminal();
  }, [tokenReady, profile.password]);

  const writeLine = (line: string) => {
    xtermRef.current?.writeln(line);
  };

  const handleUnlock = async (event: FormEvent) => {
    event.preventDefault();
    if (!pin.trim()) return;

    setError(null);
    setStatus('Unlocking terminal...');

    try {
      const res = await TerminalGatewayClient.unlock(pin.trim());
      terminalStorage.setToken(res.token);
      setToken(res.token);
      setPin('');
      setTokenReady(true);
      setStatus('Terminal unlocked');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unlock terminal');
      setStatus('PIN required');
    }
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
      return;
    }

    terminalStorage.setProfile(nextProfile);
    setProfile(nextProfile);
    setError(null);
    setConnecting(true);
    setStatus('Connecting terminal...');

    const xterm = xtermRef.current;
    const fit = fitRef.current;
    fit?.fit();
    xterm?.clear();
    writeLine(`Connecting to ${nextProfile.user}@${nextProfile.host}:${nextProfile.port}...`);

    const ws = new WebSocket(TerminalGatewayClient.terminalWsUrl(token));
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setConnecting(false);
      setStatus('Terminal connected');
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
          setStatus(String(frame.message || 'Terminal status'));
          return;
        }
        if (frame.type === 'error') {
          const message = String(frame.message || 'Terminal error');
          setError(message);
          writeLine(`\r\n[error] ${message}`);
        }
      } catch {
        xterm?.write(String(event.data));
      }
    };

    ws.onerror = () => {
      setError('Terminal WebSocket error');
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnected(false);
      setConnecting(false);
      setStatus('Terminal disconnected');
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
    setStatus('PIN required');
  };

  const resetProfile = () => {
    const next = defaultTerminalProfile();
    terminalStorage.setProfile(next);
    setProfile(next);
    setStatus('SSH profile reset');
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 px-3 pb-3 backdrop-blur-xl sm:items-center sm:px-4 sm:pb-4"
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Fi terminal"
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        transition={{ duration: 0.18 }}
        onClick={(event) => event.stopPropagation()}
        className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/[0.08] bg-neutral-950 shadow-2xl sm:h-[82vh]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-serif-hermes text-[18px] italic text-zinc-200">
              <Monitor className="h-4 w-4 text-neutral-500" />
              Terminal
            </div>
            <div className="truncate font-mono text-[10px] uppercase tracking-wider text-neutral-600">{status}</div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-neutral-500 active:scale-95" aria-label="Close terminal">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid shrink-0 gap-2 border-b border-white/[0.06] p-3 md:grid-cols-[0.8fr_1.2fr_auto]">
          <form onSubmit={handleUnlock} className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2 py-2">
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              type="password"
              inputMode="numeric"
              placeholder={tokenReady ? 'Unlocked' : 'PIN'}
              className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none placeholder:text-neutral-700"
            />
            <button
              type="submit"
              disabled={!pin.trim()}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black disabled:bg-neutral-800 disabled:text-neutral-600"
              aria-label="Unlock terminal"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </form>

          <div className="grid grid-cols-[1fr_76px_0.75fr] gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-2">
            <label className="flex min-w-0 items-center gap-2">
              <Server className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
              <input
                value={profile.host}
                onChange={(event) => setProfile({ ...profile, host: event.target.value })}
                placeholder="SSH host"
                className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-zinc-200 outline-none placeholder:text-neutral-700"
              />
            </label>
            <input
              value={profile.port}
              onChange={(event) => setProfile({ ...profile, port: Number.parseInt(event.target.value, 10) || 22 })}
              inputMode="numeric"
              className="min-w-0 bg-transparent text-center font-mono text-[12px] text-zinc-200 outline-none"
            />
            <input
              value={profile.user}
              onChange={(event) => setProfile({ ...profile, user: event.target.value })}
              placeholder="user"
              className="min-w-0 bg-transparent font-mono text-[12px] text-zinc-200 outline-none placeholder:text-neutral-700"
            />
            <input
              value={profile.password}
              onChange={(event) => setProfile({ ...profile, password: event.target.value })}
              type="password"
              placeholder="SSH password"
              className="col-span-3 min-w-0 border-t border-white/[0.04] bg-transparent pt-2 font-mono text-[12px] text-zinc-200 outline-none placeholder:text-neutral-700"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={handleSaveProfile} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-neutral-400 active:scale-95" aria-label="Save SSH profile">
              <Save className="h-4 w-4" />
            </button>
            <button type="button" onClick={resetProfile} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-neutral-500 active:scale-95" aria-label="Reset SSH profile">
              <RefreshCw className="h-4 w-4" />
            </button>
            {tokenReady && (
              <button type="button" onClick={forgetToken} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] text-neutral-500 active:scale-95" aria-label="Forget PIN token">
                <KeyRound className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={connected || connecting ? disconnectTerminal : () => void connectTerminal()}
              disabled={!tokenReady}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black disabled:bg-neutral-850 disabled:text-neutral-600 active:scale-95"
              aria-label={connected || connecting ? 'Disconnect terminal' : 'Connect terminal'}
            >
              <Plug className="h-4 w-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="shrink-0 border-b border-red-500/10 bg-red-500/[0.04] px-4 py-2 font-mono text-[11px] text-red-200/75">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 bg-[#050505] p-2">
          <div ref={terminalRootRef} className="h-full w-full overflow-hidden" />
        </div>
      </motion.div>
    </div>
  );
};
