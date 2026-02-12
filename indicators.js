/**
 * indicators.js — Technical Indicator Library for Solana Trader
 * 
 * Pure-math calculations for:
 *   ATR (Average True Range) + Abnormal detection
 *   RSI (Relative Strength Index)
 *   EMA (Exponential Moving Average)
 *   AVWAP (Anchored VWAP) — dual anchors
 *   Volume Profile (POC, VAH, VAL)
 *   Ladder / Stage detection
 * 
 * All functions take OHLCV arrays: [{ o, h, l, c, v, t }, ...]
 * Candles are sorted oldest → newest (index 0 = oldest).
 */

// ─────────────────────────────────────────────────────────────────
//  ATR — Average True Range
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate ATR (Wilder's smoothing)
 * @param {Array} candles - OHLCV candles
 * @param {number} period - ATR period (default 14)
 * @returns {{ values: number[], current: number, abnormal: boolean, abnormalThreshold: number }}
 */
function calcATR(candles, period = 14) {
    if (candles.length < period + 1) return { values: [], current: 0, abnormal: false, abnormalThreshold: 0 };

    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
        const tr = Math.max(
            candles[i].h - candles[i].l,
            Math.abs(candles[i].h - candles[i - 1].c),
            Math.abs(candles[i].l - candles[i - 1].c)
        );
        trueRanges.push(tr);
    }

    // Wilder's smoothed ATR
    const atrValues = [];
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrValues.push(atr);

    for (let i = period; i < trueRanges.length; i++) {
        atr = (atr * (period - 1) + trueRanges[i]) / period;
        atrValues.push(atr);
    }

    const current = atrValues[atrValues.length - 1] || 0;
    // Abnormal = current TR > 2x ATR
    const lastTR = trueRanges[trueRanges.length - 1] || 0;
    const abnormalThreshold = current * 2;
    const abnormal = lastTR > abnormalThreshold;

    return { values: atrValues, current, abnormal, abnormalThreshold, lastTR };
}

/**
 * Calculate ATR-based zones around a price (bands)
 * @param {number} price - Center price
 * @param {number} atr - Current ATR
 * @param {number[]} multipliers - Zone multipliers (default [1, 2, 3])
 * @returns {{ upper: number[], lower: number[] }}
 */
function atrZones(price, atr, multipliers = [1, 2, 3]) {
    return {
        upper: multipliers.map(m => price + m * atr),
        lower: multipliers.map(m => price - m * atr),
    };
}


// ─────────────────────────────────────────────────────────────────
//  RSI — Relative Strength Index
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate RSI
 * @param {Array} candles - OHLCV candles
 * @param {number} period - RSI period (default 14)
 * @returns {{ values: number[], current: number, zone: 'oversold'|'neutral'|'overbought' }}
 */
function calcRSI(candles, period = 14) {
    if (candles.length < period + 1) return { values: [], current: 50, zone: 'neutral' };

    const changes = [];
    for (let i = 1; i < candles.length; i++) {
        changes.push(candles[i].c - candles[i - 1].c);
    }

    let avgGain = 0, avgLoss = 0;
    for (let i = 0; i < period; i++) {
        if (changes[i] > 0) avgGain += changes[i];
        else avgLoss += Math.abs(changes[i]);
    }
    avgGain /= period;
    avgLoss /= period;

    const rsiValues = [];
    let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));

    for (let i = period; i < changes.length; i++) {
        const gain = changes[i] > 0 ? changes[i] : 0;
        const loss = changes[i] < 0 ? Math.abs(changes[i]) : 0;
        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;
        rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiValues.push(100 - 100 / (1 + rs));
    }

    const current = rsiValues[rsiValues.length - 1] || 50;
    const zone = current >= 70 ? 'overbought' : current <= 30 ? 'oversold' : 'neutral';

    return { values: rsiValues, current, zone };
}


// ─────────────────────────────────────────────────────────────────
//  EMA — Exponential Moving Average
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate EMA
 * @param {Array} candles - OHLCV candles (uses close)
 * @param {number} period - EMA period
 * @returns {{ values: number[], current: number }}
 */
