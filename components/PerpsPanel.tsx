import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Loader2, X, AlertTriangle, ChevronDown, DollarSign, Zap, BarChart3 } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';

interface PerpsMarket {
    symbol: string;
    underlying: string;
    price: number;
    maxLeverage: number;
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
}

const PerpsPanel: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const [markets, setMarkets] = useState<PerpsMarket[]>([]);
    const [positions, setPositions] = useState<PerpsPosition[]>([]);
    const [loading, setLoading] = useState(false);
    const [opening, setOpening] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const [selectedMarket, setSelectedMarket] = useState('SOL');
    const [side, setSide] = useState<'long' | 'short'>('long');
    const [collateral, setCollateral] = useState('');
    const [leverage, setLeverage] = useState(5);
    const [collateralToken, setCollateralToken] = useState('SOL');

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
                    setSuccess(`Position opened! Tx: ${data.signature?.slice(0, 8)}...`);
                    gatewayService.traderGetPerps(); // Refresh positions
                    break;
                case 'TRADER_PERP_CLOSED':
                    setSuccess(`Position closed! Tx: ${data.signature?.slice(0, 8)}...`);
                    gatewayService.traderGetPerps();
                    break;
                case 'TRADER_ERROR':
                    setOpening(false);
                    if (data.error?.includes('erp')) setError(data.error);
                    break;
            }
        });
        return () => unsub();
    }, []);

    const handleExpand = () => {
        if (!expanded) {
            setLoading(true);
            gatewayService.traderGetPerpsMarkets();
            gatewayService.traderGetPerps();
        }
        setExpanded(!expanded);
    };

    const handleOpenPosition = () => {
        const collateralUsd = parseFloat(collateral);
        if (!collateralUsd || collateralUsd <= 0) return;
        setOpening(true);
        setError('');
        gatewayService.traderOpenPerp(selectedMarket, side, collateralUsd, leverage, collateralToken);
    };

    const positionSize = parseFloat(collateral || '0') * leverage;
    const selectedMarketData = markets.find(m => m.underlying === selectedMarket);

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <div className="flex items-center justify-between mb-1 cursor-pointer" onClick={handleExpand}>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" /> Jupiter Perps
                    <span className="text-[8px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        Leverage
                    </span>
                </h2>
                <ChevronDown className={`w-4 h-4 text-white/30 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-[10px] text-white/20 mb-3">Long/Short with up to 20× leverage on SOL, ETH, wBTC</p>

            {expanded && (
                <div className="space-y-4">
                    {/* Market Prices */}
                    {markets.length > 0 && (
                        <div className="grid grid-cols-3 gap-2">
                            {markets.map(m => (
                                <button key={m.symbol} onClick={() => setSelectedMarket(m.underlying)}
                                    className={`p-2.5 rounded-xl border text-center transition-all ${selectedMarket === m.underlying
                                        ? 'border-amber-500/30 bg-amber-500/10'
                                        : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]'
                                        }`}>
                                    <div className="text-[9px] text-white/40 font-bold uppercase">{m.underlying}</div>
                                    <div className="text-sm font-bold text-white">
                                        {m.price > 0 ? `$${m.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {loading && (
                        <div className="flex items-center justify-center py-4 gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="text-xs text-white/30">Loading markets...</span>
                        </div>
                    )}

                    {/* Open Position Form */}
                    {!loading && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                            <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider">
                                Open {selectedMarket}-PERP Position
                            </div>

                            {/* Long / Short Toggle */}
                            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <button onClick={() => setSide('long')}
                                    className={`py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${side === 'long' ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'text-white/30 hover:text-white/50'
                                        }`}>
                                    <TrendingUp className="w-3.5 h-3.5" /> Long
                                </button>
                                <button onClick={() => setSide('short')}
                                    className={`py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${side === 'short' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'text-white/30 hover:text-white/50'
                                        }`}>
                                    <TrendingDown className="w-3.5 h-3.5" /> Short
                                </button>
                            </div>

                            {/* Collateral */}
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
                                    placeholder="$10, $50, $100..."
                                    className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-amber-500/30 font-mono"
                                    step="any" min="0" />
                            </div>

                            {/* Leverage Slider */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <div className="text-[8px] text-white/25 font-bold uppercase">Leverage</div>
                                    <div className={`text-xs font-black ${leverage >= 10 ? 'text-red-400' : leverage >= 5 ? 'text-amber-400' : 'text-green-400'}`}>
                                        {leverage}×
                                    </div>
                                </div>
                                <input type="range" min="1.1" max="20" step="0.1" value={leverage}
                                    onChange={e => setLeverage(parseFloat(e.target.value))}
                                    className="w-full accent-amber-500 h-1.5 rounded-full appearance-none cursor-pointer"
                                    style={{ background: `linear-gradient(to right, #22c55e ${((leverage - 1.1) / 18.9) * 100}%, #ffffff10 ${((leverage - 1.1) / 18.9) * 100}%)` }} />
                                <div className="flex justify-between text-[8px] text-white/15 mt-0.5">
                                    <span>1.1×</span>
                                    <span>5×</span>
                                    <span>10×</span>
                                    <span>20×</span>
                                </div>
                            </div>

                            {/* Position Summary */}
                            {parseFloat(collateral) > 0 && (
                                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] grid grid-cols-2 gap-2 text-[10px]">
                                    <div>
                                        <span className="text-white/25">Position Size:</span>
                                        <span className="text-white font-bold ml-1">${positionSize.toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-white/25">Collateral:</span>
                                        <span className="text-white font-bold ml-1">${parseFloat(collateral).toFixed(2)}</span>
                                    </div>
                                    <div>
                                        <span className="text-white/25">Leverage:</span>
                                        <span className={`font-bold ml-1 ${leverage >= 10 ? 'text-red-400' : 'text-amber-400'}`}>{leverage}×</span>
                                    </div>
                                    <div>
                                        <span className="text-white/25">Side:</span>
                                        <span className={`font-bold ml-1 ${side === 'long' ? 'text-green-400' : 'text-red-400'}`}>
                                            {side.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Open Button */}
                            <button onClick={handleOpenPosition}
                                disabled={opening || !collateral || parseFloat(collateral) <= 0}
                                className="w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.01] active:scale-[0.99]"
                                style={{
                                    background: side === 'long'
                                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                                        : 'linear-gradient(135deg, #ef4444, #dc2626)',
                                    boxShadow: side === 'long'
                                        ? '0 2px 12px rgba(34,197,94,0.3)'
                                        : '0 2px 12px rgba(239,68,68,0.3)',
                                }}>
                                {opening ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening Position...
                                    </span>
                                ) : (
                                    `${side === 'long' ? '🟢' : '🔴'} Open ${side.toUpperCase()} ${selectedMarket}-PERP`
                                )}
                            </button>

                            {leverage >= 10 && (
                                <div className="flex items-center gap-1.5 text-[9px] text-amber-400/60">
                                    <AlertTriangle className="w-3 h-3" />
                                    High leverage — liquidation risk increases significantly above 10×
                                </div>
                            )}
                        </div>
                    )}

                    {/* Open Positions */}
                    {positions.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-[10px] text-white/30 font-bold uppercase tracking-wider">
                                Open Positions ({positions.length})
                            </div>
                            {positions.map(p => (
                                <div key={p.key} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${p.side === 'long' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                                }`}>{p.side}</span>
                                            <span className="text-xs font-bold text-white">{p.market}-PERP</span>
                                            <span className="text-[9px] text-amber-400 font-bold">{p.leverage}×</span>
                                        </div>
                                        <button onClick={() => gatewayService.traderClosePerp(p.key)}
                                            className="text-[9px] text-red-400 hover:text-red-300 font-bold px-2 py-1 rounded hover:bg-red-500/10 transition-colors">
                                            Close
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-2 text-[10px]">
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
                                                {p.pnlUsd >= 0 ? '+' : ''}${p.pnlUsd.toFixed(2)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Messages */}
                    {error && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                            <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                            <span className="text-[10px] text-red-400">{error}</span>
                            <button onClick={() => setError('')} className="ml-auto"><X className="w-3 h-3 text-red-400/50" /></button>
                        </div>
                    )}
                    {success && (
                        <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                            <span className="text-[10px] text-green-400">{success}</span>
                            <button onClick={() => setSuccess('')} className="ml-auto"><X className="w-3 h-3 text-green-400/50" /></button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PerpsPanel;
