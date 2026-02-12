import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Play, Save, ChevronDown, ChevronRight, Zap, AlertTriangle, CheckCircle, Target, Shield, TrendingUp, BookOpen } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';

// ─── Preset Strategy Templates ────────────────────────────────────
const STRATEGY_TEMPLATES: Record<string, any> = {
    'VAL Bounce Swing': {
        description: 'Enter near Value Area Low with stage≥2. Classic support bounce setup.',
        entryRules: [
            { indicator: 'price_vs_val', label: 'Price near VAL', threshold: 0.02, description: 'Within X% of Value Area Low' },
            { indicator: 'ladder_stage', label: 'Ladder Stage ≥', condition: '>=', value: 2, description: 'Minimum ladder stage for entry' },
            { indicator: 'rsi', label: 'RSI below', condition: '<', value: 69, description: 'Avoid overbought entries' },
            { indicator: 'price_above_avwap_major', label: 'Above Major AVWAP', description: 'Price above the major low AVWAP' },
        ],
        exitRules: [
            { type: 'hard_stop', label: 'Hard Stop', atrMultiplier: 1.2, description: 'Exit if price drops below entry - (X × ATR)' },
            { type: 'profit_target', label: 'Profit Target', percent: 20, minHoldDays: 31, description: 'Take profit at X% after minimum hold' },
            { type: 'emergency', label: 'Emergency Exit', description: 'Exit on abnormal ATR + price below POC' },
        ],
    },
    'VAH Breakout + Retest': {
        description: 'Enter on breakout above Value Area High confirmed by retest. Momentum setup.',
        entryRules: [
            { indicator: 'price_above_vah', label: 'Price above VAH', description: 'Breakout above Value Area High' },
            { indicator: 'ladder_stage', label: 'Ladder Stage ≥', condition: '>=', value: 2, description: 'Confirmed structure' },
            { indicator: 'rsi', label: 'RSI below', condition: '<', value: 75, description: 'Not extremely overbought' },
            { indicator: 'price_above_avwap_current', label: 'Above Current AVWAP', description: 'Price holding above current anchor VWAP' },
        ],
        exitRules: [
            { type: 'hard_stop', label: 'Hard Stop', atrMultiplier: 1.5, description: 'Wider stop for breakout trades' },
            { type: 'profit_target', label: 'Profit Target', percent: 30, minHoldDays: 14, description: 'Higher target for momentum' },
            { type: 'emergency', label: 'Emergency Exit', description: 'Exit on abnormal ATR + price below POC' },
        ],
    },
    'Diamond Entry': {
        description: 'Enter on purple/green diamond signal after stage≥2 flush. Best risk/reward setup.',
        entryRules: [
            { indicator: 'diamond', label: 'Diamond Signal', color: 'purple', description: 'Purple diamond = RSI oversold flush' },
            { indicator: 'ladder_stage', label: 'Ladder Stage ≥', condition: '>=', value: 2, description: 'Must have established structure first' },
            { indicator: 'rsi', label: 'RSI below', condition: '<', value: 35, description: 'Deep oversold for best entries' },
        ],
        exitRules: [
            { type: 'hard_stop', label: 'Hard Stop', atrMultiplier: 1.0, description: 'Tight stop — diamond entries are precise' },
            { type: 'profit_target', label: 'Profit Target', percent: 25, minHoldDays: 21, description: 'Target profit after hold period' },
            { type: 'emergency', label: 'Emergency Exit', description: 'Exit on abnormal ATR + price below POC' },
        ],
    },
    'Custom Strategy': {
        description: 'Start from scratch — build your own entry and exit rules.',
        entryRules: [
            { indicator: 'rsi', label: 'RSI below', condition: '<', value: 70, description: 'RSI threshold' },
        ],
        exitRules: [
            { type: 'hard_stop', label: 'Hard Stop', atrMultiplier: 1.2, description: 'ATR-based stop loss' },
            { type: 'profit_target', label: 'Profit Target', percent: 20, minHoldDays: 0, description: 'Target profit %' },
        ],
    },
};

