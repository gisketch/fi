import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import HermesGateway from '../../services/hermesGateway';
import { X, Settings, Cpu, ToggleLeft, ToggleRight, Hammer, Award, RefreshCw, Check } from 'lucide-react';

interface ControlCenterDialogProps {
  sessionId: string | null;
  onClose: () => void;
}

export const ControlCenterDialog = ({ sessionId, onClose }: ControlCenterDialogProps) => {
  const [activeTab, setActiveTab] = useState<'config' | 'models' | 'tools' | 'skills'>('config');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Config State
  const [configRows, setConfigRows] = useState<string[][]>([]);
  
  // Model State
  const [providers, setProviders] = useState<any[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('');

  // Toolsets State
  const [toolsets, setToolsets] = useState<any[]>([]);

  // Skills State
  const [skills, setSkills] = useState<any[]>([]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await HermesGateway.showConfig();
      const rows = res.sections.flatMap(s => s.rows);
      setConfigRows(rows);

      // Extract current model if possible
      const modelRow = rows.find(r => r[0].toLowerCase() === 'model');
      if (modelRow) {
        setCurrentModel(modelRow[1]);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await HermesGateway.getModelOptions(sessionId || undefined);
      setProviders(res.providers || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadToolsets = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await HermesGateway.listToolsets(sessionId || undefined);
      setToolsets(res.toolsets || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await HermesGateway.manageSkills({ action: 'list' });
      setSkills(res.skills || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'config') void loadConfig();
    if (activeTab === 'models') void loadModels();
    if (activeTab === 'tools') void loadToolsets();
    if (activeTab === 'skills') void loadSkills();
  }, [activeTab]);

  const handleToggleConfig = async (key: string, currentValue: string) => {
    const valueMap: Record<string, any> = {
      'true': false,
      'false': true,
      'on': 'off',
      'off': 'on',
      'enabled': 'disabled',
      'disabled': 'enabled',
    };
    
    const nextVal = valueMap[currentValue.toLowerCase()];
    if (nextVal === undefined) return;

    try {
      setError(null);
      await HermesGateway.setConfig(key, nextVal, sessionId || undefined);
      void loadConfig();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSelectModel = async (modelName: string) => {
    try {
      setError(null);
      await HermesGateway.setConfig('model', modelName, sessionId || undefined);
      setCurrentModel(modelName);
      void loadConfig();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleToggleToolset = async (name: string, currentlyEnabled: boolean) => {
    try {
      setError(null);
      const action = currentlyEnabled ? 'disable' : 'enable';
      await HermesGateway.configureTools(action, [name], sessionId || undefined);
      void loadToolsets();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleReloadSkills = async () => {
    try {
      setLoading(true);
      setError(null);
      await HermesGateway.reloadSkills();
      void loadSkills();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
        aria-label="Hermes Control Center"
        initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        transition={{ duration: 0.22 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[82vh] w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[0.06] bg-neutral-950/95 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3 shrink-0">
          <div>
            <div className="font-serif-hermes text-[18px] italic text-zinc-200">Control Center</div>
            <div className="font-sans-hermes text-[11px] text-neutral-600">Configure remote agent environments</div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="rounded-full p-1 text-neutral-500 active:scale-95" 
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-white/[0.03] px-2 py-1 bg-white/[0.01] shrink-0 font-mono text-[11px] uppercase tracking-wider text-neutral-400 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 ${activeTab === 'config' ? 'text-white bg-white/[0.04] font-bold' : ''}`}
          >
            <Settings className="w-3.5 h-3.5" />
            Config
          </button>
          <button
            onClick={() => setActiveTab('models')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 ${activeTab === 'models' ? 'text-white bg-white/[0.04] font-bold' : ''}`}
          >
            <Cpu className="w-3.5 h-3.5" />
            Models
          </button>
          <button
            onClick={() => setActiveTab('tools')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 ${activeTab === 'tools' ? 'text-white bg-white/[0.04] font-bold' : ''}`}
          >
            <Hammer className="w-3.5 h-3.5" />
            Tools
          </button>
          <button
            onClick={() => setActiveTab('skills')}
            className={`px-3 py-2 rounded-xl flex items-center gap-1.5 ${activeTab === 'skills' ? 'text-white bg-white/[0.04] font-bold' : ''}`}
          >
            <Award className="w-3.5 h-3.5" />
            Skills
          </button>
        </div>

        {/* Inner Content Area */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[56vh] ios-scrollable no-scrollbar">
          {error && <div className="rounded-2xl bg-red-950/20 p-3 mb-3 font-sans-hermes text-[12px] text-red-200/70">{error}</div>}

          {loading && (
            <div className="flex items-center justify-center py-16 text-neutral-500">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
          )}

          {!loading && activeTab === 'config' && (
            <div className="space-y-2">
              {configRows.map(([key, val]) => {
                const isToggleable = ['true', 'false', 'on', 'off', 'enabled', 'disabled'].includes(val.toLowerCase());
                const isTrue = ['true', 'on', 'enabled'].includes(val.toLowerCase());

                return (
                  <div key={key} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.035]">
                    <div>
                      <div className="font-mono text-[12px] text-zinc-300 font-bold">{key}</div>
                      <div className="font-sans-hermes text-[11px] text-neutral-500 mt-0.5">Key status value</div>
                    </div>
                    {isToggleable ? (
                      <button
                        onClick={() => handleToggleConfig(key, val)}
                        className="text-neutral-400 hover:text-white"
                      >
                        {isTrue ? (
                          <ToggleRight className="w-7 h-7 text-white" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-neutral-600" />
                        )}
                      </button>
                    ) : (
                      <span className="font-mono text-[12px] text-neutral-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/5">
                        {val}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!loading && activeTab === 'models' && (
            <div className="space-y-4">
              {providers.map((p) => (
                <div key={p.provider} className="space-y-2">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500 pl-1 font-bold">
                    {p.provider}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {p.models.map((m: string) => {
                      const isSelected = currentModel === m || currentModel.endsWith(m);
                      return (
                        <button
                          key={m}
                          onClick={() => handleSelectModel(m)}
                          className={`w-full text-left rounded-2xl p-3 flex items-center justify-between border transition-all ${
                            isSelected 
                              ? 'bg-white/[0.06] border-white/10' 
                              : 'bg-white/[0.02] border-transparent hover:bg-white/[0.035]'
                          }`}
                        >
                          <span className="font-serif-hermes text-[14px] italic text-zinc-200">
                            {m}
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === 'tools' && (
            <div className="space-y-2">
              {toolsets.map((t) => (
                <div key={t.name} className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.025] hover:bg-white/[0.035]">
                  <div>
                    <div className="font-serif-hermes text-[15px] italic text-zinc-300">
                      {t.name.replace(/_/g, ' ')}
                    </div>
                    {t.description && (
                      <div className="font-sans-hermes text-[11px] text-neutral-500 mt-0.5">
                        {t.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggleToolset(t.name, t.enabled)}
                    className="text-neutral-400 hover:text-white"
                  >
                    {t.enabled ? (
                      <ToggleRight className="w-7 h-7 text-white" />
                    ) : (
                      <ToggleLeft className="w-7 h-7 text-neutral-600" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          {!loading && activeTab === 'skills' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.03]">
                <span className="font-sans-hermes text-[12px] text-neutral-500">Skills index</span>
                <button
                  onClick={handleReloadSkills}
                  className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-white hover:bg-white/[0.04]"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reload index
                </button>
              </div>

              {skills.length === 0 && (
                <div className="py-8 text-center font-serif-hermes text-[14px] italic text-neutral-600">
                  No custom skills found.
                </div>
              )}

              {skills.map((s) => (
                <div key={s.name} className="p-3 rounded-2xl bg-white/[0.025] border border-white/[0.03] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-white font-bold">{s.name}</span>
                    {s.installed && (
                      <span className="rounded bg-white/[0.06] border border-white/[0.05] px-1.5 py-0.5 font-mono text-[9px] text-neutral-400">
                        active
                      </span>
                    )}
                  </div>
                  {s.description && (
                    <p className="font-sans-hermes text-[11px] text-neutral-500">
                      {s.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
export default ControlCenterDialog;
