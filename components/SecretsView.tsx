
import React, { useState, useEffect } from 'react';
import {
  Lock, Eye, EyeOff, Copy, Check, Terminal, FileText,
  Sparkles, Server, Mail, Search, Globe, Key, Cpu,
  ChevronDown, Database, Download, ShieldCheck, Zap, Plus, X,
  DollarSign, BarChart3, TrendingUp, RefreshCcw, Activity,
  Inbox, Send
} from 'lucide-react';
import { billingService } from '../services/billingService';
import { api } from '../services/apiService';
import { userScopeService } from '../services/userScopeService';
import { UsageStats, ModelUsage } from '../types';

interface SecretItem {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
  value: string;
  required: boolean;
  category: 'AI' | 'SYSTEM' | 'INTEGRATION' | 'COMMUNICATION';
  isManaged?: boolean;
}

const SecretsView: React.FC = () => {
  const [activeModel, setActiveModel] = useState('DYNAMIC');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSecret, setNewSecret] = useState({ key: '', label: '', description: '', category: 'INTEGRATION' as const });
  const [usageStats, setUsageStats] = useState<UsageStats>(billingService.getStats());

  const [secrets, setSecrets] = useState<SecretItem[]>([
    {
      key: 'API_KEY',
      label: 'Gemini API Key',
      description: 'Primary intelligence link. Enter your Gemini API key.',
      icon: Cpu,
      value: userScopeService.scopedGet('env_API_KEY') || process.env.API_KEY || '',
      required: true,
      category: 'AI',
      isManaged: false
    },
    {
      key: 'GATEWAY_TOKEN',
      label: 'Gateway Key',
      description: 'Handshake token for your VPS. Set this in your server config.',
      icon: Key,
      value: '',
      required: true,
      category: 'SYSTEM',
      isManaged: false
    },
    // --- Sentinel Email Config ---
    {
      key: 'SENTINEL_EMAIL',
      label: 'Email Address',
      description: 'Your outbound email identity.',
      icon: Mail,
      value: '',
      required: false,
      category: 'COMMUNICATION'
    },
    {
      key: 'SENTINEL_PASSWORD',
      label: 'Sentinel Pass',
      description: 'Secure SMTP/IMAP password.',
      icon: Lock,
      value: '',
      required: true,
      category: 'COMMUNICATION'
    },
    {
      key: 'IMAP_HOST',
      label: 'Incoming (IMAP)',
      description: 'Your IMAP server (e.g. imap.gmail.com:993)',
      icon: Inbox,
      value: '',
      required: false,
      category: 'COMMUNICATION'
    },
    {
      key: 'SMTP_HOST',
      label: 'Outgoing (SMTP)',
      description: 'Your SMTP server (e.g. smtp.gmail.com:465)',
      icon: Send,
      value: '',
      required: false,
      category: 'COMMUNICATION'
    },
    // --- Model Gateway ---
    {
      key: 'OPENROUTER_API_KEY',
      label: 'OpenRouter',
      description: 'Universal model gateway — access Claude, GPT, Llama, Mixtral, and 200+ models through one key.',
      icon: Globe,
      value: '',
      required: false,
      category: 'AI'
    },
    {
      key: 'OPENAI_API_KEY',
      label: 'OpenAI',
      description: 'Direct OpenAI access — GPT-4o, GPT-4.1, o3-mini, and more.',
      icon: Zap,
      value: '',
      required: false,
      category: 'AI'
    },
    {
      key: 'TAVILY_API_KEY',
      label: 'Tavily Search',
      description: 'Deep market research and live web scanning.',
      icon: Search,
      value: '',
      required: true,
      category: 'INTEGRATION'
    },
    {
      key: 'UPSTASH_REDIS_URL',
      label: 'Upstash Redis',
      description: 'Persistent memory vault.',
      icon: Database,
      value: '',
      required: false,
      category: 'SYSTEM'
    },
    {
      key: 'JUPITER_API_KEY',
      label: 'Jupiter (Solana)',
      description: 'Jupiter swap aggregator — powers the Solana Trader.',
      icon: Zap,
      value: '',
      required: false,
      category: 'INTEGRATION'
    },
    {
      key: 'SOLANA_BURNER_KEY',
      label: 'Burner Wallet (Solana)',
      description: 'Private key for the autonomous trading bot on VPS.',
      icon: Key,
      value: '',
      required: false,
      category: 'INTEGRATION'
    }
  ]);

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  useEffect(() => {
    const savedModel = userScopeService.scopedGet('preferred_model');
    if (savedModel) setActiveModel(savedModel);

    const custom = JSON.parse(userScopeService.scopedGet('custom_secrets') || '[]');

    setSecrets(prev => {
      const base = prev.map(s => {
        if (s.isManaged) return s;
        // Retain default values if local storage is empty for pre-fills
        const savedVal = userScopeService.scopedGet(`env_${s.key}`);
        return { ...s, value: savedVal !== null ? savedVal : s.value };
      });
      const customMapped = custom.map((c: any) => ({
        ...c,
        icon: c.category === 'AI' ? Cpu : Globe,
        value: userScopeService.scopedGet(`env_${c.key}`) || ''
      }));
      return [...base, ...customMapped];
    });

    const unsubscribeBilling = billingService.subscribe(setUsageStats);

    // Restore secrets from VPS if missing locally
    (async () => {
      try {
        const vpsSecrets = await api.config.get('secrets');
        if (vpsSecrets && typeof vpsSecrets === 'object') {
          setSecrets(prev => prev.map(s => {
            if (!s.value && vpsSecrets[s.key]) {
              userScopeService.scopedSet(`env_${s.key}`, vpsSecrets[s.key]);
              return { ...s, value: vpsSecrets[s.key] };
            }
            return s;
          }));
        }
      } catch { /* offline */ }
    })();

    return () => unsubscribeBilling();
  }, []);

  const handleUpdate = (key: string, newValue: string) => {
    setSecrets(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
    userScopeService.scopedSet(`env_${key}`, newValue);
    // Sync all secrets to VPS config table
    syncSecretsToVPS(key, newValue);
  };

  // Debounced sync of all secrets to VPS
  const syncSecretsToVPS = (changedKey: string, changedValue: string) => {
    try {
      const allSecrets: Record<string, string> = {};
      secrets.forEach(s => {
        allSecrets[s.key] = s.key === changedKey ? changedValue : s.value;
      });
      api.config.set('secrets', allSecrets).catch(() => { });
    } catch { /* offline */ }
  };

  const handleAddSecret = () => {
    if (!newSecret.key || !newSecret.label) return;
    const secretToAdd: SecretItem = { ...newSecret, icon: newSecret.category === 'AI' ? Cpu : Globe, value: '', required: false };
    const custom = JSON.parse(userScopeService.scopedGet('custom_secrets') || '[]');
    userScopeService.scopedSet('custom_secrets', JSON.stringify([...custom, { key: newSecret.key, label: newSecret.label, description: newSecret.description, category: newSecret.category }]));
    setSecrets(prev => [...prev, secretToAdd]);
    setShowAddModal(false);
    setNewSecret({ key: '', label: '', description: '', category: 'INTEGRATION' });
  };

  const toggleVisibility = (key: string) => {
    setVisibleKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const generateEnvFile = () => {
    const header = `# ClawKeep - Environment Config\n# Generated: ${new Date().toISOString()}\n\n`;
    const modelConfig = `# Model Context\nCLAW_ACTIVE_MODEL=${activeModel}\n\n`;
    const secretsBlock = secrets.map(s => {
      const comment = `# ${s.label}: ${s.description}`;
      return `${comment}\n${s.key}=${s.value || ''}`;
    }).join('\n\n');
    return header + modelConfig + secretsBlock;
  };

  const downloadEnvFile = () => {
    const content = generateEnvFile();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '.env';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderSecretCard = (secret: SecretItem) => {
    const isFilled = secret.value.length > 0;
    const isVisible = visibleKeys.has(secret.key);
    return (
      <div key={secret.key} className={`glass-panel p-6 rounded-[32px] flex flex-col lg:flex-row lg:items-center gap-6 group hover:border-white/20 transition-all ${secret.isManaged ? 'border-emerald-500/30 bg-emerald-500/5' : ''}`}>
        <div className="flex items-center gap-4 min-w-[220px] shrink-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-colors border
                    ${secret.isManaged ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isFilled ? 'bg-white/5 text-emerald-400 border-emerald-500/20' : 'bg-white/5 text-white/20 border-white/5'}`}>
            <secret.icon className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-white flex items-center gap-2 uppercase tracking-tight truncate">
              {secret.label}
              {secret.isManaged && <span className="text-[7px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black tracking-widest shrink-0">MANAGED</span>}
            </div>
            <div className="text-[9px] text-white/30 font-mono mt-0.5 truncate uppercase tracking-tighter">{secret.key}</div>
          </div>
        </div>
        <div className="flex-1 relative group/input">
          <input type={isVisible ? "text" : "password"} value={secret.value} readOnly={secret.isManaged} onChange={(e) => handleUpdate(secret.key, e.target.value)} className={`w-full bg-black/60 border rounded-2xl py-3.5 pl-5 pr-24 font-mono text-xs text-white focus:outline-none focus:ring-1 transition-all ${secret.isManaged ? 'border-emerald-500/10 cursor-default' : 'border-white/10 focus:border-cyan-500 shadow-inner'}`} placeholder={secret.isManaged ? "" : "Enter access key..."} />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button onClick={() => toggleVisibility(secret.key)} className="p-2 text-white/20 hover:text-white rounded-xl hover:bg-white/5 transition-all">{isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            <button onClick={() => copyToClipboard(secret.value, secret.key)} className="p-2 text-white/20 hover:text-cyan-400 rounded-xl hover:bg-white/5 transition-all">{copyFeedback === secret.key ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>
          </div>
        </div>
        <div className="lg:w-56 text-[10px] text-white/40 border-l border-white/5 pl-6 hidden lg:block font-mono leading-relaxed uppercase italic">{secret.description}</div>
      </div>
    );
  };

  return (
    <div className="p-10 h-full flex flex-col overflow-y-auto scrollbar-hide">
      <header className="mb-8 flex justify-between items-end shrink-0">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter drop-shadow-md">Vault Secrets</h1>
          <p className="text-white/50 text-sm font-mono tracking-widest uppercase">Secure Key Management & Neural Handshakes</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 active:scale-95"><Plus className="w-4 h-4" /> Register Integration</button>
          <button onClick={() => setShowEnvModal(true)} className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 hover:from-rose-400 hover:to-rose-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(244,63,94,0.3)] active:scale-95"><Zap className="w-4 h-4" /> Generate .env</button>
        </div>
      </header>

      {/* Neural Economy Dashboard */}
      <div className="mb-10 glass-panel p-10 rounded-[50px] border-rose-500/20 bg-rose-500/5 relative overflow-hidden shrink-0">
        <div className="absolute top-0 right-0 p-8 opacity-5"><BarChart3 className="w-40 h-40 text-rose-500" /></div>
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 border border-rose-500/20 shadow-glow"><DollarSign className="w-8 h-8" /></div>
          <div>
            <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Neural Economy</h3>
            <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest">Real-time API Usage & Estimated Expenditure</p>
          </div>
          <button onClick={() => billingService.reset()} className="ml-auto p-2 hover:bg-white/5 rounded-xl text-white/20 hover:text-rose-400 transition-all"><RefreshCcw className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative z-10">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Total Burn</span>
            <p className="text-4xl font-bold text-white tracking-tighter">${usageStats.totalCost.toFixed(4)}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Neural Density</span>
            <p className="text-4xl font-bold text-cyan-400 tracking-tighter">{(usageStats.totalTokens / 1000).toFixed(1)}k <span className="text-sm font-mono text-cyan-400/40">Tokens</span></p>
          </div>
          <div className="md:col-span-2 space-y-6">
            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/20">
              <span>Model Architecture Usage Distribution</span>
              <Activity className="w-3 h-3 text-rose-500/40 animate-pulse" />
            </div>
            <div className="space-y-4">
              {Object.entries(usageStats.byModel).map(([model, entry]) => {
                const data = entry as ModelUsage;
                const percentage = (data.cost / usageStats.totalCost) * 100 || 0;
                return (
                  <div key={model} className="space-y-2 group">
                    <div className="flex justify-between text-[10px] font-mono uppercase">
                      <span className="text-white/60 group-hover:text-rose-400 transition-colors">{model}</span>
                      <span className="text-white/40">${data.cost.toFixed(5)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                      <div className={`h-full transition-all duration-1000 ${model.includes('pro') ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(usageStats.byModel).length === 0 && (
                <p className="text-[10px] text-white/20 font-mono italic">No telemetry recorded for this cycle.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-12">
        <div className="text-[9px] font-black text-white/20 px-2 uppercase tracking-[0.3em] mt-2 mb-2">Network Credentials</div>
        {secrets.filter(s => s.category === 'SYSTEM').map(renderSecretCard)}

        <div className="text-[9px] font-black text-white/20 px-2 uppercase tracking-[0.3em] mt-6 mb-2">Sentinel Uplink (Email)</div>
        {secrets.filter(s => s.category === 'COMMUNICATION').map(renderSecretCard)}

        <div className="text-[9px] font-black text-white/20 px-2 uppercase tracking-[0.3em] mt-6 mb-2">Neural Engine Keys</div>
        {secrets.filter(s => s.category === 'AI').map(renderSecretCard)}

        <div className="text-[9px] font-black text-white/20 px-2 uppercase tracking-[0.3em] mt-6 mb-2">Fleet Integrations</div>
        {secrets.filter(s => s.category === 'INTEGRATION').map(renderSecretCard)}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-[5500] flex items-center justify-center p-8 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="glass-panel border-white/20 rounded-[40px] max-w-lg w-full p-10 flex flex-col shadow-2xl relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 p-2 text-white/20 hover:text-white transition-colors"><X className="w-6 h-6" /></button>
            <h3 className="text-2xl font-bold text-white mb-2 uppercase tracking-tight">Register Integration</h3>
            <p className="text-white/40 text-xs font-mono uppercase tracking-widest mb-8">Extend your shell's capabilities with custom APIs</p>
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Integration Name (e.g. Anthropic)</label>
                <input type="text" value={newSecret.label} onChange={(e) => setNewSecret({ ...newSecret, label: e.target.value })} placeholder="Claude AI" className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-cyan-500 shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">ENV_KEY (e.g. CLAUDE_API_KEY)</label>
                <input type="text" value={newSecret.key} onChange={(e) => setNewSecret({ ...newSecret, key: e.target.value.toUpperCase().replace(/\s/g, '_') })} placeholder="CLAUDE_API_KEY" className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Capability Category</label>
                <select value={newSecret.category} onChange={(e) => setNewSecret({ ...newSecret, category: e.target.value as any })} className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer">
                  <option value="AI">AI / Neural Model</option>
                  <option value="INTEGRATION">Third Party API</option>
                  <option value="SYSTEM">System Link</option>
                  <option value="COMMUNICATION">Communication</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-white/30 uppercase tracking-[0.2em] mb-2">Operational Context</label>
                <textarea value={newSecret.description} onChange={(e) => setNewSecret({ ...newSecret, description: e.target.value })} placeholder="Used for advanced drafting and coding tasks..." className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white h-24 focus:outline-none focus:border-cyan-500 shadow-inner resize-none" />
              </div>
            </div>
            <button onClick={handleAddSecret} disabled={!newSecret.key || !newSecret.label} className="mt-10 w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all disabled:opacity-30 active:scale-95">Commit Registry entry</button>
          </div>
        </div>
      )}

      {showEnvModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-8 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className="glass-panel glass-panel-rose border-rose-500/20 rounded-[50px] max-w-3xl w-full shadow-[0_0_100px_rgba(244,63,94,0.15)] flex flex-col max-h-[85vh] overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-50"></div>
            <div className="p-8 border-b border-white/10 flex justify-between items-center bg-rose-500/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-glow"><Terminal className="w-6 h-6 text-rose-500" /></div>
                <div>
                  <h3 className="text-white font-black uppercase tracking-[0.2em] text-lg">Config Synthesis</h3>
                  <p className="text-[10px] text-rose-400 font-mono uppercase tracking-widest">Environment Definition v6.0</p>
                </div>
              </div>
              <button onClick={() => setShowEnvModal(false)} className="px-4 py-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white uppercase text-[10px] font-black tracking-widest border border-white/5">Abort</button>
            </div>
            <div className="p-10 bg-black/80 overflow-y-auto flex-1 font-mono text-[11px] text-emerald-400/90 leading-relaxed scrollbar-hide relative">
              <div className="absolute top-4 right-8 text-[8px] text-white/10 font-mono uppercase tracking-[0.3em] select-none">SHA-256 Verified</div>
              <pre className="whitespace-pre-wrap">{generateEnvFile()}</pre>
            </div>
            <div className="p-8 bg-white/5 border-t border-white/10 flex justify-between items-center">
              <div className="flex items-center gap-2 text-[9px] text-white/30 uppercase font-black tracking-widest"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />Ready for Deployment</div>
              <div className="flex gap-4">
                <button onClick={downloadEnvFile} className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/10"><Download className="w-4 h-4" /> Download .env</button>
                <button onClick={() => copyToClipboard(generateEnvFile(), 'ENV')} className="px-10 py-3 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-[0_10px_20px_rgba(244,63,94,0.3)] hover:bg-rose-500 transition-all flex items-center gap-2 active:scale-95">{copyFeedback === 'ENV' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}{copyFeedback === 'ENV' ? 'Copied' : 'Copy to Buffer'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SecretsView;