// All available entry rule types user can add
const ENTRY_RULE_OPTIONS = [
    { indicator: 'rsi', label: 'RSI Threshold', condition: '<', value: 69, description: 'RSI below value' },
    { indicator: 'ladder_stage', label: 'Ladder Stage', condition: '>=', value: 2, description: 'Minimum ladder stage' },
    { indicator: 'price_vs_val', label: 'Price near VAL', threshold: 0.02, description: 'Within % of VAL' },
    { indicator: 'price_vs_poc', label: 'Price near POC', threshold: 0.02, description: 'Within % of POC' },
    { indicator: 'price_above_vah', label: 'Price above VAH', description: 'Breakout above VAH' },
    { indicator: 'price_above_poc', label: 'Price above POC', description: 'Price above POC' },
    { indicator: 'price_above_avwap_major', label: 'Above Major AVWAP', description: 'Above long-term VWAP' },
    { indicator: 'price_above_avwap_current', label: 'Above Current AVWAP', description: 'Above short-term VWAP' },
    { indicator: 'diamond', label: 'Diamond Signal', color: '', description: 'Flush pattern detected' },
    { indicator: 'atr_abnormal', label: 'ATR Abnormal', value: true, description: 'Abnormal volatility' },
];

interface StrategyBuilderProps {
    pair?: string;
}

