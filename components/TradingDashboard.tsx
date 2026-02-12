import React, { useState, useEffect, useCallback } from 'react';
import { Wallet, TrendingUp, TrendingDown, Activity, Power, ArrowUpRight, ArrowDownRight, Zap, BarChart3, CircleDollarSign, Bot, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';

interface TradingDashboardProps {
    onNavigate: (view: string) => void;
}

interface TraderStatus {
    walletCreated: boolean;
    publicKey: string;
    balance: number;
    usdcBalance: number;
    solPrice: number;
    totalUsd: number;
    isRunning: boolean;
    rules: any[];
    recentTrades: any[];
    lastCheck: string;
    hasStrategies: boolean;
    positionCount: number;
}

const TradingDashboard: React.FC<TradingDashboardProps> = ({ onNavigate }) => {
    const [status, setStatus] = useState<TraderStatus | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStatus = useCallback(async () => {
        try {
            const result = await gatewayService.traderStatus();
            if (result && !result.error) {
                setStatus(result as any);
            }
        } catch (e) { }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 15000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    // Listen for trader broadcasts
    useEffect(() => {
        const handler = (e: CustomEvent) => {
            if (e.detail?.type === 'TRADER_STATUS') setStatus(e.detail);
            if (e.detail?.type === 'TRADER_LOG') fetchStatus();
        };
        window.addEventListener('trader-broadcast' as any, handler);
        return () => window.removeEventListener('trader-broadcast' as any, handler);
    }, [fetchStatus]);

    const pnl = status?.recentTrades?.reduce((sum, t) => {
        if (t.type === 'trade' && t.outAmount && t.inAmount) {
            return sum + (parseFloat(t.outAmount) - parseFloat(t.inAmount));
        }
        return sum;
    }, 0) || 0;

    const pnlColor = pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
    const pnlIcon = pnl >= 0 ? TrendingUp : TrendingDown;
    const PnlIcon = pnlIcon;

    return (
        <div className="h-full overflow-y-auto p-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff10 transparent' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Trading Dashboard</h1>
                    <p className="text-xs text-white/30 mt-1 font-mono">
                        {status?.isRunning ? '🟢 Bot Active' : '⭕ Bot Idle'} · Last check: {status?.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : '—'}
                    </p>
                </div>
                <button onClick={fetchStatus} className="p-2 rounded-xl hover:bg-white/[0.06] text-white/30 hover:text-white/60 transition-all">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Top Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Wallet Balance */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-emerald-400" />
                        </div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Portfolio</span>
                    </div>
                    <div className="text-2xl font-bold text-white">${status?.totalUsd?.toFixed(2) || '0.00'}</div>
                    <div className="flex gap-3 mt-2 text-[10px] text-white/30 font-mono">
                        <span>{status?.balance?.toFixed(4) || '0'} SOL</span>
                        <span>{status?.usdcBalance?.toFixed(2) || '0'} USDC</span>
                    </div>
                </div>

                {/* SOL Price */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-all">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                            <CircleDollarSign className="w-4 h-4 text-purple-400" />
                        </div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">SOL Price</span>
                    </div>
                    <div className="text-2xl font-bold text-white">${status?.solPrice?.toFixed(2) || '—'}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-2">Jupiter Price API</div>
                </div>

                {/* Bot Status */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-all">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${status?.isRunning ? 'bg-emerald-500/10' : 'bg-white/[0.06]'}`}>
                            <Bot className={`w-4 h-4 ${status?.isRunning ? 'text-emerald-400' : 'text-white/30'}`} />
                        </div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Bot</span>
                    </div>
                    <div className={`text-lg font-bold ${status?.isRunning ? 'text-emerald-400' : 'text-white/40'}`}>{status?.isRunning ? 'Running' : 'Stopped'}</div>
                    <div className="flex gap-3 mt-2 text-[10px] text-white/30 font-mono">
                        <span>{status?.rules?.filter(r => r.active).length || 0} rules active</span>
                        <span>{status?.positionCount || 0} positions</span>
                    </div>
                </div>

                {/* P&L */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.05] transition-all">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${pnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                            <PnlIcon className={`w-4 h-4 ${pnlColor}`} />
                        </div>
                        <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">Session P&L</span>
                    </div>
                    <div className={`text-2xl font-bold ${pnlColor}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(4)}</div>
                    <div className="text-[10px] text-white/30 font-mono mt-2">{status?.recentTrades?.filter(t => t.type === 'trade').length || 0} trades</div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {[
                    { label: 'Open Trading', icon: Zap, color: 'emerald', view: 'solana_trader' },
                    { label: 'View Chart', icon: BarChart3, color: 'purple', view: 'chart' },
                    { label: 'Strategies', icon: Activity, color: 'amber', view: 'strategy_sandbox' },
                    { label: 'Browse Web', icon: ExternalLink, color: 'blue', view: 'live_browser' },
                ].map((action, i) => (
                    <button key={i} onClick={() => onNavigate(action.view)} className={`flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-${action.color}-500/10 hover:border-${action.color}-500/20 transition-all group`}>
                        <action.icon className={`w-5 h-5 text-${action.color}-400 group-hover:scale-110 transition-transform`} />
                        <span className="text-sm font-semibold text-white/60 group-hover:text-white/90">{action.label}</span>
                    </button>
                ))}
            </div>

            {/* Recent Trades */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white/70 uppercase tracking-wider">Recent Activity</h2>
                    <button onClick={() => onNavigate('solana_trader')} className="text-[10px] text-emerald-400/60 hover:text-emerald-400 font-semibold uppercase tracking-wider transition-colors">
                        View All →
                    </button>
                </div>

                {(!status?.recentTrades || status.recentTrades.length === 0) ? (
                    <div className="text-center py-8 text-white/20">
                        <Bot className="w-8 h-8 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No trades yet</p>
                        <p className="text-xs mt-1">Start the bot from the Trading tab</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff10 transparent' }}>
                        {status.recentTrades.slice(0, 15).map((trade, i) => (
                            <div key={trade.id || i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all group">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${trade.type === 'trade' ? 'bg-emerald-500/10' :
                                        trade.type === 'error' ? 'bg-red-500/10' :
                                            trade.type === 'rule_trigger' ? 'bg-amber-500/10' :
                                                trade.type === 'perp_open' ? 'bg-purple-500/10' :
                                                    trade.type === 'perp_close' ? 'bg-blue-500/10' :
                                                        'bg-white/[0.06]'
                                    }`}>
                                    {trade.type === 'trade' ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> :
                                        trade.type === 'error' ? <span className="text-xs">❌</span> :
                                            trade.type === 'rule_trigger' ? <Zap className="w-3.5 h-3.5 text-amber-400" /> :
                                                trade.type === 'perp_open' ? <TrendingUp className="w-3.5 h-3.5 text-purple-400" /> :
                                                    trade.type === 'perp_close' ? <TrendingDown className="w-3.5 h-3.5 text-blue-400" /> :
                                                        <Activity className="w-3.5 h-3.5 text-white/30" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white/70 truncate">{trade.message}</p>
                                    <p className="text-[10px] text-white/25 font-mono mt-0.5">
                                        {new Date(trade.timestamp).toLocaleString()}
                                        {trade.txHash && <span className="ml-2">tx: {trade.txHash.slice(0, 8)}…</span>}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Wallet Address */}
            {status?.walletCreated && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] text-white/25 uppercase tracking-wider font-bold">Wallet</span>
                        <button onClick={() => navigator.clipboard.writeText(status.publicKey)} className="text-[10px] text-emerald-400/50 hover:text-emerald-400 font-mono transition-colors">
                            {status.publicKey}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TradingDashboard;
