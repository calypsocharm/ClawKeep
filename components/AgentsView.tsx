
import React, { useState } from 'react';
import { ClawAgent, AgentStatus, PersonaType } from '../types';
import { Search, Plus, Trash2, Target, Zap, Bot, Swords, ChevronDown, Pencil, Check, X, MessageCircle, TrendingUp, BarChart3, Newspaper, DollarSign, ArrowLeftRight, Eye, Shield, Cpu } from 'lucide-react';
import AgentChatPanel from './AgentChatPanel';
import { OPENROUTER_MODELS } from '../services/openRouterService';

interface AgentsViewProps {
    agents: ClawAgent[];
    persona?: PersonaType;
    onAddAgent: (agent: ClawAgent) => void;
    onUpdateAgent: (agent: ClawAgent) => void;
    onDeleteAgent: (id: string) => void;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string; border: string; glow?: boolean }> = {
    'IDLE': { label: 'Standby', color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' },
    'ON_MISSION': { label: 'On Mission', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: true },
    'COMPLETE': { label: 'Complete', color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    'RETIRED': { label: 'Retired', color: 'text-white/30', bg: 'bg-white/5', border: 'border-white/10' },
};

const COLOR_ACCENTS: Record<string, string> = {
    rose: 'from-rose-600/20 to-rose-900/10 border-rose-500/20',
    emerald: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/20',
    amber: 'from-amber-600/20 to-amber-900/10 border-amber-500/20',
    cyan: 'from-cyan-600/20 to-cyan-900/10 border-cyan-500/20',
    indigo: 'from-indigo-600/20 to-indigo-900/10 border-indigo-500/20',
    violet: 'from-violet-600/20 to-violet-900/10 border-violet-500/20',
    pink: 'from-pink-600/20 to-pink-900/10 border-pink-500/20',
    slate: 'from-slate-600/20 to-slate-900/10 border-slate-500/20',
};

const MASCOTS = ['🦀', '🦐', '🐙', '🦑', '🐚', '🦞', '🐠', '🐡', '🦈', '🐋', '🐢', '🦭'];
const COLORS = ['rose', 'emerald', 'amber', 'cyan', 'indigo', 'violet', 'pink', 'slate'];

// ---- TRADING BOT PRESETS ----
interface BotPreset {
    name: string;
    mascot: string;
    quest: string;
    specialty: string;
    color: string;
    icon: React.ElementType;
    description: string;
}

const TRADING_BOT_PRESETS: BotPreset[] = [
    {
        name: 'Doge',
        mascot: '🐕',
        quest: 'Monitor 1-minute candles for rapid entry/exit signals on high-volume pairs. Much speed, very profit.',
        specialty: 'Scalping',
        color: 'amber',
        icon: Zap,
        description: 'Such fast. Very scalp. Wow trades.'
    },
    {
        name: 'Neko',
        mascot: '🐱',
        quest: 'Identify swing trade setups using support/resistance, RSI, and MACD divergence. Pounces on reversals.',
        specialty: 'Swing Trading',
        color: 'cyan',
        icon: TrendingUp,
        description: 'Patient kitty that pounces on perfect swing setups.'
    },
    {
        name: 'Owlbert',
        mascot: '🦉',
        quest: 'Scrape financial news feeds, filter for market-moving events, and hoot alerts immediately.',
        specialty: 'News & Sentiment',
        color: 'rose',
        icon: Newspaper,
        description: 'Wise night owl scanning every headline for alpha.'
    },
    {
        name: 'Tanuki',
        mascot: '🦝',
        quest: 'Execute dollar-cost averaging strategy across selected assets on schedule. Sneaky accumulation.',
        specialty: 'DCA Strategy',
        color: 'emerald',
        icon: DollarSign,
        description: 'Sneaky raccoon dog quietly stacking coins on the regular.'
    },
    {
        name: 'Fennec',
        mascot: '🦊',
        quest: 'Scan multiple exchanges for price discrepancies and calculate arbitrage spreads with keen ears.',
        specialty: 'Arbitrage',
        color: 'violet',
        icon: ArrowLeftRight,
        description: 'Big-eared fox that hears every price gap across exchanges.'
    },
    {
        name: 'Whaley',
        mascot: '🐋',
        quest: 'Track large wallet movements, unusual volume spikes, and institutional flow. Whale songs detected.',
        specialty: 'On-Chain Analytics',
        color: 'indigo',
        icon: Eye,
        description: 'Friendly whale that spots big fins moving the ocean.'
    },
    {
        name: 'Hedgie',
        mascot: '🦔',
        quest: 'Monitor portfolio exposure, enforce stop-losses, and calculate position sizing. Curls up to protect gains.',
        specialty: 'Risk Management',
        color: 'slate',
        icon: Shield,
        description: 'Spiky hedgehog that curls up tight to protect your portfolio.'
    },
    {
        name: 'Panda',
        mascot: '🐼',
        quest: 'Generate technical analysis reports with chart patterns, indicators, and price targets. Zen analysis.',
        specialty: 'Technical Analysis',
        color: 'pink',
        icon: BarChart3,
        description: 'Chill panda munching data bamboo into crispy TA reports.'
    }
];

const AgentsView: React.FC<AgentsViewProps> = ({ agents, persona = 'assistant', onAddAgent, onUpdateAgent, onDeleteAgent }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editQuest, setEditQuest] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [chattingAgentId, setChattingAgentId] = useState<string | null>(null);
    const [showPresets, setShowPresets] = useState(false);

    const isTrader = persona === 'trader';
    const chattingAgent = chattingAgentId ? agents.find(a => a.id === chattingAgentId) || null : null;

    const filteredAgents = agents.filter(a =>
        a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.quest.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.specialty.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const activeCount = agents.filter(a => a.status === 'ON_MISSION').length;
    const idleCount = agents.filter(a => a.status === 'IDLE').length;

    const handleDeploy = (preset?: BotPreset) => {
        const mascot = preset?.mascot || MASCOTS[Math.floor(Math.random() * MASCOTS.length)];
        const color = preset?.color || COLORS[Math.floor(Math.random() * COLORS.length)];
        const newAgent: ClawAgent = {
            id: 'agent_' + Date.now(),
            name: preset?.name || 'New Agent',
            mascot,
            quest: preset?.quest || 'Awaiting orders from Claw...',
            status: 'IDLE',
            specialty: preset?.specialty || 'General',
            color,
            createdAt: new Date().toISOString(),
        };
        onAddAgent(newAgent);
        setShowPresets(false);
    };

    const startEditQuest = (agent: ClawAgent) => {
        setEditingId(agent.id);
        setEditQuest(agent.quest);
    };

    const saveQuest = (agent: ClawAgent) => {
        onUpdateAgent({ ...agent, quest: editQuest });
        setEditingId(null);
    };

    const cycleStatus = (agent: ClawAgent) => {
        const order: AgentStatus[] = ['IDLE', 'ON_MISSION', 'COMPLETE', 'RETIRED'];
        const next = order[(order.indexOf(agent.status) + 1) % order.length];
        onUpdateAgent({ ...agent, status: next });
    };

    // Trader status labels
    const traderStatusLabel = (status: AgentStatus) => {
        switch (status) {
            case 'IDLE': return 'Idle';
            case 'ON_MISSION': return 'Running';
            case 'COMPLETE': return 'Stopped';
            case 'RETIRED': return 'Archived';
        }
    };

    return (
        <div className="p-10 h-full flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center mb-8 shrink-0">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight drop-shadow-md flex items-center gap-4">
                        <span>{isTrader ? 'Trading Bots' : 'Agent Squad'}</span>
                        <span className="text-2xl opacity-60">{isTrader ? '🤖' : '🦞'}</span>
                    </h1>
                    <p className="text-white/50 text-lg font-light tracking-wide">
                        {isTrader
                            ? `${agents.length} bots configured, ${activeCount} running, ${idleCount} idle`
                            : `Claw's autonomous operatives — ${agents.length} deployed, ${activeCount} active, ${idleCount} on standby`
                        }
                    </p>
                </div>
                <div className="flex gap-3">
                    {isTrader && (
                        <button
                            className="bg-gradient-to-r from-emerald-600/80 to-emerald-800/80 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 border border-emerald-500/30"
                            onClick={() => setShowPresets(!showPresets)}
                        >
                            <Bot className="w-4 h-4" />
                            Bot Templates
                        </button>
                    )}
                    <button
                        className={`text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all font-bold text-xs uppercase tracking-widest shadow-lg hover:scale-105 ${isTrader
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-700 shadow-emerald-500/20'
                            : 'bg-gradient-to-r from-rose-500 to-rose-700 shadow-rose-500/20'
                            }`}
                        onClick={() => handleDeploy()}
                    >
                        <Plus className="w-4 h-4" />
                        {isTrader ? 'Custom Bot' : 'Deploy Agent'}
                    </button>
                </div>
            </header>

            {/* Trading Bot Preset Templates - Only for Trader persona */}
            {isTrader && showPresets && (
                <div className="mb-8 shrink-0 animate-in slide-in-from-top-4 duration-300">
                    <div className="glass-panel p-6 rounded-[32px] border-emerald-500/10">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                                    <Bot className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Bot Templates</h3>
                                    <p className="text-[9px] text-white/30 font-mono uppercase tracking-widest">Deploy a pre-configured trading bot</p>
                                </div>
                            </div>
                            <button onClick={() => setShowPresets(false)} className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-xl transition-all">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {TRADING_BOT_PRESETS.map((preset, i) => {
                                const alreadyDeployed = agents.some(a => a.name === preset.name);
                                return (
                                    <button
                                        key={i}
                                        onClick={() => !alreadyDeployed && handleDeploy(preset)}
                                        disabled={alreadyDeployed}
                                        className={`p-4 rounded-2xl border text-left transition-all group ${alreadyDeployed
                                            ? 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                                            : 'bg-white/[0.03] border-white/10 hover:border-emerald-500/30 hover:bg-emerald-500/5 cursor-pointer hover:scale-[1.02]'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-2xl">{preset.mascot}</span>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-xs font-bold text-white uppercase tracking-wide truncate">{preset.name}</h4>
                                                <span className="text-[8px] text-white/30 font-mono uppercase tracking-widest">{preset.specialty}</span>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-white/40 leading-relaxed font-mono">
                                            {preset.description}
                                        </p>
                                        {alreadyDeployed && (
                                            <div className="mt-2 text-[8px] text-emerald-400/60 font-bold uppercase tracking-widest">✓ Already Deployed</div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Search */}
            <div className="mb-8 flex gap-4 shrink-0">
                <div className="relative max-w-md group flex-1">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 transition-colors ${isTrader ? 'group-focus-within:text-emerald-400' : 'group-focus-within:text-rose-400'}`} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={isTrader ? 'Search bots by name, strategy, or type...' : 'Search agents by name, quest, or specialty...'}
                        className={`w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none transition-all backdrop-blur-md ${isTrader ? 'focus:border-emerald-500/50' : 'focus:border-rose-500/50'}`}
                    />
                </div>
            </div>

            {/* Gallery Grid */}
            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide pb-20">
                {filteredAgents.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-white/20 border-2 border-dashed border-white/10 rounded-[40px] bg-white/5">
                        <Bot className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-[10px] uppercase tracking-[0.3em] font-black">
                            {isTrader ? 'No Bots Deployed' : 'No Agents Deployed'}
                        </p>
                        <p className="text-[9px] text-white/20 mt-2 font-mono">
                            {isTrader ? 'Click "Bot Templates" to deploy a pre-built trading bot' : 'Ask Claw to create one or click Deploy Agent'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredAgents.map(agent => {
                            const statusCfg = STATUS_CONFIG[agent.status];
                            const accent = COLOR_ACCENTS[agent.color] || COLOR_ACCENTS.slate;

                            return (
                                <div
                                    key={agent.id}
                                    className={`glass-panel rounded-[32px] flex flex-col relative overflow-hidden transition-all duration-500 bg-gradient-to-br ${accent} group hover:scale-[1.02] ${agent.status === 'ON_MISSION' ? 'shadow-glow-lobster' : ''
                                        } ${agent.status === 'RETIRED' ? 'opacity-60' : ''}`}
                                >
                                    {/* Mascot BG Watermark */}
                                    <div className="absolute top-4 right-4 text-[80px] opacity-[0.06] pointer-events-none leading-none select-none">
                                        {agent.mascot}
                                    </div>

                                    {/* Card Content */}
                                    <div className="p-7 flex flex-col gap-4 relative z-10 flex-1">
                                        {/* Top Row: Mascot + Name + Status */}
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border shadow-lg transition-all ${agent.status === 'ON_MISSION'
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 animate-pulse'
                                                    : agent.status === 'RETIRED'
                                                        ? 'bg-white/5 border-white/10'
                                                        : 'bg-white/5 border-white/10'
                                                    }`}>
                                                    {agent.mascot}
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">{agent.name}</h3>
                                                    <span className="text-[10px] text-white/40 font-mono uppercase tracking-widest">{agent.specialty}</span>
                                                    {agent.modelId && (
                                                        <span className="text-[7px] text-cyan-400/60 font-mono uppercase tracking-widest flex items-center gap-1 mt-0.5">
                                                            <Cpu className="w-2.5 h-2.5" />
                                                            {OPENROUTER_MODELS.find(m => m.id === agent.modelId)?.name || agent.modelId.split('/').pop()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => cycleStatus(agent)}
                                                className={`px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest border transition-all hover:scale-105 ${statusCfg.color} ${statusCfg.bg} ${statusCfg.border}`}
                                            >
                                                {isTrader ? traderStatusLabel(agent.status) : statusCfg.label}
                                            </button>
                                        </div>

                                        {/* Quest / Strategy */}
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Target className="w-3 h-3 text-white/30" />
                                                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">
                                                    {isTrader ? 'Strategy' : 'Current Quest'}
                                                </span>
                                            </div>
                                            {editingId === agent.id ? (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={editQuest}
                                                        onChange={(e) => setEditQuest(e.target.value)}
                                                        className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-rose-500/50"
                                                        autoFocus
                                                        onKeyDown={(e) => { if (e.key === 'Enter') saveQuest(agent); if (e.key === 'Escape') setEditingId(null); }}
                                                    />
                                                    <button onClick={() => saveQuest(agent)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"><Check className="w-4 h-4" /></button>
                                                    <button onClick={() => setEditingId(null)} className="p-2 text-white/30 hover:bg-white/5 rounded-lg"><X className="w-4 h-4" /></button>
                                                </div>
                                            ) : (
                                                <p
                                                    className="text-sm text-white/70 leading-relaxed font-mono italic cursor-pointer hover:text-white/90 transition-colors group/quest"
                                                    onClick={() => startEditQuest(agent)}
                                                >
                                                    "{agent.quest}"
                                                    <Pencil className="w-3 h-3 text-white/20 inline-block ml-2 opacity-0 group-hover/quest:opacity-100 transition-opacity" />
                                                </p>
                                            )}
                                        </div>

                                        {/* Last Directive */}
                                        {agent.lastDirective && (
                                            <div className="bg-white/5 rounded-xl px-3 py-2 border border-white/5">
                                                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">{isTrader ? 'Last Signal: ' : 'Last Order: '}</span>
                                                <span className="text-[10px] text-white/50 font-mono">{agent.lastDirective}</span>
                                            </div>
                                        )}

                                        {/* Model Selector */}
                                        <div className="flex items-center gap-2 mt-1">
                                            <Cpu className="w-3 h-3 text-white/20" />
                                            <select
                                                value={agent.modelId || ''}
                                                onChange={(e) => onUpdateAgent({ ...agent, modelId: e.target.value || undefined })}
                                                className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-[9px] text-white/60 font-mono uppercase tracking-wider focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                                            >
                                                <option value="">Gemini Flash (Default)</option>
                                                {OPENROUTER_MODELS.map(m => (
                                                    <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Footer */}
                                        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                                            <span className="text-[9px] text-white/20 font-mono">
                                                {isTrader ? 'Created' : 'Deployed'} {new Date(agent.createdAt).toLocaleDateString()}
                                            </span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setChattingAgentId(agent.id)}
                                                    className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                                    title={isTrader ? `Configure ${agent.name}` : `Chat with ${agent.name}`}
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => startEditQuest(agent)}
                                                    className="p-2 text-white/20 hover:text-white hover:bg-white/5 rounded-xl transition-all"
                                                    title={isTrader ? 'Edit Strategy' : 'Edit Quest'}
                                                >
                                                    <Swords className="w-4 h-4" />
                                                </button>
                                                {deleteConfirmId === agent.id ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={() => { onDeleteAgent(agent.id); setDeleteConfirmId(null); }}
                                                            className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest"
                                                        >
                                                            Confirm
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirmId(null)}
                                                            className="px-3 py-1.5 bg-white/5 text-white/40 rounded-lg text-[8px] font-black uppercase tracking-widest"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setDeleteConfirmId(agent.id)}
                                                        className="p-2 text-white/20 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                                                        title={isTrader ? 'Remove Bot' : 'Decommission Agent'}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Agent Chat Panel */}
            {chattingAgent && (
                <AgentChatPanel
                    agent={chattingAgent}
                    onClose={() => setChattingAgentId(null)}
                    onUpdateAgent={onUpdateAgent}
                />
            )}
        </div>
    );
};

export default AgentsView;
