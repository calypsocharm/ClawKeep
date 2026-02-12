import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time, ColorType, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { BarChart3, RefreshCw, AlertTriangle, Code2, Play, X } from 'lucide-react';
import { gatewayService } from '../services/gatewayService';
import { userScopeService } from '../services/userScopeService';

// ─── Types ────────────────────────────────────────────────
interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
interface IndicatorData {
    price: number;
    pair: string;
    timeframe: string;
    candleCount: number;
    rsi: { current: number; values: number[]; zone: string };
    ema: { ema9: { values: number[]; current: number }; ema21: { values: number[]; current: number }; ema50: { values: number[]; current: number } };
    atr: { current: number; values: number[]; abnormal: boolean; abnormalThreshold: number };
    vp: { poc: number; vah: number; val: number };
    avwap: { major: { current: number; values: number[] }; current: { current: number; values: number[] } };
    ladder: { stage: number; landmarks: any[] };
    diamond: { hasDiamond: boolean; color: string };
    bollingerBands?: { upper: number[]; middle: number[]; lower: number[] };
    macd?: { macd: number[]; signal: number[]; histogram: number[] };
    error?: string;
}

const TIMEFRAMES = [
    { label: '1m', value: 'minute' },
    { label: '1h', value: 'hour' },
    { label: '1D', value: 'day' },
];

const PAIRS = ['SOL/USDC', 'SOL/USDT'];

const INDICATOR_COLORS = {
    ema9: '#00d4aa',
    ema21: '#f59e0b',
    ema50: '#a855f7',
    poc: '#ff6b6b',
    vah: '#4ecdc4',
    val: '#45b7d1',
    avwapMajor: '#ff9ff3',
    avwapCurrent: '#54a0ff',
    volume: 'rgba(0, 212, 170, 0.15)',
    volumeDown: 'rgba(255, 107, 107, 0.15)',
};

