import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Shield, Power, Plus, Trash2, ExternalLink, Copy, Check, Loader2, AlertTriangle, X, Download, ChevronDown, Eye, EyeOff, Activity, Zap, Target, CircleOff, BarChart3, TrendingUp, TrendingDown, ArrowRightLeft, RefreshCw } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';
import { userScopeService } from '../services/userScopeService';
import StrategyBuilder from './StrategyBuilder';
import BotBrainPanel from './BotBrainPanel';
import PerpsPanel from './PerpsPanel';

interface BotRule {
    id: string; token: string; type: string; triggerPrice: number;
    action: string; outputToken: string; active: boolean; createdAt: string;
}
interface TradeEntry {
    id: string; type: string; message: string; timestamp: string;
    txHash?: string; inSymbol?: string; outSymbol?: string; inAmount?: string; outAmount?: string;
}

const shortAddr = (a: string) => a ? `${a.slice(0, 4)}...${a.slice(-4)}` : '';

const TOKEN_OPTIONS = ['SOL', 'USDC', 'USDT', 'JUP', 'BONK', 'WIF', 'JTO', 'PYTH', 'RAY', 'ORCA'];

const BotControlPanel: React.FC = () => {
    const [walletCreated, setWalletCreated] = useState(false);
    const [publicKey, setPublicKey] = useState('');
    const [balance, setBalance] = useState(0);
    const [usdcBalance, setUsdcBalance] = useState(0);
    const [solPrice, setSolPrice] = useState(0);
    const [totalUsd, setTotalUsd] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [rules, setRules] = useState<BotRule[]>([]);
    const [tradeLog, setTradeLog] = useState<TradeEntry[]>([]);
    const [lastCheck, setLastCheck] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [showExportKey, setShowExportKey] = useState(false);
    const [exportedKey, setExportedKey] = useState('');
    const [exportedMnemonic, setExportedMnemonic] = useState('');
    const [keyVisible, setKeyVisible] = useState(false);

    // Rule form
    const [showAddRule, setShowAddRule] = useState(false);
    const [newRule, setNewRule] = useState({ token: 'SOL', type: 'stop-loss', triggerPrice: '', action: 'sell-all', outputToken: 'USDC' });

    // Withdraw form
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [withdrawAddr, setWithdrawAddr] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');

    // Swap form
    const [showSwap, setShowSwap] = useState(false);
    const [swapFrom, setSwapFrom] = useState('SOL');
    const [swapTo, setSwapTo] = useState('USDC');
    const [swapAmount, setSwapAmount] = useState('');
    const [swapping, setSwapping] = useState(false);

    // Price ticker
    const [prevSolPrice, setPrevSolPrice] = useState(0);
    const tickerRef = useRef<NodeJS.Timeout | null>(null);

    // Bot persistence
    const [keepAlive, setKeepAlive] = useState(() => userScopeService.scopedGet('bot_keep_alive') === 'true');
    const [perpsEnabled, setPerpsEnabled] = useState(() => userScopeService.scopedGet('bot_perps_enabled') === 'true');

    // Indicator dashboard
    const [indicators, setIndicators] = useState<any>(null);
    const [indicatorLoading, setIndicatorLoading] = useState(false);
    const [showIndicators, setShowIndicators] = useState(false);

    // Listen for trader messages from VPS
    useEffect(() => {
        const unsub = gatewayService.subscribeTrader((data: any) => {
            switch (data.type) {
                case 'TRADER_STATUS':
                    setWalletCreated(data.walletCreated);
                    setPublicKey(data.publicKey || '');
                    setBalance(data.balance || 0);
                    setUsdcBalance(data.usdcBalance || 0);
                    setSolPrice(data.solPrice || 0);
                    setTotalUsd(data.totalUsd || 0);
                    setIsRunning(data.isRunning);
                    setRules(data.rules || []);
                    setTradeLog(data.recentTrades || []);
                    setLastCheck(data.lastCheck || '');
                    setLoading(false);
                    break;
                case 'TRADER_WALLET':
                    if (data.error) { setError(data.error); }
                    else {
                        setPublicKey(data.publicKey); setWalletCreated(true);
                        if (data.mnemonic) {
                            setExportedMnemonic(data.mnemonic);
                            setShowExportKey(true);
                            setSuccess('Burner wallet created! SAVE YOUR SEED PHRASE NOW!');
                        } else {
                            setSuccess('Burner wallet created!');
                        }
                    }
                    break;
                case 'TRADER_STARTED': setIsRunning(true); setSuccess('Bot started!'); break;
                case 'TRADER_STOPPED': setIsRunning(false); setSuccess('Bot stopped.'); break;
                case 'TRADER_RULE_ADDED': setRules(prev => [...prev, data.rule]); break;
                case 'TRADER_RULE_REMOVED': setRules(prev => prev.filter(r => r.id !== data.ruleId)); break;
                case 'TRADER_RULE_TOGGLED': setRules(prev => prev.map(r => r.id === data.ruleId ? { ...r, active: !r.active } : r)); break;
                case 'TRADER_LOG': setTradeLog(prev => [data.entry, ...prev].slice(0, 30)); break;
                case 'TRADER_KEY_EXPORT':
                    setExportedKey(data.secretKey || '');
                    setExportedMnemonic(data.mnemonic || '');
                    setShowExportKey(true);
                    break;
                case 'TRADER_SWAP_RESULT':
                    setSwapping(false);
                    setSwapAmount('');
                    setSuccess(`Swap complete! Tx: ${shortAddr(data.signature)}`);
                    gatewayService.traderStatus(); // Refresh balances
                    break;
                case 'TRADER_WITHDRAW_RESULT': setSuccess(`Withdrawn! Tx: ${shortAddr(data.signature)}`); break;
                case 'TRADER_HISTORY': setTradeLog(data.history || []); break;
                case 'TRADER_ERROR': setError(data.error); setLoading(false); setSwapping(false); break;
                case 'TRADER_WALLET_RESET':
                    setWalletCreated(false); setPublicKey(''); setBalance(0);
                    setIsRunning(false); setRules([]); setTradeLog([]);
                    setSuccess('Wallet reset — you can now generate a new one.');
                    break;
                case 'TRADER_INDICATORS':
                    setIndicators(data); setIndicatorLoading(false);
                    break;
            }
        });
        // Request initial status
        gatewayService.traderStatus();
        // Retry once after 3s if still loading (safety net for WS timing)
        const retry = setTimeout(() => { gatewayService.traderStatus(); }, 3000);
        // Auto-refresh price every 15s
        tickerRef.current = setInterval(() => { gatewayService.traderStatus(); }, 15000);
        return () => { unsub(); clearTimeout(retry); if (tickerRef.current) clearInterval(tickerRef.current); };
    }, []);

    const copyAddress = () => { navigator.clipboard.writeText(publicKey); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const clearMsg = () => { setError(''); setSuccess(''); };

    const handleAddRule = () => {
        if (!newRule.triggerPrice) return;
        gatewayService.traderAddRule({ ...newRule, triggerPrice: parseFloat(newRule.triggerPrice) });
        setShowAddRule(false);
        setNewRule({ token: 'SOL', type: 'stop-loss', triggerPrice: '', action: 'sell-all', outputToken: 'USDC' });
    };

    const handleWithdraw = () => {
        if (!withdrawAddr || !withdrawAmount) return;
        gatewayService.traderWithdraw(withdrawAddr, parseFloat(withdrawAmount));
        setShowWithdraw(false);
        setWithdrawAddr(''); setWithdrawAmount('');
    };

    const handleSwap = () => {
        if (!swapAmount || parseFloat(swapAmount) <= 0 || swapFrom === swapTo) return;
        setSwapping(true);
        gatewayService.traderSwap(swapFrom, swapTo, swapAmount);
    };

    // Track price direction
    useEffect(() => {
        if (solPrice > 0 && prevSolPrice > 0 && solPrice !== prevSolPrice) {
            // price changed
        }
        if (solPrice > 0) setPrevSolPrice(solPrice);
    }, [solPrice]);

    // Import key state
    const [showImport, setShowImport] = useState(false);
    const [importKeyInput, setImportKeyInput] = useState('');

    // Auto-import from SecretsView if set
    useEffect(() => {
        if (!walletCreated && !loading) {
            const saved = userScopeService.scopedGet('env_SOLANA_BURNER_KEY');
            if (saved) {
                gatewayService.traderImportKey(saved);
            }
        }
    }, [walletCreated, loading]);

    const handleImportKey = () => {
        if (!importKeyInput.trim()) return;
        gatewayService.traderImportKey(importKeyInput.trim());
        // Also save to localStorage/secrets
        userScopeService.scopedSet('env_SOLANA_BURNER_KEY', importKeyInput.trim());
        setImportKeyInput('');
        setShowImport(false);
    };

    if (loading) return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
            <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                <span className="text-sm text-white/40">Connecting to trading bot...</span>
            </div>
        </div>
    );

    // ─── No wallet yet ───
    if (!walletCreated) return (
        <div className="rounded-2xl border border-white/[0.06] p-6" style={{ background: 'linear-gradient(135deg, rgba(153,69,255,0.06), rgba(20,241,149,0.03))' }}>
            <div className="flex flex-col items-center py-6 gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10">
                    <Shield className="w-8 h-8 text-purple-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-lg font-bold text-white mb-1">Setup Burner Wallet</h2>
                    <p className="text-xs text-white/30 max-w-xs">Generate a new server-side keypair or import an existing <strong className="text-white/50">seed phrase</strong> or private key. The bot trades 24/7 on the VPS.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => gatewayService.traderGenerateWallet()}
                        className="px-5 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{ background: 'linear-gradient(135deg, #9945FF, #14F195)', boxShadow: '0 4px 20px rgba(153,69,255,0.3)' }}>
                        🔑 Generate New
                    </button>
                    <button onClick={() => setShowImport(!showImport)}
                        className="px-5 py-3 rounded-xl font-bold text-sm text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                        📥 Import Key
                    </button>
                </div>
                {showImport && (
                    <div className="w-full max-w-sm space-y-2">
                        <textarea value={importKeyInput} onChange={e => setImportKeyInput(e.target.value)}
                            placeholder="Paste 12/24-word seed phrase or base58 private key..."
                            rows={3}
                            className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white font-mono outline-none focus:border-purple-500/30 resize-none" />
                        <button onClick={handleImportKey}
                            className="w-full py-2 rounded-lg text-xs font-bold text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20">
                            Import Wallet
                        </button>
                    </div>
                )}
                <p className="text-[10px] text-white/20 italic">Seed phrase or private key stored on your VPS only</p>
            </div>
        </div>
    );

    // ─── Full Bot Control ───
    return (
        <div className="space-y-4">
            {/* ─── SOL Price Ticker ─── */}
            {solPrice > 0 && (
                <div className="rounded-xl border border-white/[0.06] px-4 py-2.5 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, rgba(153,69,255,0.08), rgba(20,241,149,0.04))' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: 'linear-gradient(135deg, #9945FF, #14F195)' }}>◎</div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white">${solPrice.toFixed(2)}</span>
                                {prevSolPrice > 0 && solPrice !== prevSolPrice && (
                                    <span className={`flex items-center gap-0.5 text-[10px] font-bold ${solPrice > prevSolPrice ? 'text-green-400' : 'text-red-400'}`}>
                                        {solPrice > prevSolPrice ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {((solPrice - prevSolPrice) / prevSolPrice * 100).toFixed(2)}%
                                    </span>
                                )}
                            </div>
                            <div className="text-[9px] text-white/25">SOL/USD • Live</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${solPrice > prevSolPrice ? 'bg-green-400' : solPrice < prevSolPrice ? 'bg-red-400' : 'bg-white/20'}`} style={{ animation: 'pulse 2s infinite' }} />
                        <span className="text-[8px] text-white/15">15s refresh</span>
                    </div>
                </div>
            )}

            {/* Burner Wallet Card */}
            <div className="rounded-2xl border border-white/[0.06] p-5" style={{ background: 'linear-gradient(135deg, rgba(153,69,255,0.06), rgba(20,241,149,0.03))' }}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-400" /> Burner Wallet
                        <span className="text-[8px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">VPS</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setShowWithdraw(!showWithdraw)} className="text-[10px] text-purple-400 hover:text-purple-300 font-bold">Withdraw</button>
                        <button onClick={() => gatewayService.traderExportKey()} className="text-[10px] text-white/20 hover:text-white/40 font-bold">Export Key</button>
                        <button onClick={() => { if (confirm('Reset wallet? This will delete the current keypair from the VPS.')) gatewayService.traderResetWallet(); }} className="text-[10px] text-red-400/40 hover:text-red-400 font-bold">Reset</button>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg, #9945FF, #14F195)' }}>🤖</div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white font-mono">{shortAddr(publicKey)}</span>
                                <button onClick={copyAddress} className="text-white/30 hover:text-white/60">{copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}</button>
                                <a href={`https://solscan.io/account/${publicKey}`} target="_blank" rel="noopener noreferrer" className="text-white/30 hover:text-white/60"><ExternalLink className="w-3 h-3" /></a>
                            </div>
                            <p className="text-[10px] text-white/20 mt-0.5">Fund this address from Phantom to start trading</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-black text-white">{balance.toFixed(4)} <span className="text-white/40 text-sm">SOL</span></div>
                        {solPrice > 0 && <div className="text-[10px] text-white/25">≈ ${(balance * solPrice).toFixed(2)} USD</div>}
                    </div>
                </div>

                {/* Balance Breakdown */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] text-center">
                        <div className="text-[7px] text-white/25 font-bold uppercase">SOL</div>
                        <div className="text-xs font-bold text-white">{balance.toFixed(4)}</div>
                        {solPrice > 0 && <div className="text-[8px] text-white/20">${(balance * solPrice).toFixed(2)}</div>}
                    </div>
                    <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10 text-center">
                        <div className="text-[7px] text-green-400/60 font-bold uppercase">USDC</div>
                        <div className="text-xs font-bold text-green-400">{usdcBalance.toFixed(2)}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/10 text-center">
                        <div className="text-[7px] text-purple-400/60 font-bold uppercase">Total</div>
                        <div className="text-xs font-bold text-purple-400">${totalUsd.toFixed(2)}</div>
                        {solPrice > 0 && <div className="text-[8px] text-white/15">SOL @ ${solPrice.toFixed(2)}</div>}
                    </div>
                </div>

                {/* Withdraw Form */}
                {showWithdraw && (
                    <div className="mt-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                        <input value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)} placeholder="Destination address..." className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white font-mono outline-none focus:border-purple-500/30" />
                        <div className="flex gap-2">
                            <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="Amount SOL" className="flex-1 bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-purple-500/30" />
                            <button onClick={handleWithdraw} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20">Send</button>
                        </div>
                    </div>
                )}

                {/* Export Key / Seed Phrase Modal */}
                {showExportKey && (exportedKey || exportedMnemonic) && (
                    <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="text-[10px] text-red-400 font-bold">⚠️ SECRET — DO NOT SHARE</div>
                            <button onClick={() => { setShowExportKey(false); setExportedKey(''); setExportedMnemonic(''); setKeyVisible(false); }}><X className="w-3 h-3 text-white/30" /></button>
                        </div>
                        {exportedMnemonic && (
                            <div>
                                <div className="text-[9px] text-white/40 font-bold mb-1 uppercase tracking-wider">Seed Phrase</div>
                                <div className="flex items-center gap-2">
                                    <div className={`flex-1 bg-black/40 border border-red-500/10 rounded-lg py-1.5 px-2 text-[10px] text-white font-mono ${keyVisible ? '' : 'blur-sm select-none'}`}>
                                        {exportedMnemonic}
                                    </div>
                                    <button onClick={() => setKeyVisible(!keyVisible)}>{keyVisible ? <EyeOff className="w-3 h-3 text-white/30" /> : <Eye className="w-3 h-3 text-white/30" />}</button>
                                    <button onClick={() => { navigator.clipboard.writeText(exportedMnemonic); }}><Copy className="w-3 h-3 text-white/30" /></button>
                                </div>
                            </div>
                        )}
                        {exportedKey && (
                            <div>
                                <div className="text-[9px] text-white/40 font-bold mb-1 uppercase tracking-wider">Private Key (base58)</div>
                                <div className="flex items-center gap-2">
                                    <input type={keyVisible ? 'text' : 'password'} readOnly value={exportedKey} className="flex-1 bg-black/40 border border-red-500/10 rounded-lg py-1.5 px-2 text-[10px] text-white font-mono outline-none" />
                                    <button onClick={() => { navigator.clipboard.writeText(exportedKey); }}><Copy className="w-3 h-3 text-white/30" /></button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─── Quick Swap Widget ─── */}
                <div className="mt-3 pt-3 border-t border-white/[0.06]">
                    <button onClick={() => setShowSwap(!showSwap)} className="flex items-center gap-2 text-xs font-bold text-white/50 hover:text-white/80 transition-colors w-full">
                        <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                        Quick Swap
                        <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showSwap ? 'rotate-180' : ''}`} />
                    </button>
                    {showSwap && (
                        <div className="mt-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                                <div>
                                    <div className="text-[8px] text-white/25 font-bold uppercase mb-1">From</div>
                                    <select value={swapFrom} onChange={e => setSwapFrom(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-2 text-xs text-white outline-none focus:border-purple-500/30 appearance-none cursor-pointer">
                                        {TOKEN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <button onClick={() => { const tmp = swapFrom; setSwapFrom(swapTo); setSwapTo(tmp); }}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors mb-0.5">
                                    <ArrowRightLeft className="w-3 h-3 text-cyan-400" />
                                </button>
                                <div>
                                    <div className="text-[8px] text-white/25 font-bold uppercase mb-1">To</div>
                                    <select value={swapTo} onChange={e => setSwapTo(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-2 text-xs text-white outline-none focus:border-purple-500/30 appearance-none cursor-pointer">
                                        {TOKEN_OPTIONS.filter(t => t !== swapFrom).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" value={swapAmount} onChange={e => setSwapAmount(e.target.value)}
                                    placeholder={`Amount ${swapFrom}...`}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-cyan-500/30 font-mono"
                                    step="any" min="0" />
                                <button onClick={handleSwap} disabled={swapping || !swapAmount || swapFrom === swapTo}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
                                    style={{ background: swapping ? '#333' : 'linear-gradient(135deg, #00d4aa, #0099ff)', boxShadow: swapping ? 'none' : '0 2px 12px rgba(0,212,170,0.3)' }}>
                                    {swapping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Swap'}
                                </button>
                            </div>
                            {swapAmount && parseFloat(swapAmount) > 0 && swapFrom !== swapTo && (
                                <div className="text-[9px] text-white/20 text-center">
                                    {swapAmount} {swapFrom} → {swapTo} • Jupiter V6 • 0.5% slippage
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {/* Indicator Dashboard */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2" onClick={() => setShowIndicators(!showIndicators)} style={{ cursor: 'pointer' }}>
                        <BarChart3 className="w-4 h-4 text-purple-400" /> Market Scanner
                        <ChevronDown className={`w-3 h-3 text-white/30 transition-transform ${showIndicators ? 'rotate-180' : ''}`} />
                    </h2>
                    <button onClick={() => { setIndicatorLoading(true); setShowIndicators(true); gatewayService.traderGetIndicators('SOL/USDC', 'day'); }}
                        className="flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-bold">
                        {indicatorLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Scan SOL
                    </button>
                </div>
                {showIndicators && indicators && !indicators.error && (
                    <div className="space-y-3">
                        {/* Price + RSI + ATR row */}
                        <div className="grid grid-cols-4 gap-2">
                            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <div className="text-[8px] text-white/30 font-bold uppercase">Price</div>
                                <div className="text-sm font-bold text-white">${indicators.price?.toFixed(2)}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <div className="text-[8px] text-white/30 font-bold uppercase">RSI</div>
                                <div className={`text-sm font-bold ${indicators.rsi?.zone === 'overbought' ? 'text-red-400' : indicators.rsi?.zone === 'oversold' ? 'text-green-400' : 'text-white'}`}>
                                    {indicators.rsi?.current?.toFixed(1)}
                                </div>
                                <div className={`text-[7px] font-bold uppercase ${indicators.rsi?.zone === 'overbought' ? 'text-red-400/60' : indicators.rsi?.zone === 'oversold' ? 'text-green-400/60' : 'text-white/20'}`}>{indicators.rsi?.zone}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <div className="text-[8px] text-white/30 font-bold uppercase">ATR</div>
                                <div className="text-sm font-bold text-white">{indicators.atr?.current?.toFixed(3)}</div>
                                {indicators.atr?.abnormal && <div className="text-[7px] text-red-400 font-bold">⚡ ABNORMAL</div>}
                            </div>
                            <div className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                <div className="text-[8px] text-white/30 font-bold uppercase">Stage</div>
                                <div className={`text-sm font-bold ${indicators.ladder?.stage >= 2 ? 'text-green-400' : 'text-white/40'}`}>
                                    {indicators.ladder?.stage || 0}
                                </div>
                                {indicators.diamond?.hasDiamond && (
                                    <div className={`text-[7px] font-bold ${indicators.diamond.color === 'purple' ? 'text-purple-400' : indicators.diamond.color === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                                        💎 {indicators.diamond.color.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Volume Profile */}
                        <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                            <div className="text-[8px] text-white/30 font-bold uppercase mb-2">Volume Profile</div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <div className="text-[7px] text-green-400/60 font-bold">VAL (Support)</div>
                                    <div className="text-xs font-bold text-green-400">${indicators.vp?.val?.toFixed(2)}</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-[7px] text-amber-400/60 font-bold">POC (Magnet)</div>
                                    <div className="text-xs font-bold text-amber-400">${indicators.vp?.poc?.toFixed(2)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[7px] text-red-400/60 font-bold">VAH (Resist)</div>
                                    <div className="text-xs font-bold text-red-400">${indicators.vp?.vah?.toFixed(2)}</div>
                                </div>
                            </div>
                            {/* Price position bar */}
                            {indicators.vp && indicators.vp.val > 0 && (
                                <div className="mt-2 relative h-2 rounded-full bg-white/5 overflow-hidden">
                                    <div className="absolute inset-y-0 bg-gradient-to-r from-green-500/30 via-amber-500/30 to-red-500/30" style={{ left: '0%', width: '100%' }} />
                                    <div className="absolute top-0 bottom-0 w-1 bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                                        style={{ left: `${Math.max(0, Math.min(100, ((indicators.price - indicators.vp.val) / (indicators.vp.vah - indicators.vp.val)) * 100))}%` }} />
                                </div>
                            )}
                        </div>

                        {/* AVWAP */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-purple-500/5 border border-purple-500/10">
                                <div className="text-[7px] text-purple-400/60 font-bold uppercase">AVWAP Major</div>
                                <div className="text-xs font-bold text-purple-400">${indicators.avwap?.major?.current?.toFixed(2)}</div>
                                <div className="text-[7px] text-white/20">{indicators.price > indicators.avwap?.major?.current ? <span className="text-green-400">✓ Above</span> : <span className="text-red-400">✗ Below</span>}</div>
                            </div>
                            <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                                <div className="text-[7px] text-amber-400/60 font-bold uppercase">AVWAP Current</div>
                                <div className="text-xs font-bold text-amber-400">${indicators.avwap?.current?.current?.toFixed(2)}</div>
                                <div className="text-[7px] text-white/20">{indicators.price > indicators.avwap?.current?.current ? <span className="text-green-400">✓ Above</span> : <span className="text-red-400">✗ Below</span>}</div>
                            </div>
                        </div>

                        {/* EMAs */}
                        <div className="flex gap-2">
                            {indicators.emas && Object.entries(indicators.emas).map(([key, val]: [string, any]) => (
                                <div key={key} className="flex-1 p-1.5 rounded bg-white/[0.02] border border-white/[0.04] text-center">
                                    <div className="text-[7px] text-white/25 font-bold uppercase">{key}</div>
                                    <div className="text-[10px] font-bold text-white/60">${val?.toFixed(2)}</div>
                                </div>
                            ))}
                        </div>

                        <div className="text-[8px] text-white/15 text-center">{indicators.candleCount} daily candles • {indicators.pair}</div>
                    </div>
                )}
                {showIndicators && indicators?.error && (
                    <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-[10px] text-red-400">{indicators.error}</div>
                )}
                {showIndicators && !indicators && !indicatorLoading && (
                    <p className="text-[10px] text-white/20 text-center py-2">Click "Scan SOL" to load indicators</p>
                )}
            </div>

            {/* Strategy Builder */}
            <StrategyBuilder pair="SOL/USDC" />

            {/* Jupiter Perps — Leverage Trading */}
            <PerpsPanel />

            {/* Bot Brain — Thinking + Trade Log + Positions */}
            <BotBrainPanel pair="SOL/USDC" />

            {/* Bot Control */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                        <Activity className="w-4 h-4 text-cyan-400" /> Trading Bot
                    </h2>
                    <div className="flex items-center gap-3">
                        {lastCheck && <span className="text-[9px] text-white/20">Last check: {new Date(lastCheck).toLocaleTimeString()}</span>}
                        <button onClick={() => isRunning ? gatewayService.traderStop() : gatewayService.traderStart()}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isRunning
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20'
                                : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20'}`}>
                            <Power className="w-3 h-3" /> {isRunning ? 'Stop' : 'Start'}
                        </button>
                    </div>
                </div>

                {isRunning && (
                    <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                        <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider">Bot Active — Monitoring Prices</span>
                    </div>
                )}

                {/* Toggles */}
                <div className="flex flex-col gap-2 mb-4">
                    {/* Keep Alive Toggle */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5 text-cyan-400" />
                            <div>
                                <div className="text-[11px] font-bold text-white">Keep Alive</div>
                                <div className="text-[9px] text-white/20">Bot runs on VPS even when browser is closed</div>
                            </div>
                        </div>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${keepAlive ? 'bg-cyan-500' : 'bg-white/10'}`}
                            onClick={() => {
                                const next = !keepAlive;
                                setKeepAlive(next);
                                userScopeService.scopedSet('bot_keep_alive', String(next));
                                gatewayService.traderKeepAlive(next);
                            }}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${keepAlive ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                        </div>
                    </label>

                    {/* Perps Auto-Trading Toggle */}
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] cursor-pointer hover:bg-white/[0.04] transition-colors">
                        <div className="flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <div>
                                <div className="text-[11px] font-bold text-white">Auto Perps Trading</div>
                                <div className="text-[9px] text-white/20">Allow bot to open leveraged positions autonomously</div>
                            </div>
                        </div>
                        <div className={`relative w-9 h-5 rounded-full transition-colors ${perpsEnabled ? 'bg-amber-500' : 'bg-white/10'}`}
                            onClick={() => {
                                const next = !perpsEnabled;
                                setPerpsEnabled(next);
                                userScopeService.scopedSet('bot_perps_enabled', String(next));
                                gatewayService.traderPerpsAuto(next);
                            }}>
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${perpsEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                        </div>
                    </label>
                </div>

                {/* Rules */}
                <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Trading Rules</span>
                        <button onClick={() => setShowAddRule(!showAddRule)} className="flex items-center gap-1 text-[10px] text-purple-400 hover:text-purple-300 font-bold">
                            <Plus className="w-3 h-3" /> Add Rule
                        </button>
                    </div>

                    {showAddRule && (
                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-2 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                                <select value={newRule.token} onChange={e => setNewRule(p => ({ ...p, token: e.target.value }))} className="bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white outline-none">
                                    {TOKEN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={newRule.type} onChange={e => setNewRule(p => ({ ...p, type: e.target.value }))} className="bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white outline-none">
                                    <option value="stop-loss">Stop Loss</option>
                                    <option value="take-profit">Take Profit</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <input type="number" step="any" placeholder="Trigger $ price" value={newRule.triggerPrice} onChange={e => setNewRule(p => ({ ...p, triggerPrice: e.target.value }))}
                                    className="bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white outline-none" />
                                <select value={newRule.action} onChange={e => setNewRule(p => ({ ...p, action: e.target.value }))} className="bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white outline-none">
                                    <option value="sell-all">Sell All</option>
                                    <option value="sell-half">Sell Half</option>
                                </select>
                                <select value={newRule.outputToken} onChange={e => setNewRule(p => ({ ...p, outputToken: e.target.value }))} className="bg-black/40 border border-white/10 rounded-lg py-1.5 px-2 text-xs text-white outline-none">
                                    {TOKEN_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <button onClick={handleAddRule} className="w-full py-2 rounded-lg text-xs font-bold text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/20">Add Rule</button>
                        </div>
                    )}

                    {rules.length === 0 ? (
                        <p className="text-[11px] text-white/15 italic text-center py-3">No rules set — add stop-loss or take-profit rules</p>
                    ) : (
                        <div className="space-y-1">
                            {rules.map(r => (
                                <div key={r.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${r.active ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/[0.01] border-white/[0.03] opacity-50'}`}>
                                    <div className="flex items-center gap-2">
                                        {r.type === 'stop-loss' ? <Target className="w-3.5 h-3.5 text-red-400" /> : <Zap className="w-3.5 h-3.5 text-green-400" />}
                                        <div>
                                            <span className="text-xs font-bold text-white">{r.token} {r.type}</span>
                                            <span className="text-[10px] text-white/30 ml-2">@ ${r.triggerPrice} → {r.action} to {r.outputToken}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => gatewayService.traderToggleRule(r.id)} className="p-1 hover:bg-white/5 rounded">
                                            {r.active ? <CircleOff className="w-3 h-3 text-white/30" /> : <Power className="w-3 h-3 text-green-400" />}
                                        </button>
                                        <button onClick={() => gatewayService.traderRemoveRule(r.id)} className="p-1 hover:bg-white/5 rounded"><Trash2 className="w-3 h-3 text-red-400/50" /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Kill Switch */}
                {isRunning && (
                    <button onClick={() => { gatewayService.traderStop(); }} className="w-full py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2">
                        🛑 KILL SWITCH — Stop All Trading
                    </button>
                )}
            </div>

            {/* Trade Log */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-white flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Bot Activity</h2>
                    <button onClick={() => gatewayService.traderHistory()} className="text-[10px] text-white/20 hover:text-white/40">Refresh</button>
                </div>
                {tradeLog.length === 0 ? (
                    <p className="text-[11px] text-white/15 italic text-center py-4">No activity yet</p>
                ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff10 transparent' }}>
                        {tradeLog.map(e => (
                            <div key={e.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${e.type === 'trade' ? 'bg-green-500/10 text-green-400' : e.type === 'error' ? 'bg-red-500/10 text-red-400' : e.type === 'rule_trigger' ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-white/30'}`}>{e.type}</span>
                                        <span className="text-[11px] text-white/60">{e.message}</span>
                                    </div>
                                    {e.txHash && <a href={`https://solscan.io/tx/${e.txHash}`} target="_blank" rel="noopener noreferrer" className="text-white/20 hover:text-purple-400"><ExternalLink className="w-3 h-3" /></a>}
                                </div>
                                <div className="text-[9px] text-white/15 mt-1">{new Date(e.timestamp).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Messages */}
            {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs text-red-400">{error}</span>
                    <button onClick={clearMsg} className="ml-auto"><X className="w-3 h-3 text-red-400/50" /></button>
                </div>
            )}
            {success && (
                <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                    <span className="text-xs text-green-400">{success}</span>
                    <button onClick={clearMsg} className="ml-auto"><X className="w-3 h-3 text-green-400/50" /></button>
                </div>
            )}
        </div>
    );
};

export default BotControlPanel;