function calcEMA(candles, period) {
    if (candles.length < period) return { values: [], current: 0 };

    const closes = candles.map(c => c.c);
    const k = 2 / (period + 1);

    // Seed with SMA
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    const emaValues = [ema];

    for (let i = period; i < closes.length; i++) {
        ema = closes[i] * k + ema * (1 - k);
        emaValues.push(ema);
    }

    return { values: emaValues, current: emaValues[emaValues.length - 1] || 0 };
}


// ─────────────────────────────────────────────────────────────────
//  AVWAP — Anchored VWAP (dual)
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate AVWAP from a specific candle index anchor
 * @param {Array} candles - OHLCV candles
 * @param {number} anchorIndex - index to anchor from
 * @returns {{ values: number[], current: number }}
 */
function calcAVWAP(candles, anchorIndex) {
    if (anchorIndex < 0 || anchorIndex >= candles.length) return { values: [], current: 0 };

    let cumVol = 0;
    let cumPV = 0;
    const values = [];

    for (let i = anchorIndex; i < candles.length; i++) {
        const typicalPrice = (candles[i].h + candles[i].l + candles[i].c) / 3;
        const vol = candles[i].v || 1; // avoid div by zero
        cumVol += vol;
        cumPV += typicalPrice * vol;
        values.push(cumPV / cumVol);
    }

    return { values, current: values[values.length - 1] || 0 };
}

/**
 * Find the index of the lowest low in a lookback window
 * @param {Array} candles
 * @param {number} lookback - number of bars back
 * @returns {number} index of lowest low
 */
function findLowestLowIndex(candles, lookback) {
    const start = Math.max(0, candles.length - lookback);
    let minIdx = start;
    let minLow = candles[start].l;
    for (let i = start + 1; i < candles.length; i++) {
        if (candles[i].l < minLow) {
            minLow = candles[i].l;
            minIdx = i;
        }
    }
    return minIdx;
}

/**
 * Dual AVWAP: major low anchor (long lookback) + current low anchor (short lookback)
 * @param {Array} candles
 * @param {number} majorLookback - bars for major low (default 400)
 * @param {number} currentLookback - bars for current low (default 63)
 * @returns {{ major: { current, values, anchorIndex }, current: { current, values, anchorIndex } }}
 */
function dualAVWAP(candles, majorLookback = 400, currentLookback = 63) {
    const majorIdx = findLowestLowIndex(candles, Math.min(majorLookback, candles.length));
    const currentIdx = findLowestLowIndex(candles, Math.min(currentLookback, candles.length));

    return {
        major: { ...calcAVWAP(candles, majorIdx), anchorIndex: majorIdx, anchorPrice: candles[majorIdx].l },
        current: { ...calcAVWAP(candles, currentIdx), anchorIndex: currentIdx, anchorPrice: candles[currentIdx].l },
    };
}


// ─────────────────────────────────────────────────────────────────
//  Volume Profile — POC, VAH, VAL
// ─────────────────────────────────────────────────────────────────

/**
 * Calculate Volume Profile from candles
 * @param {Array} candles - OHLCV candles
 * @param {number} numBins - price bins (default 50)
 * @param {number} valueAreaPct - value area percentage (default 0.70 = 70%)
 * @returns {{ poc: number, vah: number, val: number, bins: Array }}
 */
