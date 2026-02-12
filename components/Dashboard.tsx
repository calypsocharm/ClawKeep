
import React, { useEffect, useState } from 'react';
import { Task, Document, License, AppView, UserIdentity, Asset, CalendarEvent, Project, ShellConfig } from '../types';
import {
    FileText, ShieldCheck, Truck, CheckCircle2, AlertTriangle,
    Calendar, Clock, ArrowRight, Briefcase, ClipboardList,
    Shield, Wrench, CircleDot, TrendingUp, Users, Bell,
    Sun, Moon, Mail, Globe, Zap, DollarSign, ClipboardCheck,
    BarChart3, Activity, Target, Crosshair, LineChart, Wallet,
    Brain, Lightbulb
} from 'lucide-react';
import { gatewayService } from '../services/gatewayService';
import { guardrailService } from '../services/guardrailService';
import { billingService } from '../services/billingService';
import { commitmentService } from '../services/commitmentService';
import { userScopeService } from '../services/userScopeService';

interface DashboardProps {
    tasks: Task[];
    documents: Document[];
    licenses: License[];
    assets: Asset[];
    projects: Project[];
    events: CalendarEvent[];
    onChangeView: (view: AppView) => void;
    shellConfig?: ShellConfig | null;
}

const Dashboard: React.FC<DashboardProps> = ({ tasks, documents, licenses, assets, projects, events, onChangeView, shellConfig }) => {
    const [identity, setIdentity] = useState<UserIdentity | null>(null);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const persona = shellConfig?.persona || 'business';
    const accent = shellConfig?.accentColor || '346 77% 50%';

    useEffect(() => {
        const unsubscribe = gatewayService.subscribeIdentity(setIdentity);
        return unsubscribe;
    }, []);

    const [guardrails, setGuardrails] = useState(guardrailService.getSettings());
    const [, setUsageTick] = useState(0);
    const isAwake = guardrailService.isAwake();

    useEffect(() => {
        const unsub1 = guardrailService.subscribe(setGuardrails);
        const unsub2 = billingService.subscribe(() => setUsageTick(t => t + 1));
        return () => { unsub1(); unsub2(); };
    }, []);

    const todayCost = billingService.getTodayCost();
    const weekCost = billingService.getWeekCost();
    const monthCost = billingService.getMonthCost();
    const allTimeCost = billingService.getAllTimeCost();
    const todayCalls = billingService.getTodayCalls();

    const [commitCounts, setCommitCounts] = useState(commitmentService.getCounts());
    useEffect(() => {
        const unsub = commitmentService.subscribe(() => setCommitCounts(commitmentService.getCounts()));
        return unsub;
    }, []);

    // Computed data
    const activeTasks = tasks.filter(t => t.status !== 'COMPLETED');
    const urgentTasks = activeTasks.filter(t => t.priority === 'CRITICAL' || t.priority === 'HIGH');
    const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);
    const activeProjects = projects.filter(p => p.status === 'IN_PROGRESS' || p.status === 'ACTIVE');
    const todayEvents = events.filter(e => e.start && e.start.startsWith(today));
    const upcomingEvents = events
        .filter(e => e.start && new Date(e.start) >= now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
        .slice(0, 5);

    const formatTime = (dateStr: string) => {
        try { return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }); }
        catch { return ''; }
    };

    // --- Shared: Status Row (Sleep, Usage, Commitments) ---
    const StatusRow = () => (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0 animate-fade-up" style={{ animationDelay: '50ms' }}>
            <div onClick={() => onChangeView(AppView.SETTINGS)}
                className={`glass-panel p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/[0.04] transition-all border ${isAwake ? 'border-emerald-500/15' : 'border-amber-500/15'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAwake ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    {isAwake ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isAwake ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                        <span className={`text-sm font-bold ${isAwake ? 'text-emerald-400' : 'text-amber-400'}`}>{isAwake ? 'AWAKE' : 'SLEEPING'}</span>
                    </div>
                    <p className="text-[9px] text-white/30 font-mono truncate">{guardrailService.getStatusText()}</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`p-1 rounded-md ${guardrails.emailEnabled ? 'text-emerald-400/60' : 'text-rose-400/40'}`}><Mail className="w-3 h-3" /></div>
                    <div className={`p-1 rounded-md ${guardrails.internetEnabled ? 'text-emerald-400/60' : 'text-rose-400/40'}`}><Globe className="w-3 h-3" /></div>
                    <div className={`p-1 rounded-md ${isAwake || guardrails.apiInSleep ? 'text-emerald-400/60' : 'text-rose-400/40'}`}><Zap className="w-3 h-3" /></div>
                </div>
            </div>

            <div onClick={() => onChangeView(AppView.ECONOMY)} className="glass-panel p-4 rounded-2xl flex items-center gap-4 cursor-pointer hover:bg-white/[0.04] transition-all border border-white/5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-400"><DollarSign className="w-5 h-5" /></div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-white">${todayCost.toFixed(4)}</span>
                        <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Today</span>
                        <span className="text-[9px] text-white/30 font-mono">{todayCalls} calls</span>
                    </div>
                    <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden mb-1">
                        <div className={`h-full rounded-full transition-all duration-1000 ${todayCost < 0.05 ? 'bg-emerald-500' : todayCost < 0.20 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${Math.min((todayCost / 0.50) * 100, 100)}%` }}></div>
                    </div>
                    <div className="flex items-center gap-3 text-[8px] text-white/25 font-mono">
                        <span>Week: ${weekCost.toFixed(3)}</span>
                        <span>Month: ${monthCost.toFixed(2)}</span>
                        <span>Total: ${allTimeCost.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className={`glass-panel p-4 rounded-2xl flex items-center gap-4 border ${commitCounts.stale > 0 ? 'border-rose-500/20' : commitCounts.pending > 0 ? 'border-amber-500/15' : 'border-emerald-500/15'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${commitCounts.stale > 0 ? 'bg-rose-500/10 text-rose-400' : commitCounts.pending > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    <ClipboardCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-white">{commitCounts.pending + commitCounts.stale === 0 ? 'All Clear' : `${commitCounts.pending + commitCounts.stale} Open`}</span>
                        <span className="text-[8px] text-white/20 font-bold uppercase tracking-widest">Commitments</span>
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono">
                        {commitCounts.stale > 0 && <span className="text-rose-400">{commitCounts.stale} stale ⚠️</span>}
                        {commitCounts.pending > 0 && <span className="text-amber-400">{commitCounts.pending} pending</span>}
                        <span className="text-emerald-400/50">{commitCounts.doneToday} done today</span>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- Shared: Agenda Panel ---
    const AgendaPanel = () => (
        <div className="glass-panel p-5 rounded-2xl flex flex-col animate-fade-up" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-cyan-500/10 rounded-lg"><Calendar className="w-4 h-4 text-cyan-400" /></div>
                    <h3 className="text-sm font-bold text-white">Today's Agenda</h3>
                </div>
                <button onClick={() => onChangeView(AppView.CALENDAR)} className="text-[9px] text-white/30 hover:text-cyan-400 font-semibold uppercase tracking-wider transition-colors flex items-center gap-1">
                    View All <ArrowRight className="w-3 h-3" />
                </button>
            </div>
            <div className="space-y-2 flex-1">
                {todayEvents.length === 0 && upcomingEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-white/15">
                        <Calendar className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-[10px] font-mono">No events scheduled</p>
                    </div>
                ) : (
                    <>
                        {todayEvents.map((ev, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
                                <Bell className="w-3.5 h-3.5 text-cyan-400" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white font-semibold truncate">{ev.title}</p>
                                    <p className="text-[9px] text-white/30 font-mono">{formatTime(ev.start)}</p>
                                </div>
                            </div>
                        ))}
                        {todayEvents.length === 0 && upcomingEvents.map((ev, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <Bell className="w-3.5 h-3.5 text-white/20" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white/70 font-semibold truncate">{ev.title}</p>
                                    <p className="text-[9px] text-white/20 font-mono">{new Date(ev.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );

    // --- Shared: Tasks Panel ---
    const TasksPanel = ({ title = 'Tasks' }: { title?: string }) => (
        <div className="glass-panel p-5 rounded-2xl flex flex-col animate-fade-up" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `hsl(${accent} / 0.1)` }}><ClipboardList className="w-4 h-4" style={{ color: `hsl(${accent})` }} /></div>
                    <h3 className="text-sm font-bold text-white">{title}</h3>
                </div>
                <button onClick={() => onChangeView(AppView.TASKS)} className="text-[9px] text-white/30 hover:text-white font-semibold uppercase tracking-wider transition-colors flex items-center gap-1">
                    All <ArrowRight className="w-3 h-3" />
                </button>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto max-h-[320px] scrollbar-hide">
                {overdueTasks.length > 0 && overdueTasks.slice(0, 3).map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
                        <span className="text-base">{t.emoji || '🔴'}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white truncate">{t.title}</p>
                            <p className="text-[9px] text-rose-400/60 font-mono">Overdue</p>
                        </div>
                    </div>
                ))}
                {activeTasks.filter(t => !overdueTasks.includes(t)).slice(0, 5).map((t, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all">
                        <span className="text-base">{t.emoji || <CircleDot className="w-4 h-4 text-white/20" />}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/80 truncate">{t.title}</p>
                            <p className="text-[9px] text-white/20 font-mono">{t.status}</p>
                        </div>
                    </div>
                ))}
                {activeTasks.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-white/15">
                        <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-[10px] font-mono">All clear</p>
                    </div>
                )}
            </div>
        </div>
    );

    // ========== PERSONA-SPECIFIC LAYOUTS ==========

    const personaLabel = {
        'claw': 'Dashboard',
        'assistant': 'Dashboard',
        'trader': 'Dashboard',
        'business': 'Dashboard'
    }[persona] || 'Dashboard';

    return (
        <div className="h-full flex flex-col overflow-y-auto scrollbar-hide bg-slate-950/20">
            <div className="p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto w-full pb-32">

                {/* Header — universal */}
                <header className="flex flex-wrap justify-between items-start gap-4 shrink-0 animate-fade-up">
                    <div className="min-w-0">
                        <h1 className="text-3xl font-extrabold text-white mb-1 tracking-tight">
                            {personaLabel} <span className="text-white/20 font-normal text-lg">/ {identity?.name || 'Operator'}</span>
                        </h1>
                        <p className="text-white/30 text-[10px] font-mono tracking-widest uppercase">
                            {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                </header>

                <StatusRow />

                {/* ===== TRADER DASHBOARD ===== */}
                {persona === 'trader' && (
                    <>
                        {/* Trader Stat Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                            {[
                                { label: 'Strategies', value: activeProjects.length, icon: Crosshair, color: 'emerald', action: () => onChangeView(AppView.PROJECTS) },
                                { label: 'Watchlist', value: activeTasks.length, icon: Target, color: 'cyan', action: () => onChangeView(AppView.TASKS) },
                                { label: 'Research', value: documents.filter(d => d.status === 'ACTIVE').length, icon: Brain, color: 'violet', action: () => onChangeView(AppView.DOCUMENTS) },
                                { label: 'Bots Active', value: '—', icon: Activity, color: 'amber', action: () => onChangeView(AppView.AGENTS) },
                            ].map((m, i) => (
                                <div key={i} onClick={m.action} className="glass-panel p-4 rounded-2xl flex flex-col gap-2 hover:bg-white/[0.04] transition-all cursor-pointer group animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                                    <div className={`w-8 h-8 rounded-lg bg-${m.color}-500/10 border border-${m.color}-500/15 flex items-center justify-center text-${m.color}-400`}>
                                        <m.icon className="w-4 h-4" />
                                    </div>
                                    <div className="text-xl font-bold text-white tracking-tight">{m.value}</div>
                                    <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wide">{m.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* Market Feed — Quick Launch */}
                            <div className="lg:col-span-2 glass-panel p-5 rounded-2xl flex flex-col animate-fade-up" style={{ animationDelay: '200ms' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-500/10 rounded-lg"><LineChart className="w-4 h-4 text-emerald-400" /></div>
                                        <h3 className="text-sm font-bold text-white">Market Feed</h3>
                                    </div>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent('claw-open-browser'))} className="text-[9px] text-white/30 hover:text-emerald-400 font-semibold uppercase tracking-wider transition-colors flex items-center gap-1">
                                        Browse with Claw <Globe className="w-3 h-3" />
                                    </button>
                                </div>
                                <p className="text-[10px] text-white/25 mb-4 font-mono">Launch a market site in the Live Browser — your bot can scrape and analyze in real-time.</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { name: 'TradingView', url: 'https://www.tradingview.com', color: 'emerald', emoji: '📊' },
                                        { name: 'Yahoo Finance', url: 'https://finance.yahoo.com', color: 'violet', emoji: '📈' },
                                        { name: 'Bloomberg', url: 'https://www.bloomberg.com/markets', color: 'cyan', emoji: '🏦' },
                                        { name: 'MarketWatch', url: 'https://www.marketwatch.com', color: 'amber', emoji: '📰' },
                                        { name: 'Finviz', url: 'https://finviz.com/map.ashx', color: 'rose', emoji: '🗺️' },
                                        { name: 'CoinGecko', url: 'https://www.coingecko.com', color: 'emerald', emoji: '🪙' },
                                    ].map((site, i) => (
                                        <button key={i} onClick={() => {
                                            userScopeService.scopedSet('browser_url', site.url);
                                            window.dispatchEvent(new CustomEvent('claw-open-browser'));
                                        }} className={`flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-${site.color}-500/10 hover:border-${site.color}-500/20 transition-all group`}>
                                            <span className="text-lg">{site.emoji}</span>
                                            <div className="text-left">
                                                <p className="text-[11px] font-semibold text-white group-hover:text-white">{site.name}</p>
                                                <p className="text-[8px] text-white/20 font-mono truncate">{site.url.replace('https://', '')}</p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Watchlist */}
                            <TasksPanel title="Watchlist" />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <AgendaPanel />
                            {/* Trade Notes */}
                            <div className="glass-panel p-5 rounded-2xl flex flex-col animate-fade-up" style={{ animationDelay: '400ms' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-violet-500/10 rounded-lg"><Brain className="w-4 h-4 text-violet-400" /></div>
                                        <h3 className="text-sm font-bold text-white">Trade Notes</h3>
                                    </div>
                                    <button onClick={() => onChangeView(AppView.SCRAPBOOK)} className="text-[9px] text-white/30 hover:text-violet-400 font-semibold uppercase tracking-wider transition-colors flex items-center gap-1">
                                        All Notes <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex-1 flex items-center justify-center py-8 text-white/15">
                                    <div className="text-center">
                                        <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-[10px] font-mono">No trade notes yet</p>
                                        <p className="text-[9px]">Track your thesis and journal entries</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ===== ASSISTANT DASHBOARD ===== */}
                {persona === 'assistant' && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                            {[
                                { label: 'Tasks', value: activeTasks.length, icon: ClipboardList, color: 'cyan', action: () => onChangeView(AppView.TASKS) },
                                { label: 'Urgent', value: urgentTasks.length, icon: AlertTriangle, color: urgentTasks.length > 0 ? 'rose' : 'emerald', action: () => onChangeView(AppView.TASKS) },
                                { label: 'Projects', value: activeProjects.length, icon: Briefcase, color: 'violet', action: () => onChangeView(AppView.PROJECTS) },
                                { label: 'Inbox', value: '—', icon: Mail, color: 'amber', action: () => onChangeView(AppView.EMAIL) },
                            ].map((m, i) => (
                                <div key={i} onClick={m.action} className="glass-panel p-4 rounded-2xl flex flex-col gap-2 hover:bg-white/[0.04] transition-all cursor-pointer group animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                                    <div className={`w-8 h-8 rounded-lg bg-${m.color}-500/10 border border-${m.color}-500/15 flex items-center justify-center text-${m.color}-400`}>
                                        <m.icon className="w-4 h-4" />
                                    </div>
                                    <div className="text-xl font-bold text-white tracking-tight">{m.value}</div>
                                    <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wide">{m.label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <AgendaPanel />
                            <TasksPanel />
                        </div>
                    </>
                )}

                {/* ===== BUSINESS DASHBOARD ===== */}
                {persona === 'business' && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
                            {[
                                { label: 'Active Tasks', value: activeTasks.length, icon: ClipboardList, color: 'cyan', action: () => onChangeView(AppView.TASKS) },
                                { label: 'Urgent', value: urgentTasks.length, icon: AlertTriangle, color: urgentTasks.length > 0 ? 'rose' : 'emerald', action: () => onChangeView(AppView.TASKS) },
                                { label: 'Projects', value: activeProjects.length, icon: Briefcase, color: 'violet', action: () => onChangeView(AppView.PROJECTS) },
                                { label: 'Documents', value: documents.filter(d => d.status === 'ACTIVE').length, icon: FileText, color: 'rose', action: () => onChangeView(AppView.DOCUMENTS) },
                                { label: 'Inventory', value: assets.length, icon: Truck, color: 'amber', action: () => onChangeView(AppView.ASSETS) },
                                { label: 'Licenses', value: licenses.length, icon: ShieldCheck, color: 'emerald', action: () => onChangeView(AppView.LICENSES) },
                            ].map((m, i) => (
                                <div key={i} onClick={m.action} className="glass-panel p-4 rounded-2xl flex flex-col gap-2 hover:bg-white/[0.04] transition-all cursor-pointer group animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                                    <div className={`w-8 h-8 rounded-lg bg-${m.color}-500/10 border border-${m.color}-500/15 flex items-center justify-center text-${m.color}-400`}>
                                        <m.icon className="w-4 h-4" />
                                    </div>
                                    <div className="text-xl font-bold text-white tracking-tight">{m.value}</div>
                                    <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wide">{m.label}</div>
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            <AgendaPanel />
                            <TasksPanel title="Active Jobs" />
                            {/* Compliance */}
                            <div className="glass-panel p-5 rounded-2xl flex flex-col animate-fade-up" style={{ animationDelay: '400ms' }}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-500/10 rounded-lg"><Shield className="w-4 h-4 text-emerald-400" /></div>
                                        <h3 className="text-sm font-bold text-white">Compliance</h3>
                                    </div>
                                    <button onClick={() => onChangeView(AppView.COMPLIANCE)} className="text-[9px] text-white/30 hover:text-emerald-400 font-semibold uppercase tracking-wider transition-colors flex items-center gap-1">
                                        View <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex-1 flex items-center justify-center py-8 text-white/15">
                                    <div className="text-center">
                                        <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-[10px] font-mono">{licenses.length === 0 ? 'No licenses tracked' : `${licenses.length} license(s) tracked`}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

            </div>
        </div>
    );
};
export default Dashboard;
