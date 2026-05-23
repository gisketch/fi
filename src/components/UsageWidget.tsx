import { useEffect, useState } from 'react';
import { getUsageData, UsageData } from '../services/api';
import { Coins, HardDrive, RefreshCw, Layers } from 'lucide-react';

export function UsageWidget() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUsageData();
      setData(res);
    } catch (e) {
      setError('Could not sync status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-card rounded-2xl p-4 mb-4 select-none relative overflow-hidden transition-all duration-300 hover:border-zinc-700/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">VPS Agent & System Status</span>
        </div>
        <button 
          onClick={fetchData} 
          disabled={loading}
          className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded-full active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="text-xs text-red-400 bg-red-950/20 rounded-lg p-2 border border-red-900/30">
          {error}
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center py-6">
          <div className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5">
          {/* DeepSeek API Balance Card */}
          <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-800/40">
            <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1">
              <Coins className="w-3.5 h-3.5 text-amber-500" />
              <span>DeepSeek Balance</span>
            </div>
            <div className="text-lg font-bold text-zinc-100">
              {data.deepseek.total.toLocaleString('en-US', {
                style: 'currency',
                currency: data.deepseek.currency || 'USD',
              })}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              Synced: {new Date(data.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Codex Plan & Resource Quota Card */}
          <div className="bg-zinc-900/40 rounded-xl p-3 border border-zinc-800/40 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-500 text-xs mb-1">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-violet-400" />
                <span>Codex Plan</span>
              </div>
              <span className="text-[10px] font-bold text-violet-400 uppercase bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-900/50">
                {data.codex.plan}
              </span>
            </div>
            
            <div className="space-y-1.5 mt-2">
              {/* 5-Hour usage */}
              <div>
                <div className="flex justify-between text-[9px] text-zinc-500">
                  <span>5-Hour Quota</span>
                  <span className="font-semibold text-zinc-300">{data.codex['5hour'].used_percent}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-0.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-violet-500 to-indigo-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${data.codex['5hour'].used_percent}%` }}
                  />
                </div>
              </div>

              {/* Weekly usage */}
              <div>
                <div className="flex justify-between text-[9px] text-zinc-500">
                  <span>Weekly Limit</span>
                  <span className="font-semibold text-zinc-300">{data.codex.weekly.used_percent}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5 mt-0.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-pink-500 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${data.codex.weekly.used_percent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