function calcVolumeProfile(candles, numBins = 50, valueAreaPct = 0.70) {
    if (candles.length === 0) return { poc: 0, vah: 0, val: 0, bins: [] };

    // Find price range
    let priceHigh = -Infinity, priceLow = Infinity;
    for (const c of candles) {
        if (c.h > priceHigh) priceHigh = c.h;
        if (c.l < priceLow) priceLow = c.l;
    }

    if (priceHigh === priceLow) return { poc: priceHigh, vah: priceHigh, val: priceLow, bins: [] };

    const binSize = (priceHigh - priceLow) / numBins;
    const bins = Array.from({ length: numBins }, (_, i) => ({
        priceLow: priceLow + i * binSize,
        priceHigh: priceLow + (i + 1) * binSize,
        priceMid: priceLow + (i + 0.5) * binSize,
        volume: 0,
    }));

    // Distribute volume across bins
    for (const c of candles) {
        const vol = c.v || 1;
        // Distribute candle volume evenly across bins that the candle touches
        const lowBin = Math.max(0, Math.floor((c.l - priceLow) / binSize));
        const highBin = Math.min(numBins - 1, Math.floor((c.h - priceLow) / binSize));
        const binsHit = highBin - lowBin + 1;
        const perBin = vol / binsHit;
        for (let b = lowBin; b <= highBin; b++) {
            bins[b].volume += perBin;
        }
    }

    // Find POC (bin with most volume)
    let pocIdx = 0;
    let maxVol = 0;
    for (let i = 0; i < bins.length; i++) {
        if (bins[i].volume > maxVol) {
            maxVol = bins[i].volume;
            pocIdx = i;
        }
    }

    const poc = bins[pocIdx].priceMid;

    // Value Area: expand from POC until 70% of total volume
    const totalVol = bins.reduce((s, b) => s + b.volume, 0);
    const targetVol = totalVol * valueAreaPct;
    let vaVol = bins[pocIdx].volume;
    let vaLow = pocIdx;
    let vaHigh = pocIdx;

    while (vaVol < targetVol && (vaLow > 0 || vaHigh < bins.length - 1)) {
        const tryLow = vaLow > 0 ? bins[vaLow - 1].volume : -1;
        const tryHigh = vaHigh < bins.length - 1 ? bins[vaHigh + 1].volume : -1;

        if (tryLow >= tryHigh && tryLow >= 0) {
            vaLow--;
            vaVol += bins[vaLow].volume;
        } else if (tryHigh >= 0) {
            vaHigh++;
            vaVol += bins[vaHigh].volume;
        } else {
            break;
        }
    }

    return {
        poc,
        vah: bins[vaHigh].priceHigh,
        val: bins[vaLow].priceLow,
        bins: bins.map(b => ({ price: b.priceMid, volume: b.volume })),
    };
}


// ─────────────────────────────────────────────────────────────────
//  Ladder / Stage Detection (simplified from Script A)
// ─────────────────────────────────────────────────────────────────

/**
 * Detect ladder stage based on swing highs/lows
 * Stage 0 = no structure
 * Stage 1 = first swing (#1 landmark)
 * Stage 2+ = confirmed structure (higher lows / lower highs pattern)
 * 
 * @param {Array} candles
 * @param {number} lookback - bars to analyze (default 20)
 * @returns {{ stage: number, landmarks: Array }}
 */
function detectLadderStage(candles, lookback = 20) {
    if (candles.length < lookback) return { stage: 0, landmarks: [] };

    const subset = candles.slice(-lookback);
    const landmarks = [];
    let stage = 0;

    // Find swing lows and highs (simple 3-bar pivot)
    for (let i = 2; i < subset.length - 2; i++) {
        const isSwingLow = subset[i].l < subset[i - 1].l && subset[i].l < subset[i - 2].l &&
            subset[i].l < subset[i + 1].l && subset[i].l < subset[i + 2].l;
        const isSwingHigh = subset[i].h > subset[i - 1].h && subset[i].h > subset[i - 2].h &&
            subset[i].h > subset[i + 1].h && subset[i].h > subset[i + 2].h;

        if (isSwingLow) landmarks.push({ type: 'low', price: subset[i].l, index: i });
        if (isSwingHigh) landmarks.push({ type: 'high', price: subset[i].h, index: i });
    }

    // Determine stage from landmark count and pattern
    const lows = landmarks.filter(l => l.type === 'low');
    const highs = landmarks.filter(l => l.type === 'high');

    if (lows.length >= 1) stage = 1; // #1
    if (lows.length >= 2 || (lows.length >= 1 && highs.length >= 1)) stage = 2; // #2

    // Higher stage if we see higher lows (bullish structure)
    if (lows.length >= 2) {
        const isHigherLow = lows[lows.length - 1].price > lows[lows.length - 2].price;
        if (isHigherLow && highs.length >= 1) stage = 3;
    }

    return { stage, landmarks };
}


// ─────────────────────────────────────────────────────────────────
//  Diamond Detection (simplified from Script A)
// ─────────────────────────────────────────────────────────────────

/**
 * Detect diamond signals (flush / stop-run after stage ≥ 2)
 * Purple diamond: RSI < 30 (best long signal)
 * Green diamond: RSI 30-50 (acceptable)
 * Red diamond: RSI > 69 (avoid longs)
 * 
 * @param {Array} candles
 * @param {{ stage: number }} ladder
 * @param {{ current: number }} rsi
 * @returns {{ hasDiamond: boolean, color: 'purple'|'green'|'red'|'none', barIndex: number }}
 */
