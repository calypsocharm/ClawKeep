
import React, { useState, useEffect } from 'react';
import {
    Shield, Server, Key, Save, AlertTriangle, CheckCircle2,
    Lock, Terminal, Cpu, Play, ArrowRight, Brain, CreditCard,
    ExternalLink, RefreshCw, Plus, X, Sparkles, Palette,
    History, MessageSquare, Trash2, Moon, Sun, Mail, Globe, Zap,
    Clock, ToggleLeft, ToggleRight, Bot, TrendingUp, Building2,
    ChevronDown, ChevronRight, Search, Eye
} from 'lucide-react';
import { gatewayService } from '../services/gatewayService';
import { guardrailService, GuardrailSettings } from '../services/guardrailService';
import { viewConfigService } from '../services/viewConfigService';
import { OPENROUTER_MODELS, OPENAI_MODELS, openRouterService } from '../services/openRouterService';
import { PERSONA_PRESETS } from '../personas';
import { brainService } from '../services/brainService';
import { hudService, HUDConfig } from '../services/hudService';
import { GatewayStatus, UserIdentity, AISoul, SoulMemory } from '../types';
import { api } from '../services/apiService';
import { userScopeService } from '../services/userScopeService';

// ===== Genie Layout Inspector Component =====
const GenieLayoutInspector: React.FC = () => {
    const allConfigs = viewConfigService.getAllConfigs();
    const configEntries = Object.entries(allConfigs);
    const customViews = viewConfigService.getCustomViews();
    const [expandedView, setExpandedView] = useState<string | null>(null);

    return (
        <div className="lg:col-span-2 glass-panel p-8 rounded-[40px] border border-purple-500/30 relative">
            <div className="absolute top-0 right-0 p-8 opacity-[0.08]"><Sparkles className="w-32 h-32 text-purple-400" /></div>
            <div className="flex items-center gap-4 mb-6">
                <div className="p-3 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30">
                    <Sparkles className="w-6 h-6" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-white uppercase tracking-tight">🧞 Genie Layout Inspector</h3>
                    <p className="text-white/60 text-sm font-medium mt-0.5">See exactly what Claw stored — debug layout issues here</p>
                </div>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-8 mb-6">
                <div className="text-center">
                    <div className="text-3xl font-black text-white">{configEntries.length}</div>
                    <div className="text-xs text-white/60 font-bold uppercase tracking-wider mt-1">Configured Views</div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-black text-white">{customViews.length}</div>
                    <div className="text-xs text-white/60 font-bold uppercase tracking-wider mt-1">Custom Pages</div>
                </div>
                <div className="text-center">
                    <div className="text-3xl font-black text-purple-400">
                        {configEntries.reduce((sum, [, cfg]) => sum + (cfg.widgets?.length || 0), 0)}
                    </div>
                    <div className="text-xs text-white/60 font-bold uppercase tracking-wider mt-1">Total Widgets</div>
                </div>
            </div>

            {/* Per-View Breakdown */}
            {configEntries.length === 0 ? (
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                    <p className="text-white/30 text-sm font-mono">No Claw layout configs stored. Ask Claw to customize a view!</p>
                </div>
            ) : (
                <div className="space-y-2 mb-6">
                    {configEntries.map(([viewId, cfg]) => {
                        const isExpanded = expandedView === viewId;
                        const widgetCount = (cfg.widgets || []).length;
                        const visibleCount = (cfg.widgets || []).filter((w: any) => w.visible !== false).length;
                        const isEmpty = widgetCount === 0 && !cfg.title;

                        return (
                            <div key={viewId} className={`rounded-2xl border transition-all ${isEmpty ? 'bg-amber-500/5 border-amber-500/15' : 'bg-white/[0.03] border-white/10'}`}>
                                {/* Row header */}
                                <button
                                    onClick={() => setExpandedView(isExpanded ? null : viewId)}
                                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-all rounded-2xl"
                                >
                                    {isExpanded
                                        ? <ChevronDown className="w-4 h-4 text-purple-400 shrink-0" />
                                        : <ChevronRight className="w-4 h-4 text-white/30 shrink-0" />
                                    }
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3">
                                            {cfg.icon && <span className="text-lg">{cfg.icon}</span>}
                                            <span className="text-sm font-bold text-white truncate">{cfg.title || viewId}</span>
                                            {cfg.isCustomView && (
                                                <span className="text-[8px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Custom</span>
                                            )}
                                            {isEmpty && (
                                                <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Empty</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 mt-1">
                                            <span className="text-[9px] text-white/30 font-mono">{cfg.layout || 'single'}</span>
                                            <span className="text-[9px] text-white/30 font-mono">{widgetCount} widgets ({visibleCount} visible)</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Reset "${viewId}" to defaults?`)) {
                                                viewConfigService.resetConfig(viewId);
                                                window.location.reload();
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all shrink-0"
                                    >
                                        Reset
                                    </button>
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-0 border-t border-white/5 mt-0">
                                        <pre className="bg-black/30 border border-white/5 rounded-xl p-4 text-[10px] text-white/50 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all mt-3 max-h-64 overflow-y-auto scrollbar-hide">
                                            {JSON.stringify(cfg, null, 2)}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Reset All */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => {
                        if (confirm('Reset ALL Claw view customizations? This removes custom views and restores all pages to their defaults.')) {
                            userScopeService.scopedRemove('view_configs');
                            window.location.reload();
                        }
                    }}
                    className="px-6 py-3.5 bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/50 rounded-2xl text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 shadow-lg shadow-purple-500/20"
                >
                    <RefreshCw className="w-4 h-4" /> Reset All Genie Configs
                </button>
                <p className="text-[10px] text-white/30 font-mono">If Claw's layout changes aren't working, check each view — empty configs mean Claw tried CSS (unsupported) instead of widgets.</p>
            </div>
        </div>
    );
};

// ===== Password Change Component =====
const PasswordChangeForm: React.FC = () => {
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [saving, setSaving] = useState(false);

    const handleChange = async () => {
        if (newPw.length < 6) return setStatus({ type: 'error', msg: 'New password must be 6+ characters' });
        if (newPw !== confirmPw) return setStatus({ type: 'error', msg: 'Passwords do not match' });
        setSaving(true);
        setStatus(null);
        try {
            const res = await fetch(`${window.location.origin}/api/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api.getToken()}` },
                body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            setStatus({ type: 'success', msg: 'Password changed successfully!' });
            setCurrentPw(''); setNewPw(''); setConfirmPw('');
            // Update stored password
            localStorage.setItem('claw_user_password', newPw);
        } catch (e: any) {
            setStatus({ type: 'error', msg: e.message });
        } finally { setSaving(false); }
    };

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="text-[8px] text-white/40 uppercase font-black block mb-1">Current Password</label>
                    <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/50 focus:outline-none" />
                </div>
                <div>
                    <label className="text-[8px] text-white/40 uppercase font-black block mb-1">New Password</label>
                    <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/50 focus:outline-none" />
                </div>
                <div>
                    <label className="text-[8px] text-white/40 uppercase font-black block mb-1">Confirm New</label>
                    <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-amber-500/50 focus:outline-none" />
                </div>
            </div>
            <div className="flex items-center gap-3">
                <button onClick={handleChange} disabled={saving || !currentPw || !newPw}
                    className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30">
                    {saving ? 'Saving...' : 'Change Password'}
                </button>
                {status && (
                    <span className={`text-[10px] font-bold ${status.type === 'success' ? 'text-green-400' : 'text-rose-400'}`}>
                        {status.type === 'success' ? '✅' : '❌'} {status.msg}
                    </span>
                )}
            </div>
        </div>
    );
};

// ===== Admin User Panel Component =====
const AdminUserPanel: React.FC = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadUsers = async () => {
        try {
            const data = await api.admin.listUsers();
            setUsers(data);
        } catch (e) { console.warn('Failed to load users:', e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadUsers(); }, []);

    const handleRoleChange = async (id: string, newRole: 'admin' | 'user') => {
        await api.admin.changeRole(id, newRole);
        loadUsers();
    };

    const handleDelete = async (id: string, email: string) => {
        if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
        await api.admin.deleteUser(id);
        loadUsers();
    };

    if (loading) return <div className="text-white/40 text-xs">Loading users...</div>;

    return (
        <div className="space-y-2">
            <div className="text-[9px] text-white/40 uppercase font-black mb-2">Registered Users ({users.length})</div>
            <div className="space-y-1">
                {users.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-rose-500/20 text-rose-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>{u.role}</span>
                            <span className="text-xs text-white font-mono">{u.email}</span>
                            <span className="text-[10px] text-white/30">{u.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleRoleChange(u.id, u.role === 'admin' ? 'user' : 'admin')}
                                className="text-[8px] font-black uppercase px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all">
                                {u.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button onClick={() => handleDelete(u.id, u.email)}
                                className="text-[8px] font-black uppercase px-2 py-1 rounded bg-rose-900/20 hover:bg-rose-600 text-rose-400 hover:text-white transition-all">
                                Delete
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SettingsView: React.FC = () => {
    const [host, setHost] = useState('ws://127.0.0.1:8080');
    const [brainSpec, setBrainSpec] = useState(brainService.getSpec());
    const [brainSaved, setBrainSaved] = useState(false);
    const [hudPersona, setHudPersona] = useState('business');
    const [hudConfig, setHudConfig] = useState<HUDConfig>(hudService.getConfig('business'));
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [identity, setIdentity] = useState<UserIdentity | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    const [preferredModel, setPreferredModel] = useState<string>(() => {
        return userScopeService.scopedGet('preferred_model') || 'DYNAMIC';
    });

    const [availableModels, setAvailableModels] = useState<string[]>(() => {
        const saved = userScopeService.scopedGet('available_models');
        const geminiDefaults = ['DYNAMIC', 'gemini-3-pro', 'gemini-3-flash'];
        const orModels = OPENROUTER_MODELS.map(m => m.id);
        const oaiModels = OPENAI_MODELS.map(m => m.id);
        const models = saved ? JSON.parse(saved) : [...geminiDefaults, ...oaiModels, ...orModels];
        // Migration: remove deprecated models
        const cleaned = models.filter((m: string) => m !== 'gemini-2.5-flash-lite-latest');
        if (cleaned.length !== models.length) {
            userScopeService.scopedSet('available_models', JSON.stringify(cleaned));
        }
        // If preferred model was the deprecated one, reset to DYNAMIC
        const pref = userScopeService.scopedGet('preferred_model');
        if (pref === 'gemini-2.5-flash-lite-latest') {
            userScopeService.scopedSet('preferred_model', 'DYNAMIC');
        }
        return cleaned;
    });

    const [newModelName, setNewModelName] = useState('');
    const [showAddModel, setShowAddModel] = useState(false);
    const [selectedSoulDetail, setSelectedSoulDetail] = useState<AISoul | null>(null);

    // --- Guardrails State ---
    const [guardrails, setGuardrails] = useState<GuardrailSettings>(guardrailService.getSettings());
    const isAwake = guardrailService.isAwake();

    useEffect(() => {
        const unsub = guardrailService.subscribe(setGuardrails);
        return unsub;
    }, []);

    // Check admin role on mount
    useEffect(() => {
        const checkAdmin = async () => {
            const cur = api.getCurrentUser();
            if (cur?.role === 'admin') { setIsAdmin(true); return; }
            // If no in-memory user, validate session from token
            try {
                const session = await api.validateSession();
                if (session?.user?.role === 'admin') setIsAdmin(true);
            } catch { /* not logged in or server offline */ }
        };
        checkAdmin();
    }, []);

    const [status, setStatus] = useState<GatewayStatus>('DISCONNECTED');
    const [isSaved, setIsSaved] = useState(false);
    const [hasUserKey, setHasUserKey] = useState(false);

    useEffect(() => {
        const savedHost = localStorage.getItem('claw_gateway_host');
        const savedEmail = localStorage.getItem('claw_user_email');
        const savedPassword = localStorage.getItem('claw_user_password');
        if (savedHost) setHost(savedHost);
        if (savedEmail) setEmail(savedEmail);
        if (savedPassword) setPassword(savedPassword);

        const checkKey = async () => {
            const aiStudio = (window as any).aistudio;
            if (aiStudio) {
                const hasKey = await aiStudio.hasSelectedApiKey();
                setHasUserKey(hasKey);
            }
        };
        checkKey();

        const unsubscribeStatus = gatewayService.subscribe(setStatus);
        const unsubscribeIdentity = gatewayService.subscribeIdentity(setIdentity);
        return () => {
            unsubscribeStatus();
            unsubscribeIdentity();
        };
    }, []);

    const handleSave = () => {
        gatewayService.updateConfig(host, password);
        localStorage.setItem('claw_user_email', email);
        userScopeService.scopedSet('preferred_model', preferredModel);
        userScopeService.scopedSet('available_models', JSON.stringify(availableModels));
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleAddModel = () => {
        if (!newModelName || availableModels.includes(newModelName)) return;
        const updated = [...availableModels, newModelName];
        setAvailableModels(updated);
        setPreferredModel(newModelName);
        userScopeService.scopedSet('preferred_model', newModelName);
        userScopeService.scopedSet('available_models', JSON.stringify(updated));
        setNewModelName('');
        setShowAddModel(false);
    };

    const handleSoulChange = (soul: AISoul) => {
        gatewayService.updateSoul(soul);
        // Also sync persona colors so soul change = persona change
        const preset = PERSONA_PRESETS.find(p => p.id === soul);
        if (preset) {
            const saved = userScopeService.scopedGet('shell_config');
            if (saved) {
                const config = JSON.parse(saved);
                config.persona = preset.id;
                config.accentColor = preset.accentColor;
                config.surfaceColor = preset.surfaceColor;
                config.glowColor = preset.glowColor;
                config.visibleViews = preset.visibleViews;
                userScopeService.scopedSet('shell_config', JSON.stringify(config));
                // Apply CSS variables directly
                const root = document.documentElement;
                root.style.setProperty('--shell-accent', preset.accentColor);
                root.style.setProperty('--shell-surface', preset.surfaceColor);
                root.style.setProperty('--shell-glow', preset.glowColor);
                document.body.style.backgroundColor = `hsl(${preset.surfaceColor})`;
                // Trigger App.tsx to pick up the change
                window.dispatchEvent(new StorageEvent('storage', { key: 'shell_config' }));
            }
        }
    };

    const handleChangeApiKey = async () => {
        const aiStudio = (window as any).aistudio;
        if (aiStudio) {
            await aiStudio.openSelectKey();
            const hasKey = await aiStudio.hasSelectedApiKey();
            setHasUserKey(hasKey);
        }
    };

    const souls = [
        { id: 'claw' as AISoul, name: '🦞 Claw', desc: 'The original. Confident, witty, full-stack operator — browses, codes, automates, and does the crab walk.', icon: Sparkles, color: 'rose' },
        { id: 'trader' as AISoul, name: '🦈 Sharky', desc: 'Sharp, data-driven, market-aware — charts, indicators, risk analysis, and autonomous market sweeps.', icon: TrendingUp, color: 'emerald' },
        { id: 'business' as AISoul, name: '🦀 Boss Crab', desc: 'Professional, thorough — payroll, compliance, contracts, SOPs, and competitive strategy.', icon: Building2, color: 'rose' },
    ];

    return (
        <div className="p-10 h-full flex flex-col overflow-y-auto scrollbar-hide relative">
            <header className="mb-8 flex justify-between items-end shrink-0">
                <div>
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tighter drop-shadow-md">Settings</h1>
                    <p className="text-white/50 text-sm font-mono tracking-widest uppercase">System Core Configuration & Security</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={handleSave}
                        className="px-8 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-rose-500/20 transition-all transform hover:scale-105"
                    >
                        {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        Commit Settings
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-20">

                {/* ========== OPERATOR GUARDRAILS ========== */}
                <div className="lg:col-span-2 glass-panel p-10 rounded-[50px] border-amber-500/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Shield className="w-40 h-40 text-amber-500" /></div>
                    <div className="flex items-center gap-4 mb-8">
                        <div className={`p-3 rounded-2xl border shadow-glow ${isAwake ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                            }`}>
                            {isAwake ? <Sun className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Operator Guardrails</h3>
                            <p className="text-white/40 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isAwake ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                                {guardrailService.getStatusText()}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

                        {/* Sleep Schedule */}
                        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <Clock className="w-4 h-4 text-amber-400" />
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Sleep Schedule</h4>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold w-16">Wake</label>
                                    <select
                                        value={guardrails.sleepSchedule.awakeStart}
                                        onChange={e => guardrailService.updateSleepSchedule(Number(e.target.value), guardrails.sleepSchedule.awakeEnd)}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-3">
                                    <label className="text-[10px] text-white/40 uppercase tracking-widest font-bold w-16">Sleep</label>
                                    <select
                                        value={guardrails.sleepSchedule.awakeEnd}
                                        onChange={e => guardrailService.updateSleepSchedule(guardrails.sleepSchedule.awakeStart, Number(e.target.value))}
                                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-amber-500/50"
                                    >
                                        {Array.from({ length: 24 }, (_, i) => (
                                            <option key={i} value={i}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[9px] text-white/20 font-mono">Claw sleeps outside these hours</p>
                            </div>
                        </div>

                        {/* Manual Override */}
                        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                {isAwake ? <Sun className="w-4 h-4 text-emerald-400" /> : <Moon className="w-4 h-4 text-amber-400" />}
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Manual Override</h4>
                            </div>
                            <button
                                onClick={() => guardrailService.toggleSleepOverride(!guardrails.sleepOverride)}
                                className={`w-full py-4 rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${guardrails.sleepOverride
                                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                    : 'bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {guardrails.sleepOverride ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                {guardrails.sleepOverride ? 'Override: FORCE AWAKE' : 'Override: Follow Schedule'}
                            </button>
                            <p className="text-[9px] text-white/20 font-mono mt-3">
                                {guardrails.sleepOverride ? 'Claw stays awake regardless of schedule' : 'Claw follows the sleep schedule above'}
                            </p>
                        </div>

                        {/* Capability Toggles */}
                        <div className="p-6 bg-white/[0.03] border border-white/5 rounded-3xl">
                            <div className="flex items-center gap-3 mb-4">
                                <Shield className="w-4 h-4 text-rose-400" />
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Capabilities</h4>
                            </div>
                            <div className="space-y-3">
                                {/* Email Toggle */}
                                <button
                                    onClick={() => guardrailService.toggleEmail(!guardrails.emailEnabled)}
                                    className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-between px-4 transition-all ${guardrails.emailEnabled
                                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                                        }`}
                                >
                                    <span className="flex items-center gap-2"><Mail className="w-3 h-3" /> Email</span>
                                    <span>{guardrails.emailEnabled ? 'ON' : 'OFF'}</span>
                                </button>
                                {/* Internet Toggle — PROMINENT */}
                                <button
                                    onClick={() => guardrailService.toggleInternet(!guardrails.internetEnabled)}
                                    className={`w-full py-4 rounded-2xl text-sm font-bold flex items-center justify-between px-5 transition-all duration-300 ${guardrails.internetEnabled
                                        ? 'bg-emerald-500/15 border-2 border-emerald-500/40 text-emerald-300 shadow-lg shadow-emerald-500/10'
                                        : 'bg-rose-500/15 border-2 border-rose-500/40 text-rose-300 shadow-lg shadow-rose-500/10'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Globe className={`w-5 h-5 ${guardrails.internetEnabled ? 'text-emerald-400' : 'text-rose-400'}`} />
                                        <div className="text-left">
                                            <div className="tracking-wide uppercase">Internet Access</div>
                                            <div className={`text-[10px] font-medium mt-0.5 tracking-normal normal-case ${guardrails.internetEnabled ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
                                                {guardrails.internetEnabled ? 'Claw & agents can browse the web' : 'All web browsing is blocked'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${guardrails.internetEnabled
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-rose-500/20 text-rose-300'
                                        }`}>
                                        {guardrails.internetEnabled ? 'ON' : 'OFF'}
                                    </div>
                                </button>
                                {/* API in Sleep Toggle */}
                                <button
                                    onClick={() => guardrailService.toggleApiInSleep(!guardrails.apiInSleep)}
                                    className={`w-full py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-between px-4 transition-all ${guardrails.apiInSleep
                                        ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                        : 'bg-white/5 border border-white/10 text-white/30'
                                        }`}
                                >
                                    <span className="flex items-center gap-2"><Zap className="w-3 h-3" /> API During Sleep</span>
                                    <span>{guardrails.apiInSleep ? 'ON' : 'OFF'}</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Business Brain Editor */}
                <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border border-purple-500/20 relative">
                    <div className="flex items-center gap-3 mb-5">
                        <Brain className="w-5 h-5 text-purple-400" />
                        <h3 className="text-lg font-black text-white tracking-tight">Business Brain</h3>
                        <span className="text-[9px] text-purple-400/50 font-mono uppercase tracking-widest">MASTER SPEC</span>
                        <div className="ml-auto flex items-center gap-2">
                            {brainSaved && (
                                <span className="text-emerald-400 text-[10px] font-bold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Saved</span>
                            )}
                            <button
                                onClick={() => { brainService.resetSpec(); setBrainSpec(brainService.getSpec()); setBrainSaved(false); }}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white/30 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 transition-all"
                            >
                                Reset
                            </button>
                            <button
                                onClick={() => { brainService.updateSpec(brainSpec); setBrainSaved(true); setTimeout(() => setBrainSaved(false), 3000); }}
                                className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white bg-purple-600 hover:bg-purple-500 border border-purple-400/30 transition-all shadow-lg shadow-purple-500/20"
                            >
                                <Save className="w-3 h-3 inline mr-1" />Save Brain
                            </button>
                        </div>
                    </div>
                    <p className="text-white/30 text-xs mb-4">Claw reads this on every message. Fill in your business details, priorities, and standing orders.</p>
                    <textarea
                        value={brainSpec}
                        onChange={(e) => { setBrainSpec(e.target.value); setBrainSaved(false); }}
                        className="w-full h-80 bg-black/30 border border-white/10 rounded-2xl p-5 text-white/80 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all scrollbar-hide"
                        placeholder="# MASTER SPEC — Business Brain&#10;&#10;## Business Identity&#10;- Company Name: ...&#10;- State: ..."
                        spellCheck={false}
                    />
                </div>

                {/* HUD Config — Persona-Aware */}
                <div className="lg:col-span-2 glass-panel p-8 rounded-3xl border border-cyan-500/20 relative">
                    <div className="flex items-center gap-3 mb-5">
                        <Cpu className="w-5 h-5 text-cyan-400" />
                        <h3 className="text-lg font-black text-white tracking-tight">HUD Display</h3>
                        <span className="text-[9px] text-cyan-400/50 font-mono uppercase tracking-widest">Persona-Aware</span>
                    </div>
                    <p className="text-white/30 text-xs mb-5">Controls what Claw shows on the dashboard. Each persona has its own HUD.</p>

                    {/* Persona Tabs */}
                    <div className="flex gap-2 mb-6">
                        {[{ id: 'assistant', icon: '🐙', label: 'Octo' }, { id: 'trader', icon: '🦈', label: 'Sharky' }, { id: 'business', icon: '🦀', label: 'Boss Crab' }].map(p => (
                            <button
                                key={p.id}
                                onClick={() => { setHudPersona(p.id); setHudConfig(hudService.getConfig(p.id)); }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${hudPersona === p.id
                                    ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/10'
                                    : 'bg-white/5 border border-white/10 text-white/40 hover:text-white/60'
                                    }`}
                            >
                                {p.icon} {p.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Dashboard Priorities */}
                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                            <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">📊 Dashboard Priorities</h4>
                            <ul className="space-y-1.5">
                                {hudConfig.dashboardPriorities.map((p, i) => (
                                    <li key={i} className="text-white/60 text-xs flex items-start gap-2">
                                        <span className="text-cyan-400/40 mt-0.5">▸</span> {p}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                            <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">⚡ Quick Actions</h4>
                            <div className="space-y-1.5">
                                {hudConfig.quickActions.map(a => (
                                    <div key={a.id} className="text-white/60 text-xs flex items-center gap-2">
                                        <span>{a.icon}</span> <span className="font-medium">{a.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Alert Rules */}
                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                            <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">🔔 Alert Rules</h4>
                            <div className="space-y-1.5">
                                {hudConfig.alertRules.map(r => (
                                    <div key={r.id} className="text-xs flex items-start gap-2">
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${r.severity === 'critical' ? 'bg-rose-500/20 text-rose-400' : r.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>{r.severity.toUpperCase()}</span>
                                        <span className="text-white/50">{r.condition}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Focus Areas */}
                        <div className="bg-black/20 rounded-2xl p-4 border border-white/5">
                            <h4 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mb-3">🎯 Focus Areas</h4>
                            <div className="flex flex-wrap gap-2">
                                {hudConfig.focusAreas.map((f, i) => (
                                    <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400/70 text-[10px] font-bold border border-cyan-500/20">{f}</span>
                                ))}
                            </div>
                            <p className="text-white/20 text-[10px] mt-3 font-mono">Briefing: {hudConfig.briefingSchedule}</p>
                        </div>
                    </div>
                </div>

                {/* AI Soul Selection Matrix */}
                <div className="lg:col-span-2 glass-panel p-10 rounded-[50px] border-rose-500/10 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5"><Sparkles className="w-40 h-40 text-rose-500" /></div>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-rose-500/10 rounded-2xl text-rose-500 border border-rose-500/20 shadow-glow"><Brain className="w-8 h-8" /></div>
                        <div>
                            <h3 className="text-2xl font-bold text-white uppercase tracking-tight">AI Soul Matrix</h3>
                            <p className="text-white/40 text-xs font-mono uppercase tracking-widest">Select operational consciousness and review learnings</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                        {souls.map((s) => {
                            const isActive = identity?.soul === s.id;
                            const memory = identity?.soulMemories?.[s.id];
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => handleSoulChange(s.id)}
                                    className={`p-8 rounded-[40px] border transition-all flex flex-col text-left group
                                    ${isActive
                                            ? `bg-${s.color}-500/10 border-${s.color}-500/40 shadow-glow`
                                            : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className={`p-4 rounded-3xl transition-all shadow-lg ${isActive ? `bg-${s.color}-500 text-white` : 'bg-white/5 text-white/30 group-hover:text-white'}`}>
                                            <s.icon className="w-8 h-8" />
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            {isActive && (
                                                <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded bg-${s.color}-500 text-white animate-pulse`}>Active</span>
                                            )}
                                            <div
                                                onClick={(e) => { e.stopPropagation(); setSelectedSoulDetail(s.id); }}
                                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all"
                                                title="View Soul Smarts"
                                            >
                                                <History className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                    </div>
                                    <h4 className={`text-xl font-bold uppercase tracking-tight mb-2 ${isActive ? 'text-white' : 'text-white/60'}`}>{s.name}</h4>
                                    <p className="text-xs text-white/40 mb-6 font-mono leading-relaxed">{s.desc}</p>

                                    <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                                        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest text-white/20">
                                            <span>Evolution Lvl</span>
                                            <span className={isActive ? `text-${s.color}-400` : ''}>{memory?.evolutionLevel || 1}</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className={`h-full transition-all duration-1000 ${isActive ? `bg-${s.color}-500 shadow-glow` : 'bg-white/10'}`}
                                                style={{ width: `${Math.min(100, (memory?.interactionCount || 0) * 10)}%` }}
                                            ></div>
                                        </div>
                                        <div className="text-[8px] text-white/20 font-mono italic">
                                            {memory?.learnings.length || 0} Soul Smarts Persistent
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Neural Core Selection */}
                <div className="lg:col-span-2 glass-panel glass-panel-rose p-8 rounded-[40px] relative overflow-hidden border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                        <div className="max-w-xl">
                            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-3 uppercase tracking-tight">
                                <div className="p-2 bg-white/5 rounded-xl text-rose-500"><Cpu className="w-5 h-5" /></div>
                                Intelligence Engine
                            </h3>
                            <p className="text-sm text-white/50 leading-relaxed font-mono">
                                Define the primary intelligence driver for ClawKeep. "Dynamic Pilot" allows the OS to automatically scale between models based on task complexity.
                            </p>
                        </div>

                        <div className="w-full md:w-96 flex flex-col gap-3">
                            <div className="flex items-end gap-3">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-3">Model Architecture</label>
                                    <select
                                        value={preferredModel}
                                        onChange={(e) => { setPreferredModel(e.target.value); userScopeService.scopedSet('preferred_model', e.target.value); }}
                                        className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white font-mono focus:outline-none focus:border-rose-500 shadow-inner appearance-none cursor-pointer uppercase font-bold tracking-widest"
                                    >
                                        {availableModels.map(m => {
                                            const orModel = OPENROUTER_MODELS.find(om => om.id === m);
                                            const oaiModel = OPENAI_MODELS.find(om => om.id === m);
                                            const label = m === 'DYNAMIC' ? 'Dynamic Pilot (Recommended)'
                                                : oaiModel ? `${oaiModel.name} — OpenAI${!openRouterService.isOpenAIAvailable() ? ' 🔑' : ''}`
                                                    : orModel ? `${orModel.name} — ${orModel.provider}${!openRouterService.isAvailable() ? ' 🔑' : ''}`
                                                        : m;
                                            return <option key={m} value={m}>{label}</option>;
                                        })}
                                    </select>
                                </div>
                                <button
                                    onClick={() => setShowAddModel(!showAddModel)}
                                    className="p-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-white/40 hover:text-white transition-all mb-0.5"
                                    title="Add Custom Model Name"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {showAddModel && (
                                <div className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
                                    <input
                                        type="text"
                                        value={newModelName}
                                        onChange={(e) => setNewModelName(e.target.value)}
                                        placeholder="e.g. anthropic/claude-sonnet-4 or meta-llama/llama-4-scout:free"
                                        className="flex-1 bg-black/40 border border-rose-500/20 rounded-xl px-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                                    />
                                    <button onClick={handleAddModel} className="px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase">Add</button>
                                </div>
                            )}

                            {/* Model compatibility info */}
                            <div className="mt-4 p-4 bg-purple-500/5 border border-purple-500/15 rounded-2xl">
                                <div className="flex items-start gap-2.5">
                                    <Zap className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1.5">OpenRouter Model IDs</p>
                                        <p className="text-[9px] text-white/40 leading-relaxed">
                                            Use the <span className="text-white/60 font-semibold">+</span> button to add any model from <span className="text-white/60 font-mono">openrouter.ai</span>.
                                            Enter the full model ID (e.g. <span className="text-white/60 font-mono">provider/model-name</span>).
                                            Append <span className="text-purple-400 font-mono">:free</span> for free-tier models.
                                        </p>
                                        <p className="text-[9px] text-white/30 leading-relaxed mt-1.5">
                                            Gemini models use your Google API key directly. All other models route through OpenRouter — set your key in Vault → Secrets.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>



                {/* Gateway Connection Card */}
                <div className="glass-panel p-8 rounded-[40px] relative overflow-hidden border-white/5">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-3 uppercase tracking-tight">
                        <div className="p-2 bg-white/5 rounded-xl text-cyan-400 shadow-glow"><Shield className="w-5 h-5" /></div>
                        Pincer Link
                    </h2>

                    <div className="space-y-5 relative z-10">
                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1">Account Email</label>
                            <div className="relative group">
                                <Server className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-cyan-400 transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-xs text-white font-mono placeholder:text-white/10 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
                                    placeholder="your@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[9px] font-black text-white/40 uppercase tracking-[0.2em] mb-3 ml-1">Account Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 group-focus-within:text-cyan-400 transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-xs text-white font-mono placeholder:text-white/10 focus:outline-none focus:border-cyan-500 transition-all shadow-inner"
                                    placeholder="••••••••••••••••"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex items-center gap-3 p-4 bg-black/60 rounded-3xl border border-white/5">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                        <span className="text-[9px] font-mono text-white/40 uppercase tracking-[0.2em] font-bold">
                            Status: {status === 'CONNECTED' ? 'Active Uplink' : 'Tunnel Closed'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Soul Smart Viewer Modal */}
            {selectedSoulDetail && (
                <div className="fixed inset-0 z-[6000] flex items-center justify-center p-8 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-300">
                    <div className="glass-panel border-white/20 rounded-[50px] max-w-2xl w-full flex flex-col shadow-2xl relative overflow-hidden max-h-[80vh]">
                        <div className="absolute top-0 left-0 w-full h-1 bg-rose-500"></div>

                        <header className="p-10 border-b border-white/10 flex justify-between items-center bg-white/5 shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-3xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-glow">
                                    <Brain className="w-8 h-8 text-rose-500" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white uppercase tracking-tight">Soul Smarts: {selectedSoulDetail}</h3>
                                    <p className="text-white/40 text-[10px] font-mono uppercase tracking-widest">Autonomous Learning Repository</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedSoulDetail(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5">
                                <X className="w-6 h-6 text-white/20 hover:text-white" />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-10 space-y-4 scrollbar-hide">
                            {identity?.soulMemories?.[selectedSoulDetail]?.learnings.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center opacity-20">
                                    <Sparkles className="w-16 h-16 mb-4" />
                                    <p className="text-sm font-mono tracking-widest uppercase">No Persistent Learnings Logged</p>
                                </div>
                            ) : (
                                identity?.soulMemories?.[selectedSoulDetail]?.learnings.map((learning, i) => (
                                    <div key={i} className="p-6 bg-white/5 border border-white/5 rounded-3xl flex gap-5 group animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 0.1}s` }}>
                                        <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20 group-hover:scale-110 transition-transform">
                                            <MessageSquare className="w-4 h-4 text-rose-500" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white/80 font-mono text-sm leading-relaxed italic group-hover:text-white transition-colors">"{learning}"</p>
                                            <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-2 block">Extracted Artifact #{i + 1}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <footer className="p-8 border-t border-white/10 bg-white/5 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-white/30 uppercase font-black">Interactions</span>
                                    <span className="text-lg font-bold text-white font-mono">{identity?.soulMemories?.[selectedSoulDetail]?.interactionCount || 0}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-white/30 uppercase font-black">Evolution</span>
                                    <span className="text-lg font-bold text-rose-500 font-mono">Lvl {identity?.soulMemories?.[selectedSoulDetail]?.evolutionLevel || 1}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    if (confirm('Permanently scrub these Soul Smarts?')) {
                                        const id = { ...identity! };
                                        id.soulMemories[selectedSoulDetail] = { learnings: [], interactionCount: 0, evolutionLevel: 1 };
                                        gatewayService.saveIdentity(id);
                                        setSelectedSoulDetail(null);
                                    }
                                }}
                                className="px-8 py-4 bg-rose-900/20 hover:bg-rose-600 hover:text-white text-rose-400 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Purge Memory
                            </button>
                        </footer>
                    </div>
                </div>
            )}


            {/* ===== ACCOUNT SECURITY ===== */}
            <div className="border border-white/10 rounded-2xl p-6 bg-slate-900/50">
                <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Lock className="w-4 h-4 text-amber-400" /> Account Security
                </h3>
                <PasswordChangeForm />
            </div>

            {/* ===== ADMIN PANEL ===== */}
            {isAdmin && (
                <div className="border border-rose-500/20 rounded-2xl p-6 bg-slate-900/50">
                    <h3 className="text-white font-black text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-rose-400" /> Admin Panel
                    </h3>
                    <AdminUserPanel />
                </div>
            )}

            {/* ===== GENIE LAYOUT INSPECTOR ===== */}
            <GenieLayoutInspector />
        </div>
    );
};

export default SettingsView;
