import { AnimatePresence, motion } from 'framer-motion';
import { X, Cpu, Info, ShieldCheck, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

const AVAILABLE_MODELS = [
  { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash', desc: 'Fast, efficient agent reasoning (Recommended)' },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', desc: 'Deep multi-step reasoning capabilities' },
  { id: 'hermes-agent', name: 'Hermes Agent', desc: 'Default system gateway container model' },
];

export function SettingsModal({ isOpen, onClose, selectedModel, onSelectModel }: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Bottom Sheet Slide Up */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 220 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950 border-t border-zinc-800/80 rounded-t-[32px] p-6 pb-safe-pb z-50 shadow-2xl safe-mb"
          >
            {/* iOS Sheet drag indicator */}
            <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-5" onClick={onClose} />

            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-violet-400" />
                <h3 className="text-lg font-bold text-zinc-100">Hermes Settings</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              {/* API Security Notice */}
              <div className="bg-zinc-900/40 rounded-2xl p-3.5 border border-zinc-800/60 flex gap-3 items-start">
                <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-zinc-200">Secure VPS Gateway</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                    Connected to <code className="text-zinc-300 font-mono">fi.gisketch.com</code> using environmental auth token credentials. All operations are local and secure.
                  </p>
                </div>
              </div>

              {/* Model Picker */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 block mb-2 px-1">
                  Active Reasoning Model
                </span>
                <div className="space-y-2">
                  {AVAILABLE_MODELS.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => onSelectModel(model.id)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between ${
                        selectedModel === model.id
                          ? 'bg-violet-950/20 border-violet-500/60 shadow-lg shadow-violet-950/10'
                          : 'bg-zinc-900/30 border-zinc-850 hover:bg-zinc-900/60 hover:border-zinc-800'
                      }`}
                    >
                      <div className="pr-4">
                        <div className="text-xs font-bold text-zinc-100">{model.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 leading-tight">{model.desc}</div>
                      </div>
                      {selectedModel === model.id && (
                        <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center text-white shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* About details */}
              <div className="pt-2 border-t border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500">
                <span className="flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  Hermes.dev iOS Client v0.1
                </span>
                <span>fi-ui standard PWA</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