function detectDiamond(candles, ladder, rsi) {
    if (ladder.stage < 2 || candles.length < 5) {
        return { hasDiamond: false, color: 'none', barIndex: -1 };
    }

    // Look at last 5 bars for a new lower low after structure
    const recent = candles.slice(-5);
    const lows = candles.slice(-20).map(c => c.l);
    const prevMinLow = Math.min(...lows.slice(0, -5));

    // Check if any recent bar made a lower low (flush)
    for (let i = 0; i < recent.length; i++) {
        if (recent[i].l < prevMinLow) {
            let color = 'green';
            if (rsi.current < 30) color = 'purple';
            else if (rsi.current > 69) color = 'red';

            return {
                hasDiamond: true,
                color,
                barIndex: candles.length - 5 + i,
                price: recent[i].l,
            };
        }
    }

    return { hasDiamond: false, color: 'none', barIndex: -1 };
}


// ─────────────────────────────────────────────────────────────────
//  Master: Compute All Indicators
// ─────────────────────────────────────────────────────────────────

/**
 * Compute all indicators from OHLCV candles
 * @param {Array} candles - OHLCV candles sorted oldest → newest
 * @param {Object} config - optional config overrides
 * @returns {Object} all indicator values
 */
function computeAll(candles, config = {}) {
    const atrPeriod = config.atrPeriod || 14;
    const rsiPeriod = config.rsiPeriod || 14;
    const emaPeriods = config.emaPeriods || [20, 50, 200];
    const vpBins = config.vpBins || 50;
    const vpLookback = config.vpLookback || candles.length; // use all candles for profile
    const avwapMajorLookback = config.avwapMajorLookback || 400;
    const avwapCurrentLookback = config.avwapCurrentLookback || 63;

    const atr = calcATR(candles, atrPeriod);
    const rsi = calcRSI(candles, rsiPeriod);
    const emas = {};
    for (const p of emaPeriods) {
        emas[`ema${p}`] = calcEMA(candles, p);
    }
    const avwap = dualAVWAP(candles, avwapMajorLookback, avwapCurrentLookback);
    const vpCandles = candles.slice(-Math.min(vpLookback, candles.length));
    const vp = calcVolumeProfile(vpCandles, vpBins);
    const ladder = detectLadderStage(candles);
    const diamond = detectDiamond(candles, ladder, rsi);

    const lastCandle = candles[candles.length - 1] || {};
    const price = lastCandle.c || 0;

    // Price relative to key levels
    const priceVsVAL = vp.val > 0 ? (price - vp.val) / vp.val : 0;
    const priceVsPOC = vp.poc > 0 ? (price - vp.poc) / vp.poc : 0;
    const priceVsVAH = vp.vah > 0 ? (price - vp.vah) / vp.vah : 0;

    // ATR zones around current AVWAP
    const avwapZones = atr.current > 0 ? atrZones(avwap.current.current, atr.current) : null;

    return {
        price,
        timestamp: lastCandle.t || null,
        atr: { current: atr.current, abnormal: atr.abnormal, lastTR: atr.lastTR },
        rsi: { current: rsi.current, zone: rsi.zone },
        emas: Object.fromEntries(Object.entries(emas).map(([k, v]) => [k, v.current])),
        avwap: {
            major: { current: avwap.major.current, anchorPrice: avwap.major.anchorPrice },
            current: { current: avwap.current.current, anchorPrice: avwap.current.anchorPrice },
        },
        avwapZones,
        vp: { poc: vp.poc, vah: vp.vah, val: vp.val },
        ladder: { stage: ladder.stage, landmarkCount: ladder.landmarks.length },
        diamond: { hasDiamond: diamond.hasDiamond, color: diamond.color, price: diamond.price },
        priceRelative: { vsVAL: priceVsVAL, vsPOC: priceVsPOC, vsVAH: priceVsVAH },
    };
}

module.exports = {
    calcATR, atrZones,
    calcRSI,
    calcEMA,
    calcAVWAP, dualAVWAP, findLowestLowIndex,
    calcVolumeProfile,
    detectLadderStage,
    detectDiamond,
    computeAll,
};
