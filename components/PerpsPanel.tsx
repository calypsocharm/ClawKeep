import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    TrendingUp, TrendingDown, Loader2, X, AlertTriangle, ChevronDown,
    DollarSign, Zap, BarChart3, RefreshCw, Shield, Target, Activity,
    Gauge, ArrowUpRight, ArrowDownRight, Clock, Flame
} from 'lucide-react';
import { gatewayService } from '../services/gatewayService';

interface PerpsMarket {
    symbol: string;
    underlying: string;
    price: number;
    maxLeverage: number;
    change24h?: number;
    volume24h?: number;
    openInterest?: number;
    fundingRate?: number;
}

interface PerpsPosition {
    key: string;
    market: string;
    side: 'long' | 'short';
    sizeUsd: number;
    collateralUsd: number;
    entryPrice: number;
    leverage: string;
    pnlUsd: number;
    openTime: string;
    markPrice?: number;
    liquidationPrice?: number;
}

// ─── Animated Number ─────────────────────────────────────────────
const AnimNum: React.FC<{ value: number; prefix?: string; decimals?: number; className?: string }> = ({
    value, prefix = '', decimals = 2, className = ''
}) => {
    const [display, setDisplay] = useState(value);
    const prev = useRef(value);
    useEffect(() => {
        if (value === prev.current) return;
        const diff = value - prev.current;
        const steps = 12;
        let step = 0;
        const start = prev.current;
        const tick = () => {
            step++;
            setDisplay(start + diff * (step / steps));
            if (step < steps) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        prev.current = value;
    }, [value]);
    return <span className={className}>{prefix}{display.toFixed(decimals)}</span>;
};

// ─── Liquidation Risk Bar ────────────────────────────────────────
const RiskBar: React.FC<{ entryPrice: number; markPrice?: number; liquidationPrice?: number; side: 'long' | 'short' }> = ({
    entryPrice, markPrice, liquidationPrice, side
}) => {
    if (!markPrice || !liquidationPrice || liquidationPrice === 0) return null;
    const distToLiq = Math.abs(markPrice - liquidationPrice);
    const totalRange = Math.abs(entryPrice - liquidationPrice);
    const riskPct = totalRange > 0 ? Math.max(0, Math.min(100, (1 - distToLiq / totalRange) * 100)) : 0;
    const color = riskPct > 75 ? '#ef4444' : riskPct > 50 ? '#f59e0b' : '#22c55e';
    return (
        <div className="mt-2">
            <div className="flex items-center justify-between text-[8px] mb-0.5">
                <span className="text-white/20 flex items-center gap-1"><Gauge className="w-2.5 h-2.5" /> Liq. Risk</span>
                <span style={{ color }} className="font-bold">{riskPct.toFixed(0)}%</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${riskPct}%`, background: color }} />
            </div>
            <div className="flex justify-between text-[7px] text-white/15 mt-0.5">
                <span>Entry: ${entryPrice.toFixed(2)}</span>
                <span>Liq: ${liquidationPrice?.toFixed(2)}</span>
            </div>
        </div>
    );
};

// ─── PnL Sparkline ───────────────────────────────────────────────
const PnlDot: React.FC<{ pnl: number }> = ({ pnl }) => (
    <div className="relative inline-flex items-center justify-center">
        {pnl !== 0 && (
            <div className={`absolute w-6 h-6 rounded-full animate-ping opacity-20 ${pnl > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
        )}
        <div className={`w-2 h-2 rounded-full ${pnl > 0 ? 'bg-green-400' : pnl < 0 ? 'bg-red-400' : 'bg-white/20'}`} />
    </div>
);

const PerpsPanel: React.FC = () => {
    const [expanded, setExpanded] = useState(true);
    const [markets, setMarkets] = useState<PerpsMarket[]>([]);
    const [positions, setPositions] = useState<PerpsPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [opening, setOpening] = useState(false);
    const [closing, setClosing] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    // Form state
    const [selectedMarket, setSelectedMarket] = useState('SOL');
    const [side, setSide] = useState<'long' | 'short'>('long');
    const [collateral, setCollateral] = useState('');
    const [leverage, setLeverage] = useState(5);
    const [collateralToken, setCollateralToken] = useState('SOL');
    const [showOrderForm, setShowOrderForm] = useState(false);

    // Quick-amount presets
    const QUICK_AMOUNTS = [10, 25, 50, 100, 250];
    const LEVERAGE_PRESETS = [2, 5, 10, 15, 20];

    const loadData = useCallback(() => {
        setRefreshing(true);
        gatewayService.traderGetPerpsMarkets();
        gatewayService.traderGetPerps();
        setTimeout(() => setRefreshing(false), 1500);
    }, []);

    useEffect(() => {
        const unsub = gatewayService.subscribeTrader((data: any) => {
            switch (data.type) {
                case 'TRADER_PERPS_MARKETS':
                    setMarkets(data.markets || []);
                    setLoading(false);
                    break;
                case 'TRADER_PERPS_POSITIONS':
                    setPositions(data.positions || []);
                    break;
                case 'TRADER_PERP_OPENED':
                    setOpening(false);
                    setCollateral('');
                    setSuccess(`🦈 Position opened! Tx: ${data.signature?.slice(0, 12)}...`);
                    setShowOrderForm(false);
                    loadData();
                    break;
                case 'TRADER_PERP_CLOSED':
                    setClosing(null);
                    setSuccess(`Position closed! Tx: ${data.signature?.slice(0, 12)}...`);
                    loadData();
                    break;
                case 'TRADER_ERROR':
                    setOpening(false);
                    setClosing(null);
                    if (data.error?.toLowerCase().includes('perp') || data.error?.toLowerCase().includes('position'))
                        setError(data.error);
                    break;
            }
        });
        return () => unsub();
    }, [loadData]);

    // Auto-refresh positions every 15s
    useEffect(() => {
        if (!expanded) return;
        loadData();
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
    }, [expanded, loadData]);

    // Auto-dismiss messages
    useEffect(() => {
        if (success) { const t = setTimeout(() => setSuccess(''), 5000); return () => clearTimeout(t); }
    }, [success]);
    useEffect(() => {
        if (error) { const t = setTimeout(() => setError(''), 8000); return () => clearTimeout(t); }
    }, [error]);

    const handleExpand = () => setExpanded(!expanded);

    const handleOpenPosition = () => {
        const collateralUsd = parseFloat(collateral);
        if (!collateralUsd || collateralUsd <= 0) return;
        setOpening(true);
        setError('');
        gatewayService.traderOpenPerp(selectedMarket, side, collateralUsd, leverage, collateralToken);
    };

    const handleClosePosition = (positionKey: string) => {
        setClosing(positionKey);
        gatewayService.traderClosePerp(positionKey);
    };

    const positionSize = parseFloat(collateral || '0') * leverage;
    const selectedMarketData = markets.find(m => m.underlying === selectedMarket);
    const totalPnl = positions.reduce((sum, p) => sum + (p.pnlUsd || 0), 0);
    const totalExposure = positions.reduce((sum, p) => sum + p.sizeUsd, 0);
    const totalCollateral = positions.reduce((sum, p) => sum + p.collateralUsd, 0);

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 pb-2 cursor-pointer" onClick={handleExpand}>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    Jupiter Perps
                    <span className="text-[8px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-amber-500/10">
                        Leverage
                    </span>
                </h2>
                <div className="flex items-center gap-2">
                    {positions.length > 0 && (
                        <span className={`text-[10px] font-bold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
                        </span>
                    )}
                    <ChevronDown className={`w-4 h-4 text-white/30 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>
            <p className="text-[10px] text-white/20 px-5 pb-3">Long/Short with up to 100× leverage on SOL, ETH, wBTC via Jupiter</p>

            {expanded && (
                <div className="px-5 pb-5 space-y-4">
                    {/* ── Portfolio Summary Strip ─────────────────────── */}
                    {positions.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                                <div className="text-[8px] text-white/25 uppercase font-bold">Total P&L</div>
                                <div className={`text-sm font-black ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    <AnimNum value={totalPnl} prefix={totalPnl >= 0 ? '+$' : '-$'} />
                                </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                                <div className="text-[8px] text-white/25 uppercase font-bold">Exposure</div>
                                <div className="text-sm font-black text-white">
                                    <AnimNum value={totalExposure} prefix="$" />
                                </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center">
                                <div className="text-[8px] text-white/25 uppercase font-bold">Collateral</div>
                                <div className="text-sm font-black text-amber-400">
                                    <AnimNum value={totalCollateral} prefix="$" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Market Selector Cards ───────────────────────── */}
                    {markets.length > 0 ? (
                        <div className="grid grid-cols-3 gap-2">
                            {markets.map(m => (
                                <button key={m.symbol} onClick={() => setSelectedMarket(m.underlying)}
                                    className={`relative p-3 rounded-xl border text-left transition-all duration-200 group overflow-hidden ${selectedMarket === m.underlying
                                        ? 'border-amber-500/30 bg-amber-500/[0.08] shadow-[0_0_20px_rgba(245,158,11,0.05)]'
                                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.1]'
                                        }`}>
                                    {selectedMarket === m.underlying && (
                                        <div className="absolute top-0 right-0 w-12 h-12 bg-amber-500/10 rounded-bl-full" />
                                    )}
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] text-white/40 font-bold uppercase">{m.underlying}</span>
                                        {m.change24h !== undefined && (
                                            <span className={`text-[8px] font-bold flex items-center gap-0.5 ${(m.change24h || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {(m.change24h || 0) >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                {Math.abs(m.change24h || 0).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-base font-black text-white">
                                        {m.price > 0 ? `$${m.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                                    </div>
                                    {m.fundingRate !== undefined && (
                                        <div className="text-[7px] text-white/20 mt-1 flex items-center gap-1">
                                            <Flame className="w-2 h-2" />
                                            Funding: <span className={`font-bold ${(m.fundingRate || 0) >= 0 ? 'text-green-400/60' : 'text-red-400/60'}`}>
                                                {((m.fundingRate || 0) * 100).toFixed(4)}%
                                            </span>
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : loading ? (
                        <div className="flex items-center justify-center py-6 gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="text-xs text-white/30">Loading markets...</span>
                        </div>
                    ) : null}

                    {/* ── New Position Button / Form Toggle ────────────── */}
                    {!loading && (
                        <button onClick={() => setShowOrderForm(!showOrderForm)}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all border ${showOrderForm
                                ? 'border-white/10 bg-white/[0.03] text-white/50'
                                : 'border-amber-500/20 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15'
                                }`}>
                            {showOrderForm ? '✕ Close Order Form' : '⚡ Open New Position'}
                        </button>
                    )}

                    {/* ── Open Position Form ──────────────────────────── */}
                    {showOrderForm && !loading && (
                        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3 animate-in slide-in-from-top-2"
                            style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
                            <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-2">
                                <Target className="w-3 h-3" />
                                Open {selectedMarket}-PERP Position
                            </div>

                            {/* Long / Short Toggle */}
                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <button onClick={() => setSide('long')}
                                    className={`py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${side === 'long'
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/20 shadow-[0_0_12px_rgba(34,197,94,0.1)]'
                                        : 'text-white/30 hover:text-white/50'
                                        }`}>
                                    <TrendingUp className="w-3.5 h-3.5" /> Long
                                </button>
                                <button onClick={() => setSide('short')}
                                    className={`py-2.5 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${side === 'short'
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.1)]'
                                        : 'text-white/30 hover:text-white/50'
                                        }`}>
                                    <TrendingDown className="w-3.5 h-3.5" /> Short
                                </button>
                            </div>

                            {/* Collateral + Quick Amounts */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[8px] text-white/25 font-bold uppercase">Collateral (USD)</div>
                                    <select value={collateralToken} onChange={e => setCollateralToken(e.target.value)}
                                        className="text-[9px] bg-transparent border border-white/10 rounded px-1.5 py-0.5 text-white/50 outline-none cursor-pointer">
                                        <option value="SOL">Pay in SOL</option>
                                        <option value="USDC">Pay in USDC</option>
                                    </select>
                                </div>
                                <input type="number" value={collateral} onChange={e => setCollateral(e.target.value)}
                                    placeholder="Enter amount..."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white outline-none focus:border-amber-500/30 font-mono transition-colors"
                                    step="any" min="0" />
                                <div className="flex gap-1 mt-1.5">
                                    {QUICK_AMOUNTS.map(amt => (
                                        <button key={amt} onClick={() => setCollateral(String(amt))}
                                            className={`flex-1 py-1 rounded text-[9px] font-bold transition-colors ${collateral === String(amt)
                                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                                : 'bg-white/[0.03] text-white/25 hover:text-white/40 border border-transparent'
                                                }`}>${amt}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Leverage Slider + Presets */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[8px] text-white/25 font-bold uppercase">Leverage</div>
                                    <div className={`text-sm font-black tabular-nums ${leverage >= 10 ? 'text-red-400' : leverage >= 5 ? 'text-amber-400' : 'text-green-400'}`}>
                                        {leverage.toFixed(1)}×
                                    </div>
                                </div>
                                <input type="range" min="1.1" max="20" step="0.1" value={leverage}
                                    onChange={e => setLeverage(parseFloat(e.target.value))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{
                                        background: `linear-gradient(to right, #22c55e ${((leverage - 1.1) / 18.9) * 33}%, #f59e0b ${((leverage - 1.1) / 18.9) * 66}%, #ef4444 ${((leverage - 1.1) / 18.9) * 100}%, #ffffff10 ${((leverage - 1.1) / 18.9) * 100}%)`,
                                        accentColor: leverage >= 10 ? '#ef4444' : leverage >= 5 ? '#f59e0b' : '#22c55e'
                                    }} />
                                <div className="flex gap-1 mt-1.5">
                                    {LEVERAGE_PRESETS.map(lev => (
                                        <button key={lev} onClick={() => setLeverage(lev)}
                                            className={`flex-1 py-1 rounded text-[9px] font-bold transition-colors ${leverage === lev
                                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                                : 'bg-white/[0.03] text-white/25 hover:text-white/40 border border-transparent'
                                                }`}>{lev}×</button>
                                    ))}
                                </div>
                            </div>

                            {/* Position Summary Card */}
                            {parseFloat(collateral) > 0 && (
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
                                        <div className="flex justify-between">
                                            <span className="text-white/25">Position Size</span>
                                            <span className="text-white font-bold">${positionSize.toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/25">Collateral</span>
                                            <span className="text-white font-bold">${parseFloat(collateral).toFixed(2)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/25">Leverage</span>
                                            <span className={`font-bold ${leverage >= 10 ? 'text-red-400' : 'text-amber-400'}`}>{leverage.toFixed(1)}×</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-white/25">Direction</span>
                                            <span className={`font-bold ${side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                                                {side === 'long' ? '🟢' : '🔴'} {side.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    {selectedMarketData && selectedMarketData.price > 0 && (
                                        <div className="pt-2 border-t border-white/[0.04] text-[9px] text-white/20">
                                            Est. Liq Price: ${(side === 'long'
                                                ? selectedMarketData.price * (1 - 0.9 / leverage)
                                                : selectedMarketData.price * (1 + 0.9 / leverage)
                                            ).toFixed(2)}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Open Button */}
                            <button onClick={handleOpenPosition}
                                disabled={opening || !collateral || parseFloat(collateral) <= 0}
                                className="w-full py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                                style={{
                                    background: side === 'long'
                                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                        : 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    boxShadow: side === 'long'
                                        ? '0 4px 20px rgba(34,197,94,0.25)'
                                        : '0 4px 20px rgba(239,68,68,0.25)',
                                }}>
                                {opening ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening Position...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        {side === 'long' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                        Open {side.toUpperCase()} {selectedMarket}-PERP · ${positionSize.toFixed(0)}
                                    </span>
                                )}
                            </button>

                            {leverage >= 10 && (
                                <div className="flex items-center gap-1.5 text-[9px] text-amber-400/60 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    High leverage — liquidation risk increases significantly above 10×
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Open Positions ───────────────────────────────── */}
                    {positions.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Activity className="w-3 h-3" />
                                    Open Positions ({positions.length})
                                </div>
                                <button onClick={loadData} disabled={refreshing}
                                    className="text-[9px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1">
                                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
                                </button>
                            </div>
                            {positions.map(p => {
                                const pnlPct = p.collateralUsd > 0 ? (p.pnlUsd / p.collateralUsd) * 100 : 0;
                                return (
                                    <div key={p.key} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <PnlDot pnl={p.pnlUsd} />
                                                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${p.side === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                    }`}>{p.side}</span>
                                                <span className="text-xs font-bold text-white">{p.market}-PERP</span>
                                                <span className="text-[9px] text-amber-400 font-bold">{p.leverage}×</span>
                                            </div>
                                            <button onClick={() => handleClosePosition(p.key)}
                                                disabled={closing === p.key}
                                                className="text-[9px] text-red-400 hover:text-red-300 font-bold px-2.5 py-1 rounded-lg hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/15">
                                                {closing === p.key ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Close'}
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 mt-2.5 text-[10px]">
                                            <div>
                                                <div className="text-white/20">Size</div>
                                                <div className="text-white font-bold">${p.sizeUsd.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-white/20">Entry</div>
                                                <div className="text-white font-bold">${p.entryPrice.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-white/20">P&L</div>
                                                <div className={`font-bold ${p.pnlUsd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    <AnimNum value={p.pnlUsd} prefix={p.pnlUsd >= 0 ? '+$' : '-$'} />
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-white/20">ROI</div>
                                                <div className={`font-bold ${pnlPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                                                </div>
                                            </div>
                                        </div>
                                        <RiskBar entryPrice={p.entryPrice} markPrice={p.markPrice} liquidationPrice={p.liquidationPrice} side={p.side} />
                                        {p.openTime && (
                                            <div className="text-[8px] text-white/15 mt-2 flex items-center gap-1">
                                                <Clock className="w-2.5 h-2.5" />
                                                Opened {new Date(p.openTime).toLocaleDateString()} {new Date(p.openTime).toLocaleTimeString()}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* No positions placeholder */}
                    {positions.length === 0 && !loading && markets.length > 0 && (
                        <div className="text-center py-4 text-white/15 text-xs">
                            No open perps positions. Use the form above to open one.
                        </div>
                    )}

                    {/* ── Messages ─────────────────────────────────────── */}
                    {error && (
                        <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 animate-in slide-in-from-top-1">
                            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                            <span className="text-[10px] text-red-400 flex-1">{error}</span>
                            <button onClick={() => setError('')}><X className="w-3 h-3 text-red-400/50 hover:text-red-400" /></button>
                        </div>
                    )}
                    {success && (
                        <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 animate-in slide-in-from-top-1">
                            <span className="text-[10px] text-green-400 flex-1">{success}</span>
                            <button onClick={() => setSuccess('')}><X className="w-3 h-3 text-green-400/50 hover:text-green-400" /></button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PerpsPanel;