// ─── Chart View ───────────────────────────────────────────
const ChartView: React.FC = () => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
    const indicatorSeriesRefs = useRef<Map<string, ISeriesApi<any>>>(new Map());

    const [pair, setPair] = useState('SOL/USDC');
    const [timeframe, setTimeframe] = useState('day');
    const [candles, setCandles] = useState<Candle[]>([]);
    const [indicators, setIndicators] = useState<IndicatorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Indicator toggles
    const [showEMA, setShowEMA] = useState(true);
    const [showVP, setShowVP] = useState(true);
    const [showAVWAP, setShowAVWAP] = useState(false);
    const [showVolume, setShowVolume] = useState(true);

    // Script editor
    const [showScriptEditor, setShowScriptEditor] = useState(false);
    const [scriptCode, setScriptCode] = useState(() => userScopeService.scopedGet('chart_script') || '// Custom indicator script\n// Available: ema(period), sma(period), rsi(period)\n// plot(values, label, color)\n');
    const [scriptError, setScriptError] = useState<string | null>(null);

    // ─── Subscribe to WS trader events for chart data ──────
    useEffect(() => {
        const unsub = gatewayService.subscribeTrader((data: any) => {
            if (data.type === 'TRADER_CANDLES') {
                if (data.error) {
                    setError(data.error);
                } else if (data.candles) {
                    setCandles(data.candles);
                }
                setLoading(false);
            }
            if (data.type === 'TRADER_INDICATORS') {
                if (!data.error) {
                    setIndicators(data);
                }
            }
        });
        return () => unsub();
    }, []);

    // ─── Fetch data via gateway commands ──────────────────
    const fetchData = useCallback(() => {
        setLoading(true);
        setError(null);
        gatewayService.traderGetCandles(pair, timeframe, 300);
        gatewayService.traderGetIndicators(pair, timeframe);
    }, [pair, timeframe]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Initialize Chart ───────────────────────────────────
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#0a0e1a' },
                textColor: 'rgba(255,255,255,0.3)',
                fontSize: 11,
            },
            grid: {
                vertLines: { color: 'rgba(255,255,255,0.03)' },
                horzLines: { color: 'rgba(255,255,255,0.03)' },
            },
            crosshair: {
                vertLine: { color: 'rgba(0,212,170,0.3)', width: 1, style: 2 },
                horzLine: { color: 'rgba(0,212,170,0.3)', width: 1, style: 2 },
            },
            rightPriceScale: {
                borderColor: 'rgba(255,255,255,0.06)',
            },
            timeScale: {
                borderColor: 'rgba(255,255,255,0.06)',
                timeVisible: true,
                secondsVisible: false,
            },
            handleScroll: { vertTouchDrag: false },
        });

        chartRef.current = chart;

        // Candlestick series (v5 API)
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#00d4aa',
            downColor: '#ff4757',
            borderUpColor: '#00d4aa',
            borderDownColor: '#ff4757',
            wickUpColor: '#00d4aa',
            wickDownColor: '#ff4757',
        });
        candleSeriesRef.current = candleSeries;

        // Volume histogram (v5 API)
        const volumeSeries = chart.addSeries(HistogramSeries, {
            color: INDICATOR_COLORS.volume,
            priceFormat: { type: 'volume' },
            priceScaleId: 'volume',
        });
        chart.priceScale('volume').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 },
        });
        volumeSeriesRef.current = volumeSeries;

        // Resize handler
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                chart.applyOptions({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height,
                });
            }
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
            chartRef.current = null;
            indicatorSeriesRefs.current.clear();
        };
    }, []);

    // ─── Update Chart Data ──────────────────────────────────
    useEffect(() => {
        if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

        const candleData: CandlestickData[] = candles.map(c => ({
            time: (c.t / 1000) as Time, // Unix seconds
            open: c.o,
            high: c.h,
            low: c.l,
            close: c.c,
        }));

        const volumeData: HistogramData[] = candles.map(c => ({
            time: (c.t / 1000) as Time,
            value: c.v,
            color: c.c >= c.o ? INDICATOR_COLORS.volume : INDICATOR_COLORS.volumeDown,
        }));

        candleSeriesRef.current.setData(candleData);
        if (showVolume) volumeSeriesRef.current.setData(volumeData);
        else volumeSeriesRef.current.setData([]);

        chartRef.current?.timeScale().fitContent();
    }, [candles, showVolume]);

    // ─── Update Indicator Overlays ──────────────────────────
    useEffect(() => {
        if (!chartRef.current || !indicators || candles.length === 0) return;
        const chart = chartRef.current;

        // Clear old indicator series
        indicatorSeriesRefs.current.forEach((series) => {
            try { chart.removeSeries(series); } catch { }
        });
        indicatorSeriesRefs.current.clear();

        const addLineSeries = (key: string, values: number[], color: string, lineWidth: number = 1, lineStyle: number = 0) => {
            if (!values || values.length === 0) return;
            const series = chart.addSeries(LineSeries, {
                color,
                lineWidth: lineWidth as any,
                lineStyle,
                priceLineVisible: false,
                lastValueVisible: false,
                crosshairMarkerVisible: false,
            });

            // Align values to candle timestamps (values may be shorter due to lookback)
            const offset = candles.length - values.length;
            const data: LineData[] = values.map((v, i) => ({
                time: (candles[i + offset]?.t / 1000) as Time,
                value: v,
            })).filter(d => d.value !== undefined && !isNaN(d.value) && d.time);

            series.setData(data);
            indicatorSeriesRefs.current.set(key, series);
        };

        // EMA lines
        if (showEMA && indicators.ema) {
            if (indicators.ema.ema9?.values) addLineSeries('ema9', indicators.ema.ema9.values, INDICATOR_COLORS.ema9, 1);
            if (indicators.ema.ema21?.values) addLineSeries('ema21', indicators.ema.ema21.values, INDICATOR_COLORS.ema21, 1);
            if (indicators.ema.ema50?.values) addLineSeries('ema50', indicators.ema.ema50.values, INDICATOR_COLORS.ema50, 2);
        }

        // Volume Profile levels (horizontal price lines)
        if (showVP && indicators.vp) {
            const { poc, vah, val } = indicators.vp;
            if (candleSeriesRef.current) {
                candleSeriesRef.current.createPriceLine({
                    price: poc, color: INDICATOR_COLORS.poc, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'POC',
                });
                candleSeriesRef.current.createPriceLine({
                    price: vah, color: INDICATOR_COLORS.vah, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'VAH',
                });
                candleSeriesRef.current.createPriceLine({
                    price: val, color: INDICATOR_COLORS.val, lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'VAL',
                });
            }
        }

        // AVWAP lines
        if (showAVWAP && indicators.avwap) {
            if (indicators.avwap.major?.values) addLineSeries('avwapMajor', indicators.avwap.major.values, INDICATOR_COLORS.avwapMajor, 1, 2);
            if (indicators.avwap.current?.values) addLineSeries('avwapCurrent', indicators.avwap.current.values, INDICATOR_COLORS.avwapCurrent, 1, 2);
        }

    }, [indicators, candles, showEMA, showVP, showAVWAP]);

    // ─── Script Execution ───────────────────────────────────
    const runScript = useCallback(() => {
        if (!chartRef.current || candles.length === 0) return;
        setScriptError(null);
        userScopeService.scopedSet('chart_script', scriptCode);

        try {
            const closes = candles.map(c => c.c);
            const highs = candles.map(c => c.h);
            const lows = candles.map(c => c.l);
            const volumes = candles.map(c => c.v);
            const times = candles.map(c => c.t / 1000);

            const ema = (period: number) => {
                const k = 2 / (period + 1);
                const result: number[] = [closes[0]];
                for (let i = 1; i < closes.length; i++) {
                    result.push(closes[i] * k + result[i - 1] * (1 - k));
                }
                return result;
            };

            const sma = (period: number) => {
                const result: number[] = [];
                for (let i = 0; i < closes.length; i++) {
                    if (i < period - 1) { result.push(NaN); continue; }
                    const slice = closes.slice(i - period + 1, i + 1);
                    result.push(slice.reduce((a, b) => a + b, 0) / period);
                }
                return result;
            };

            const rsi = (period: number = 14) => {
                const changes = closes.map((c, i) => i === 0 ? 0 : c - closes[i - 1]);
                let avgGain = 0, avgLoss = 0;
                const result: number[] = [];
                for (let i = 0; i < changes.length; i++) {
                    if (i < period) { result.push(NaN); continue; }
                    if (i === period) {
                        avgGain = changes.slice(1, period + 1).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
                        avgLoss = Math.abs(changes.slice(1, period + 1).filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
                    } else {
                        avgGain = (avgGain * (period - 1) + Math.max(0, changes[i])) / period;
                        avgLoss = (avgLoss * (period - 1) + Math.abs(Math.min(0, changes[i]))) / period;
                    }
                    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
                    result.push(100 - 100 / (1 + rs));
                }
                return result;
            };

            const plots: Array<{ values: number[], label: string, color: string }> = [];
            const plot = (values: number[], label: string = 'Custom', color: string = '#00ffaa') => {
                plots.push({ values, label, color });
            };

            const fn = new Function('close', 'high', 'low', 'volume', 'time', 'ema', 'sma', 'rsi', 'plot', scriptCode);
            fn(closes, highs, lows, volumes, times, ema, sma, rsi, plot);

            // Remove old script series
            indicatorSeriesRefs.current.forEach((series, key) => {
                if (key.startsWith('script_')) {
                    try { chartRef.current?.removeSeries(series); } catch { }
                    indicatorSeriesRefs.current.delete(key);
                }
            });

            // Add new script series
            plots.forEach((p, i) => {
                const series = chartRef.current!.addSeries(LineSeries, {
                    color: p.color,
                    lineWidth: 2,
                    title: p.label,
                    priceLineVisible: false,
                    lastValueVisible: true,
                });
                const data: LineData[] = p.values.map((v, j) => ({
                    time: (candles[j]?.t / 1000) as Time,
                    value: v,
                })).filter(d => !isNaN(d.value) && d.time);
                series.setData(data);
                indicatorSeriesRefs.current.set(`script_${i}`, series);
            });

        } catch (e: any) {
            setScriptError(e.message);
        }
    }, [scriptCode, candles]);

    return (
        <div className="h-full flex flex-col bg-[#060a10]">
            {/* Chart Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                        <h1 className="text-sm font-bold text-white">Chart</h1>
                    </div>

                    {/* Pair Selector */}
                    <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-0.5">
                        {PAIRS.map(p => (
                            <button key={p} onClick={() => setPair(p)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${pair === p ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/30 hover:text-white/50'}`}>
                                {p}
                            </button>
                        ))}
                    </div>

                    {/* Timeframe Selector */}
                    <div className="flex items-center gap-1 bg-white/[0.04] rounded-xl p-0.5">
                        {TIMEFRAMES.map(tf => (
                            <button key={tf.value} onClick={() => setTimeframe(tf.value)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${timeframe === tf.value ? 'bg-purple-500/20 text-purple-400' : 'text-white/30 hover:text-white/50'}`}>
                                {tf.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Indicator Toggles */}
                    {[
                        { label: 'EMA', active: showEMA, toggle: () => setShowEMA(!showEMA), color: 'emerald' },
                        { label: 'VP', active: showVP, toggle: () => setShowVP(!showVP), color: 'red' },
                        { label: 'AVWAP', active: showAVWAP, toggle: () => setShowAVWAP(!showAVWAP), color: 'pink' },
                        { label: 'VOL', active: showVolume, toggle: () => setShowVolume(!showVolume), color: 'blue' },
                    ].map(ind => (
                        <button key={ind.label} onClick={ind.toggle} className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all border ${ind.active ? `bg-${ind.color}-500/15 border-${ind.color}-500/30 text-${ind.color}-400` : 'bg-white/[0.02] border-white/[0.06] text-white/20'}`}>
                            {ind.label}
                        </button>
                    ))}

                    {/* Script Editor Toggle */}
                    <button onClick={() => setShowScriptEditor(!showScriptEditor)} className={`p-2 rounded-lg transition-all ${showScriptEditor ? 'bg-amber-500/15 text-amber-400' : 'text-white/20 hover:text-white/40 hover:bg-white/[0.04]'}`} title="Custom Scripts">
                        <Code2 className="w-4 h-4" />
                    </button>

                    <button onClick={fetchData} className={`p-2 rounded-lg text-white/20 hover:text-white/40 hover:bg-white/[0.04] transition-all ${loading ? 'animate-spin' : ''}`}>
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Indicator Summary Bar */}
            {indicators && (
                <div className="flex items-center gap-4 px-5 py-2 border-b border-white/[0.04] bg-white/[0.01] shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white/20 uppercase">Price</span>
                        <span className="text-xs font-bold text-white">${indicators.price?.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white/20 uppercase">RSI</span>
                        <span className={`text-xs font-bold ${indicators.rsi?.zone === 'oversold' ? 'text-emerald-400' : indicators.rsi?.zone === 'overbought' ? 'text-red-400' : 'text-white/60'}`}>
                            {indicators.rsi?.current?.toFixed(1)}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white/20 uppercase">ATR</span>
                        <span className={`text-xs font-bold ${indicators.atr?.abnormal ? 'text-amber-400' : 'text-white/60'}`}>
                            {indicators.atr?.current?.toFixed(2)} {indicators.atr?.abnormal ? '⚠️' : ''}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white/20 uppercase">Stage</span>
                        <span className="text-xs font-bold text-purple-400">{indicators.ladder?.stage || 0}</span>
                    </div>
                    {indicators.diamond?.hasDiamond && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-amber-400">💎 {indicators.diamond.color}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-white/20 uppercase">POC</span>
                        <span className="text-xs font-bold text-red-400">${indicators.vp?.poc?.toFixed(2)}</span>
                    </div>
                </div>
            )}

            {/* Main Chart Area */}
            <div className="flex-1 relative">
                {loading && candles.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#060a10]/80">
                        <div className="flex items-center gap-3 text-white/30">
                            <RefreshCw className="w-5 h-5 animate-spin" />
                            <span className="text-sm">Loading chart data...</span>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}
                <div ref={chartContainerRef} className="w-full h-full" />
            </div>

            {/* Script Editor Panel */}
            {showScriptEditor && (
                <div className="border-t border-white/[0.06] bg-[#0a0e1a] shrink-0" style={{ height: '200px' }}>
                    <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
                        <div className="flex items-center gap-2">
                            <Code2 className="w-4 h-4 text-amber-400" />
                            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Custom Script</span>
                        </div>
                        <div className="flex items-center gap-2">
                            {scriptError && (
                                <span className="text-[10px] text-red-400 max-w-[200px] truncate">{scriptError}</span>
                            )}
                            <button onClick={runScript} className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-500/25 transition-all">
                                <Play className="w-3 h-3" /> Run
                            </button>
                            <button onClick={() => setShowScriptEditor(false)} className="p-1 text-white/20 hover:text-white/40 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={scriptCode}
                        onChange={(e) => setScriptCode(e.target.value)}
                        className="w-full h-[calc(100%-36px)] bg-transparent text-xs text-white/70 font-mono p-4 resize-none focus:outline-none"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#ffffff10 transparent' }}
                        placeholder="// Write your indicator script here..."
                        spellCheck={false}
                    />
                </div>
            )}
        </div>
    );
};

export default ChartView;
