import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, HelpCircle, Lock, Key, AlertTriangle, Check, X } from 'lucide-react';

interface BlockingPromptsDialogProps {
  request: {
    type: 'approval' | 'clarify' | 'sudo' | 'secret';
    payload: any;
  };
  onResolve: (type: 'approval' | 'clarify' | 'sudo' | 'secret', value: string, all?: boolean) => void;
}

export const BlockingPromptsDialog = ({ request, onResolve }: BlockingPromptsDialogProps) => {
  const [inputValue, setInputValue] = useState('');
  const [approveAll, setApproveAll] = useState(false);
  const { type, payload } = request;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type !== 'approval' && !inputValue.trim()) return;
    onResolve(type, inputValue.trim(), approveAll);
    setInputValue('');
  };

  const handleApprovalChoice = (choice: 'allow' | 'deny') => {
    onResolve('approval', choice, approveAll);
  };

  const isDangerousTool = (toolName?: string) => {
    if (!toolName) return false;
    const dangerous = [
      'shell.exec',
      'cli.exec',
      'process.stop',
      'rollback.restore',
      'reload.env',
      'reload.mcp',
      'sudo.respond',
      'secret.respond',
      'model.save_key',
    ];
    return dangerous.some(d => toolName.includes(d));
  };

  const renderContent = () => {
    switch (type) {
      case 'approval': {
        const tool = payload.tool || 'unknown tool';
        const args = payload.arguments ? JSON.stringify(payload.arguments, null, 2) : '';
        const dangerous = isDangerousTool(tool);

        return (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.025] p-4">
              <ShieldAlert className={`w-6 h-6 shrink-0 ${dangerous ? 'text-red-400' : 'text-zinc-400'}`} />
              <div className="space-y-1">
                <div className="font-serif-hermes text-[16px] italic text-zinc-200">
                  Tool Authorization Requested
                </div>
                <p className="font-sans-hermes text-[12px] text-neutral-500">
                  The agent requires permission to run:
                </p>
                <div className="mt-2 font-mono text-[13px] text-white bg-black/40 px-2.5 py-1 rounded border border-white/5">
                  {tool}
                </div>
              </div>
            </div>

            {payload.message && (
              <p className="font-serif-hermes text-[14px] italic text-neutral-400">
                &ldquo;{payload.message}&rdquo;
              </p>
            )}

            {args && (
              <div className="space-y-1">
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Arguments</div>
                <pre className="font-mono text-[11px] text-zinc-400 bg-black/60 p-3 rounded-xl border border-white/[0.04] max-h-[160px] overflow-auto">
                  {args}
                </pre>
              </div>
            )}

            {dangerous && (
              <div className="flex items-center gap-2 rounded-xl bg-red-950/20 border border-red-900/30 p-3 text-[12px] font-sans-hermes text-red-200/80">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>Caution: This is a high-privilege VPS operation. Verify inputs.</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <label className="flex items-center gap-2 font-sans-hermes text-[12px] text-neutral-400 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={approveAll} 
                  onChange={(e) => setApproveAll(e.target.checked)}
                  className="rounded bg-black border-white/10"
                />
                <span>Auto-approve future calls for this tool session</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleApprovalChoice('deny')}
                className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-white active:scale-[0.99] hover:bg-white/[0.03]"
              >
                <X className="w-3.5 h-3.5" />
                Deny
              </button>
              <button
                type="button"
                onClick={() => handleApprovalChoice('allow')}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-white py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-black active:scale-[0.99]"
              >
                <Check className="w-3.5 h-3.5" />
                Approve
              </button>
            </div>
          </div>
        );
      }

      case 'clarify': {
        const options = payload.options || [];

        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.025] p-4">
              <HelpCircle className="w-6 h-6 text-zinc-400 shrink-0" />
              <div className="space-y-1">
                <div className="font-serif-hermes text-[16px] italic text-zinc-200">
                  Clarifying Question
                </div>
                <p className="font-sans-hermes text-[13px] text-neutral-400">
                  {payload.question}
                </p>
              </div>
            </div>

            {options.length > 0 && (
              <div className="space-y-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600 font-bold">Suggested Answers</div>
                <div className="grid grid-cols-1 gap-2">
                  {options.map((opt: string) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onResolve('clarify', opt)}
                      className="w-full text-left rounded-xl bg-white/[0.025] border border-white/[0.05] p-3 font-sans-hermes text-[13px] text-zinc-300 hover:bg-white/[0.05] active:scale-[0.99]"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Your Answer</div>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your response..."
                className="w-full rounded-2xl border border-white/[0.06] bg-black p-3 font-sans-hermes text-[14px] text-white focus:outline-none focus:border-white/20"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-full rounded-2xl bg-white py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-black active:scale-[0.99] disabled:opacity-40"
            >
              Submit Response
            </button>
          </form>
        );
      }

      case 'sudo': {
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.025] p-4">
              <Lock className="w-6 h-6 text-zinc-400 shrink-0" />
              <div className="space-y-1">
                <div className="font-serif-hermes text-[16px] italic text-zinc-200">
                  Elevated Privileges Required (Sudo)
                </div>
                <p className="font-sans-hermes text-[12px] text-neutral-500">
                  {payload.message || 'The operation requires administrative password.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Password</div>
              <input
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Enter sudo password..."
                className="w-full rounded-2xl border border-white/[0.06] bg-black p-3 font-mono text-[14px] text-white focus:outline-none focus:border-white/20"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-full rounded-2xl bg-white py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-black active:scale-[0.99] disabled:opacity-40"
            >
              Authorize Sudo
            </button>
          </form>
        );
      }

      case 'secret': {
        return (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.025] p-4">
              <Key className="w-6 h-6 text-zinc-400 shrink-0" />
              <div className="space-y-1">
                <div className="font-serif-hermes text-[16px] italic text-zinc-200">
                  Secret Required
                </div>
                <p className="font-sans-hermes text-[12px] text-neutral-500">
                  Provide missing token/secret variable for:
                </p>
                <div className="mt-1 font-mono text-[12px] text-white font-bold bg-white/[0.04] px-2 py-0.5 rounded">
                  {payload.name}
                </div>
              </div>
            </div>

            {payload.message && (
              <p className="font-serif-hermes text-[14px] italic text-neutral-400">
                &ldquo;{payload.message}&rdquo;
              </p>
            )}

            <div className="space-y-2">
              <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-600">Secret Value</div>
              <input
                type="password"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Enter value for ${payload.name}...`}
                className="w-full rounded-2xl border border-white/[0.06] bg-black p-3 font-sans-hermes text-[14px] text-white focus:outline-none focus:border-white/20"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="w-full rounded-2xl bg-white py-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-black active:scale-[0.99] disabled:opacity-40"
            >
              Submit Secret
            </button>
          </form>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/80 px-4 pb-4 backdrop-blur-xl sm:items-center">
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.96, filter: 'blur(6px)' }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950 p-6 shadow-2xl"
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};
export default BlockingPromptsDialog;
