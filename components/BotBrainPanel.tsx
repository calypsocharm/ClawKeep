import React, { useState, useEffect, useRef } from 'react';
import { Brain, Activity, CheckCircle, XCircle, Clock, Zap, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, DollarSign, ChevronDown, ChevronRight } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';

interface BotBrainPanelProps {
    pair?: string;
}

const BotBrainPanel: React.FC<BotBrainPanelProps> = ({ pair = 'SOL/USDC' }) => {
    const [expanded, setExpanded] = useState(true);
    const [evaluation, setEvaluation] = useState<any>(null);
    const [trades, setTrades] = useState<any[]>([]);
    const [positions, setPositions] = useState<any[]>([]);
    const [thinkingLog, setThinkingLog] = useState<any[]>([]);
    const [evalLoading, setEvalLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'brain' | 'trades' | 'positions'>('brain');
    const [strategies, setStrategies] = useState<any[]>([]);
    const [selectedStrategy, setSelectedStrategy] = useState('');
    const logRef = useRef<HTMLDivElement>(null);

    // Subscribe to responses
    useEffect(() => {
        const unsub = gatewayService.subscribeTrader((data: any) => {
            switch (data.type) {
                case 'TRADER_EVALUATION':
                    setEvaluation(data);
                    setEvalLoading(false);
                    // Add to thinking log
                    setThinkingLog(prev => [{
                        time: new Date(),
                        strategy: data.strategyName,
                        signals: data.signals,
                        ruleResults: data.ruleResults,
                        price: data.indicators?.price,
                    }, ...prev].slice(0, 50)); // Keep last 50 entries
                    break;
                case 'TRADER_STRATEGIES':
                    setStrategies(data.strategies || []);
                    if (!selectedStrategy && data.strategies?.length > 0) {
                        setSelectedStrategy(data.strategies[0].name);
                    }
                    break;
                case 'TRADER_POSITIONS':
                    setPositions(data.positions || []);
                    break;
                case 'TRADER_STATUS':
                    setTrades(data.recentTrades || []);
                    break;
                case 'TRADER_HISTORY':
                    setTrades(data.history || []);
                    break;
            }
        });
        // Load initial data
        gatewayService.traderGetStrategies();
        gatewayService.traderGetPositions('all');
        return unsub;
    }, []);

    // Run evaluation 
    const runEval = () => {
        if (!selectedStrategy) return;
        setEvalLoading(true);
        gatewayService.traderEvaluate(selectedStrategy, pair);
    };

    const formatTime = (d: Date | string) => {
        const date = d instanceof Date ? d : new Date(d);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (d: string | number) => {
        return new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    };

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Brain className="w-4 h-4 text-purple-400" /> Bot Brain
                    {evaluation?.signals?.length > 0 && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    )}
                </h2>
                {expanded ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
            </div>

            {expanded && (
                <div className="space-y-3">
                    {/* Tabs */}
                    <div className="flex gap-1 p-1 rounded-lg bg-white/[0.03]">
                        {(['brain', 'trades', 'positions'] as const).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-white/[0.08] text-white' : 'text-white/30 hover:text-white/50'
                                    }`}>
                                {tab === 'brain' && <><Brain className="w-3 h-3 inline mr-1" />Thinking</>}
                                {tab === 'trades' && <><Activity className="w-3 h-3 inline mr-1" />Trade Log</>}
                                {tab === 'positions' && <><DollarSign className="w-3 h-3 inline mr-1" />Positions</>}
                            </button>
                        ))}
                    </div>

                    {/* Brain / Thinking Tab */}
                    {activeTab === 'brain' && (
                        <div className="space-y-3">
                            {/* Strategy selector + eval button */}
                            <div className="flex gap-2">
                                <select value={selectedStrategy} onChange={e => setSelectedStrategy(e.target.value)}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-[10px] text-white outline-none">
                                    <option value="">Select strategy...</option>
                                    {strategies.map(s => (
                                        <option key={s.name} value={s.name}>{s.name}</option>
                                    ))}
                                </select>
                                <button onClick={runEval} disabled={!selectedStrategy || evalLoading}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-30">
                                    {evalLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                                    Think
                                </button>
                            </div>

                            {/* Current evaluation - Rule by Rule */}
                            {evaluation?.ruleResults && evaluation.ruleResults.length > 0 && (
                                <div className="space-y-1.5">
                                    <div className="text-[8px] text-white/25 font-bold uppercase tracking-wider">
                                        Rule-by-Rule Analysis — {evaluation.strategyName}
                                    </div>
                                    {evaluation.ruleResults.map((r: any, i: number) => (
                                        <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${r.passed
                                                ? 'bg-green-500/5 border-green-500/10'
                                                : 'bg-red-500/5 border-red-500/10'
                                            }`}>
                                            {r.passed
                                                ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                                                : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                            }
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] font-bold ${r.passed ? 'text-green-400' : 'text-red-400'}`}>
                                                        {r.label}
                                                    </span>
                                                    <span className="text-[8px] text-white/15 px-1.5 py-0.5 rounded bg-white/[0.03]">
                                                        {r.side}
                                                    </span>
                                                </div>
                                                <div className="text-[9px] text-white/30">{r.detail}</div>
                                                <div className={`text-[9px] font-mono ${r.passed ? 'text-green-400/60' : 'text-red-400/60'}`}>
                                                    {r.current}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Summary verdict */}
                                    <div className={`p-2.5 rounded-lg border text-center ${evaluation.signals?.length > 0
                                            ? 'bg-green-500/10 border-green-500/20'
                                            : 'bg-white/[0.03] border-white/[0.06]'
                                        }`}>
                                        {evaluation.signals?.length > 0 ? (
                                            <div className="space-y-1">
                                                {evaluation.signals.map((s: any, i: number) => (
                                                    <div key={i} className={`text-[10px] font-bold ${s.type === 'entry' ? 'text-green-400' :
                                                            s.urgent ? 'text-red-400' : 'text-amber-400'
                                                        }`}>
                                                        {s.type === 'entry' ? '📈' : s.urgent ? '🛑' : '🎯'} {s.message}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-[10px] text-white/25 italic">
                                                🧠 No action — waiting for all conditions to align
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Thinking History */}
                            {thinkingLog.length > 0 && (
                                <div>
                                    <div className="text-[8px] text-white/25 font-bold uppercase tracking-wider mb-1.5">Thought History</div>
                                    <div ref={logRef} className="max-h-40 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin' }}>
                                        {thinkingLog.map((entry, i) => (
                                            <div key={i} className="flex items-center gap-2 py-1 px-2 rounded bg-white/[0.02] text-[9px]">
                                                <span className="text-white/15 font-mono shrink-0">{formatTime(entry.time)}</span>
                                                <span className="text-white/40 truncate">{entry.strategy}</span>
                                                <span className="text-white/20 shrink-0">${entry.price?.toFixed(2)}</span>
                                                {entry.signals?.length > 0 ? (
                                                    <span className="text-green-400 font-bold shrink-0">⚡ SIGNAL</span>
                                                ) : (
                                                    <span className="text-white/15 shrink-0">—</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {!evaluation && thinkingLog.length === 0 && (
                                <div className="text-[10px] text-white/20 text-center py-4 italic">
                                    Select a strategy and click "Think" to see the bot's analysis
                                </div>
                            )}
                        </div>
                    )}

                    {/* Trade Log Tab */}
                    {activeTab === 'trades' && (
                        <div className="space-y-1.5">
                            {trades.length === 0 ? (
                                <div className="text-[10px] text-white/20 text-center py-4 italic">
                                    No trades yet — the bot will log all swaps here
                                </div>
                            ) : (
                                <>
                                    <div className="text-[8px] text-white/25 font-bold uppercase tracking-wider mb-1">
                                        All Trades ({trades.length})
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin' }}>
                                        {trades.map((t: any, i: number) => (
                                            <div key={i} className={`p-2 rounded-lg border ${t.type === 'buy' || t.action === 'buy'
                                                    ? 'bg-green-500/5 border-green-500/10'
                                                    : 'bg-red-500/5 border-red-500/10'
                                                }`}>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        {t.type === 'buy' || t.action === 'buy' ? (
                                                            <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                                                        ) : (
                                                            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                                                        )}
                                                        <span className={`text-[10px] font-bold ${t.type === 'buy' || t.action === 'buy' ? 'text-green-400' : 'text-red-400'
                                                            }`}>
                                                            {(t.type || t.action || '').toUpperCase()} {t.token || t.pair || 'SOL'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[9px] text-white/20">{formatDate(t.timestamp || t.time || t.date)}</span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    {t.amount && <span className="text-[9px] text-white/40">{t.amount} SOL</span>}
                                                    {t.price && <span className="text-[9px] text-white/30">${parseFloat(t.price).toFixed(2)}</span>}
                                                    {t.usdcAmount && <span className="text-[9px] text-green-400/50">{t.usdcAmount} USDC</span>}
                                                    {t.status && <span className={`text-[8px] px-1.5 py-0.5 rounded ${t.status === 'success' ? 'bg-green-500/10 text-green-400/60' :
                                                            t.status === 'failed' ? 'bg-red-500/10 text-red-400/60' :
                                                                'bg-white/5 text-white/30'
                                                        }`}>{t.status}</span>}
                                                </div>
                                                {t.trigger && <div className="text-[8px] text-white/15 mt-1">Trigger: {t.trigger}</div>}
                                                {t.txId && (
                                                    <a href={`https://solscan.io/tx/${t.txId}`} target="_blank" rel="noopener noreferrer"
                                                        className="text-[8px] text-purple-400/40 hover:text-purple-400 mt-1 inline-block">
                                                        View on Solscan →
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Positions Tab */}
                    {activeTab === 'positions' && (
                        <div className="space-y-1.5">
                            {positions.length === 0 ? (
                                <div className="text-[10px] text-white/20 text-center py-4 italic">
                                    No positions tracked yet
                                </div>
                            ) : (
                                <>
                                    {/* Open Positions */}
                                    {positions.filter(p => p.status === 'open').length > 0 && (
                                        <div>
                                            <div className="text-[8px] text-green-400/60 font-bold uppercase tracking-wider mb-1">
                                                Open Positions
                                            </div>
                                            {positions.filter(p => p.status === 'open').map((pos: any, i: number) => {
                                                const holdDays = Math.floor((Date.now() - (pos.entryDate || Date.now())) / 86400000);
                                                return (
                                                    <div key={i} className="p-2.5 rounded-lg bg-green-500/5 border border-green-500/10 mb-1.5">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] font-bold text-white">{pos.pair || 'SOL/USDC'}</span>
                                                            <span className="text-[9px] text-white/30">{holdDays}d held</span>
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 mt-1.5">
                                                            <div>
                                                                <div className="text-[7px] text-white/20">Entry</div>
                                                                <div className="text-[10px] text-white font-bold">${parseFloat(pos.entryPrice || 0).toFixed(2)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[7px] text-white/20">Avg Cost</div>
                                                                <div className="text-[10px] text-white font-bold">${parseFloat(pos.avgPrice || pos.entryPrice || 0).toFixed(2)}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-[7px] text-white/20">Size</div>
                                                                <div className="text-[10px] text-white font-bold">{pos.size || pos.amount || '—'} SOL</div>
                                                            </div>
                                                        </div>
                                                        {pos.strategy && <div className="text-[8px] text-purple-400/40 mt-1">Strategy: {pos.strategy}</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Closed Positions */}
                                    {positions.filter(p => p.status === 'closed').length > 0 && (
                                        <div>
                                            <div className="text-[8px] text-white/25 font-bold uppercase tracking-wider mb-1">
                                                Closed ({positions.filter(p => p.status === 'closed').length})
                                            </div>
                                            {positions.filter(p => p.status === 'closed').map((pos: any, i: number) => {
                                                const pnl = pos.pnl || (pos.exitPrice && pos.entryPrice ? ((pos.exitPrice - pos.entryPrice) / pos.entryPrice * 100) : 0);
                                                return (
                                                    <div key={i} className={`p-2 rounded-lg border mb-1 ${pnl >= 0 ? 'bg-green-500/5 border-green-500/10' : 'bg-red-500/5 border-red-500/10'
                                                        }`}>
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[10px] text-white/50">{pos.pair || 'SOL/USDC'}</span>
                                                            <span className={`text-[10px] font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-3 text-[9px] text-white/25 mt-0.5">
                                                            <span>In: ${parseFloat(pos.entryPrice || 0).toFixed(2)}</span>
                                                            <span>Out: ${parseFloat(pos.exitPrice || 0).toFixed(2)}</span>
                                                            {pos.closeDate && <span>{formatDate(pos.closeDate)}</span>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BotBrainPanel;