const StrategyBuilder: React.FC<StrategyBuilderProps> = ({ pair = 'SOL/USDC' }) => {
    const [expanded, setExpanded] = useState(false);
    const [strategyName, setStrategyName] = useState('');
    const [entryRules, setEntryRules] = useState<any[]>([]);
    const [exitRules, setExitRules] = useState<any[]>([]);
    const [savedStrategies, setSavedStrategies] = useState<any[]>([]);
    const [evaluation, setEvaluation] = useState<any>(null);
    const [evalLoading, setEvalLoading] = useState(false);
    const [showAddEntry, setShowAddEntry] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState('');
    const [activeTemplate, setActiveTemplate] = useState('');

    // Listen for strategy/evaluation responses
    useEffect(() => {
        const unsub = gatewayService.subscribeTrader((data: any) => {
            switch (data.type) {
                case 'TRADER_STRATEGIES':
                    setSavedStrategies(data.strategies || []);
                    if (data.ok) setSaveSuccess('Strategy saved!');
                    break;
                case 'TRADER_EVALUATION':
                    setEvaluation(data);
                    setEvalLoading(false);
                    break;
            }
        });
        gatewayService.traderGetStrategies();
        return unsub;
    }, []);

    // Load a template
    const loadTemplate = (name: string) => {
        const tpl = STRATEGY_TEMPLATES[name];
        if (!tpl) return;
        setStrategyName(name === 'Custom Strategy' ? '' : name);
        setEntryRules(JSON.parse(JSON.stringify(tpl.entryRules)));
        setExitRules(JSON.parse(JSON.stringify(tpl.exitRules)));
        setActiveTemplate(name);
        setEvaluation(null);
    };

    // Load a saved strategy
    const loadSaved = (strat: any) => {
        setStrategyName(strat.name);
        setEntryRules(strat.entryRules || []);
        setExitRules(strat.exitRules || []);
        setActiveTemplate('');
        setEvaluation(null);
    };

    // Save strategy
    const handleSave = () => {
        if (!strategyName.trim()) return;
        gatewayService.traderSaveStrategy({
            name: strategyName.trim(),
            entryRules,
            exitRules,
        });
        setTimeout(() => setSaveSuccess(''), 3000);
    };

    // Run evaluation
    const handleEvaluate = () => {
        if (!strategyName.trim()) return;
        // Save first, then evaluate
        handleSave();
        setEvalLoading(true);
        setTimeout(() => {
            gatewayService.traderEvaluate(strategyName.trim(), pair);
        }, 500);
    };

    // Update an entry rule field
    const updateEntry = (idx: number, field: string, val: any) => {
        setEntryRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    };

    // Update an exit rule field
    const updateExit = (idx: number, field: string, val: any) => {
        setExitRules(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));
    };

    // Add a new entry rule
    const addEntryRule = (opt: any) => {
        setEntryRules(prev => [...prev, { ...opt }]);
        setShowAddEntry(false);
    };

    // Render an entry rule editor
    const renderEntryRule = (rule: any, idx: number) => {
        return (
            <div key={idx} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cyan-400 font-bold">{rule.label || rule.indicator}</span>
                    <button onClick={() => setEntryRules(prev => prev.filter((_, i) => i !== idx))} className="p-0.5 hover:bg-white/5 rounded">
                        <Trash2 className="w-3 h-3 text-red-400/40" />
                    </button>
                </div>
                <div className="text-[8px] text-white/20">{rule.description}</div>
                <div className="flex gap-2 flex-wrap">
                    {/* Conditional value fields based on indicator type */}
                    {(rule.indicator === 'rsi' || rule.indicator === 'ladder_stage') && (
                        <>
                            <select value={rule.condition || '<'} onChange={e => updateEntry(idx, 'condition', e.target.value)}
                                className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none w-14">
                                <option value="<">&lt;</option>
                                <option value="<=">&le;</option>
                                <option value=">">&gt;</option>
                                <option value=">=">&ge;</option>
                                <option value="==">==</option>
                            </select>
                            <input type="number" value={rule.value} onChange={e => updateEntry(idx, 'value', parseFloat(e.target.value) || 0)}
                                className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none w-16" />
                        </>
                    )}
                    {(rule.indicator === 'price_vs_val' || rule.indicator === 'price_vs_poc') && (
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-white/30">Within</span>
                            <input type="number" step="0.005" value={rule.threshold} onChange={e => updateEntry(idx, 'threshold', parseFloat(e.target.value) || 0.02)}
                                className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none w-16" />
                            <span className="text-[9px] text-white/30">= {((rule.threshold || 0) * 100).toFixed(1)}%</span>
                        </div>
                    )}
                    {rule.indicator === 'diamond' && (
                        <select value={rule.color || ''} onChange={e => updateEntry(idx, 'color', e.target.value)}
                            className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none">
                            <option value="">Any Color</option>
                            <option value="purple">💎 Purple (Best)</option>
                            <option value="green">💚 Green (Good)</option>
                            <option value="red">🔴 Red (Avoid)</option>
                        </select>
                    )}
                    {/* Boolean indicators (no value needed) */}
                    {['price_above_vah', 'price_above_poc', 'price_above_avwap_major', 'price_above_avwap_current'].includes(rule.indicator) && (
                        <span className="text-[9px] text-green-400/60 italic">✓ Active — no value needed</span>
                    )}
                </div>
            </div>
        );
    };

    // Render an exit rule editor
    const renderExitRule = (rule: any, idx: number) => {
        return (
            <div key={idx} className="p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1.5">
                <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold ${rule.type === 'hard_stop' ? 'text-red-400' : rule.type === 'emergency' ? 'text-yellow-400' : 'text-green-400'}`}>
                        {rule.type === 'hard_stop' ? '🛑' : rule.type === 'emergency' ? '⚠️' : '🎯'} {rule.label || rule.type}
                    </span>
                    <button onClick={() => setExitRules(prev => prev.filter((_, i) => i !== idx))} className="p-0.5 hover:bg-white/5 rounded">
                        <Trash2 className="w-3 h-3 text-red-400/40" />
                    </button>
                </div>
                <div className="text-[8px] text-white/20">{rule.description}</div>
                <div className="flex gap-2 flex-wrap">
                    {rule.type === 'hard_stop' && (
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-white/30">ATR ×</span>
                            <input type="number" step="0.1" value={rule.atrMultiplier} onChange={e => updateExit(idx, 'atrMultiplier', parseFloat(e.target.value) || 1.2)}
                                className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none w-16" />
                            <span className="text-[8px] text-white/20">below entry</span>
                        </div>
                    )}
                    {rule.type === 'profit_target' && (
                        <>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-white/30">Target</span>
                                <input type="number" step="1" value={rule.percent} onChange={e => updateExit(idx, 'percent', parseFloat(e.target.value) || 20)}
                                    className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none w-14" />
                                <span className="text-[9px] text-white/30">%</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-white/30">Min hold</span>
                                <input type="number" step="1" value={rule.minHoldDays} onChange={e => updateExit(idx, 'minHoldDays', parseInt(e.target.value) || 0)}
                                    className="bg-black/40 border border-white/10 rounded py-1 px-2 text-[10px] text-white outline-none w-14" />
                                <span className="text-[9px] text-white/30">days</span>
                            </div>
                        </>
                    )}
                    {rule.type === 'emergency' && (
                        <span className="text-[9px] text-yellow-400/60 italic">Auto-triggers: Abnormal ATR + below POC</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-amber-400" /> Strategy Builder
                    {savedStrategies.length > 0 && <span className="text-[8px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">{savedStrategies.length} saved</span>}
                </h2>
                <div className="flex items-center gap-2">
                    {saveSuccess && <span className="text-[9px] text-green-400">{saveSuccess}</span>}
                    {expanded ? <ChevronDown className="w-4 h-4 text-white/30" /> : <ChevronRight className="w-4 h-4 text-white/30" />}
                </div>
            </div>

            {expanded && (
                <div className="space-y-4">
                    {/* Template Selector */}
                    <div>
                        <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider mb-2">Quick Start Templates</div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(STRATEGY_TEMPLATES).map(([name, tpl]: [string, any]) => (
                                <button key={name} onClick={() => loadTemplate(name)}
                                    className={`p-2.5 rounded-lg text-left transition-all border ${activeTemplate === name
                                        ? 'bg-purple-500/10 border-purple-500/30'
                                        : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'}`}>
                                    <div className="text-[10px] text-white font-bold">{name}</div>
                                    <div className="text-[8px] text-white/25 mt-0.5 leading-tight">{tpl.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Saved Strategies */}
                    {savedStrategies.length > 0 && (
                        <div>
                            <div className="text-[9px] text-white/30 font-bold uppercase tracking-wider mb-2">Your Saved Strategies</div>
                            <div className="flex flex-wrap gap-2">
                                {savedStrategies.map((s: any) => (
                                    <button key={s.name} onClick={() => loadSaved(s)}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] text-white/70 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all">
                                        <Target className="w-3 h-3 text-purple-400" /> {s.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Strategy Editor */}
                    {(entryRules.length > 0 || exitRules.length > 0) && (
                        <div className="space-y-4">
                            {/* Strategy Name */}
                            <div>
                                <label className="text-[9px] text-white/30 font-bold uppercase tracking-wider">Strategy Name</label>
                                <input value={strategyName} onChange={e => setStrategyName(e.target.value)} placeholder="My Strategy..."
                                    className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white outline-none focus:border-purple-500/30" />
                            </div>

                            {/* Entry Rules */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" /> Entry Rules
                                    </span>
                                    <button onClick={() => setShowAddEntry(!showAddEntry)}
                                        className="flex items-center gap-1 text-[9px] text-purple-400 hover:text-purple-300 font-bold">
                                        <Plus className="w-3 h-3" /> Add
                                    </button>
                                </div>
                                <div className="text-[8px] text-white/15 mb-2 italic">ALL conditions must be true to trigger entry</div>
                                <div className="space-y-2">
                                    {entryRules.map((rule, idx) => renderEntryRule(rule, idx))}
                                </div>
                                {/* Add entry rule dropdown */}
                                {showAddEntry && (
                                    <div className="mt-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                                        <div className="text-[8px] text-white/30 font-bold mb-1.5">Choose condition to add:</div>
                                        <div className="grid grid-cols-2 gap-1">
                                            {ENTRY_RULE_OPTIONS.map(opt => (
                                                <button key={opt.indicator} onClick={() => addEntryRule(opt)}
                                                    className="text-left p-1.5 rounded text-[9px] text-white/50 hover:bg-white/5 hover:text-white/80 transition-all">
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Exit Rules */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[9px] text-red-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Shield className="w-3 h-3" /> Exit / Risk Rules
                                    </span>
                                    <div className="flex gap-1">
                                        <button onClick={() => setExitRules(prev => [...prev, { type: 'hard_stop', label: 'Hard Stop', atrMultiplier: 1.2, description: 'ATR-based stop loss' }])}
                                            className="text-[8px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded bg-red-500/5 border border-red-500/10">+Stop</button>
                                        <button onClick={() => setExitRules(prev => [...prev, { type: 'profit_target', label: 'Profit Target', percent: 20, minHoldDays: 0, description: 'Target profit %' }])}
                                            className="text-[8px] text-green-400/60 hover:text-green-400 px-1.5 py-0.5 rounded bg-green-500/5 border border-green-500/10">+Profit</button>
                                        <button onClick={() => setExitRules(prev => [...prev, { type: 'emergency', label: 'Emergency', description: 'Abnormal ATR + below POC' }])}
                                            className="text-[8px] text-yellow-400/60 hover:text-yellow-400 px-1.5 py-0.5 rounded bg-yellow-500/5 border border-yellow-500/10">+Emergency</button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    {exitRules.map((rule, idx) => renderExitRule(rule, idx))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <button onClick={handleSave} disabled={!strategyName.trim()}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all disabled:opacity-30">
                                    <Save className="w-3.5 h-3.5" /> Save Strategy
                                </button>
                                <button onClick={handleEvaluate} disabled={!strategyName.trim() || evalLoading}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-30">
                                    {evalLoading ? <Settings className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                                    Run on {pair}
                                </button>
                            </div>

                            {/* Evaluation Results */}
                            {evaluation && !evaluation.error && (
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
                                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider">Evaluation Results — {pair}</div>
                                    {evaluation.signals && evaluation.signals.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {evaluation.signals.map((sig: any, i: number) => (
                                                <div key={i} className={`p-2 rounded-lg flex items-start gap-2 ${sig.type === 'entry' ? 'bg-green-500/10 border border-green-500/20' :
                                                        sig.urgent ? 'bg-red-500/10 border border-red-500/20' :
                                                            'bg-amber-500/10 border border-amber-500/20'
                                                    }`}>
                                                    {sig.type === 'entry' ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" /> :
                                                        sig.urgent ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" /> :
                                                            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                                                    <div>
                                                        <div className={`text-[10px] font-bold ${sig.type === 'entry' ? 'text-green-400' : sig.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                                                            {sig.type === 'entry' ? '📈 ENTRY SIGNAL' : sig.type.includes('stop') ? '🛑 STOP HIT' : sig.type.includes('profit') ? '🎯 TARGET REACHED' : '⚠️ EXIT SIGNAL'}
                                                        </div>
                                                        <div className="text-[9px] text-white/50">{sig.message}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-[10px] text-white/30 text-center py-2 italic">
                                            No signals right now — conditions not all met. {evaluation.openPositions > 0 ? `(${evaluation.openPositions} open position${evaluation.openPositions > 1 ? 's' : ''})` : ''}
                                        </div>
                                    )}
                                    {evaluation.indicators && (
                                        <div className="pt-2 border-t border-white/[0.04] grid grid-cols-4 gap-2 text-center">
                                            <div>
                                                <div className="text-[7px] text-white/20">PRICE</div>
                                                <div className="text-[10px] text-white font-bold">${evaluation.indicators.price?.toFixed(2)}</div>
                                            </div>
                                            <div>
                                                <div className="text-[7px] text-white/20">RSI</div>
                                                <div className={`text-[10px] font-bold ${evaluation.indicators.rsi?.zone === 'oversold' ? 'text-green-400' : evaluation.indicators.rsi?.zone === 'overbought' ? 'text-red-400' : 'text-white'}`}>
                                                    {evaluation.indicators.rsi?.current?.toFixed(1)}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-[7px] text-white/20">STAGE</div>
                                                <div className="text-[10px] text-white font-bold">{evaluation.indicators.ladder?.stage}</div>
                                            </div>
                                            <div>
                                                <div className="text-[7px] text-white/20">ATR</div>
                                                <div className={`text-[10px] font-bold ${evaluation.indicators.atr?.abnormal ? 'text-red-400' : 'text-white'}`}>
                                                    {evaluation.indicators.atr?.current?.toFixed(3)}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {evaluation?.error && (
                                <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-[10px] text-red-400">{evaluation.error}</div>
                            )}
                        </div>
                    )}

                    {/* Empty state */}
                    {entryRules.length === 0 && exitRules.length === 0 && (
                        <div className="text-[10px] text-white/20 text-center py-4 italic">
                            Choose a template above to get started, or load a saved strategy
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StrategyBuilder;
