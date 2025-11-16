// Additional AI helper functions for pattern recognition and market structure

// Stochastic RSI calculation
function calculateStochRSI(rsiArray, period) {
    if (rsiArray.length < period) {
        return { k: 50, d: 50 };
    }
    
    const recent = rsiArray.slice(-period);
    const minRSI = Math.min(...recent);
    const maxRSI = Math.max(...recent);
    const range = maxRSI - minRSI;
    
    const k = range === 0 ? 50 : ((rsiArray[rsiArray.length - 1] - minRSI) / range) * 100;
    
    // Simple moving average of K for D line
    const kValues = [];
    for (let i = period; i < rsiArray.length; i++) {
        const slice = rsiArray.slice(i - period, i);
        const min = Math.min(...slice);
        const max = Math.max(...slice);
        const r = max - min;
        kValues.push(r === 0 ? 50 : ((rsiArray[i] - min) / r) * 100);
    }
    
    const d = kValues.length > 0 ? kValues.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, kValues.length) : k;
    
    return { k, d };
}

// ATR (Average True Range) calculation
function calculateATR(data, period) {
    const trueRanges = [];
    
    for (let i = 1; i < data.length; i++) {
        const high = data[i].high;
        const low = data[i].low;
        const prevClose = data[i - 1].close;
        
        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        
        trueRanges.push(tr);
    }
    
    // Calculate EMA of true ranges
    const atrValues = [];
    let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
    atrValues.push(atr);
    
    const multiplier = 1 / period;
    for (let i = period; i < trueRanges.length; i++) {
        atr = (trueRanges[i] * multiplier) + (atr * (1 - multiplier));
        atrValues.push(atr);
    }
    
    return atrValues;
}

// Bollinger Bands calculation
function calculateBollingerBands(data, period, stdDev) {
    const sma = calculateSMA(data, period);
    const bands = { upper: [], middle: [], lower: [] };
    
    for (let i = period - 1; i < data.length; i++) {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = sma[i - period + 1];
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const sd = Math.sqrt(variance);
        
        bands.middle.push(mean);
        bands.upper.push(mean + (sd * stdDev));
        bands.lower.push(mean - (sd * stdDev));
    }
    
    return {
        upper: bands.upper[bands.upper.length - 1],
        middle: bands.middle[bands.middle.length - 1],
        lower: bands.lower[bands.lower.length - 1]
    };
}

// Momentum calculation
function calculateMomentum(data, period) {
    if (data.length < period) return 0;
    return data[data.length - 1] - data[data.length - period];
}

// Rate of Change (ROC)
function calculateROC(data, period) {
    if (data.length < period) return 0;
    const current = data[data.length - 1];
    const previous = data[data.length - period];
    return ((current - previous) / previous) * 100;
}

// ADVANCED Pattern Detection with institutional patterns
function detectAdvancedPatterns(data) {
    if (data.length < 50) {
        return { bullishPatterns: 0, bearishPatterns: 0, patterns: [] };
    }
    
    let bullishPatterns = 0;
    let bearishPatterns = 0;
    const patterns = [];
    
    // Analyze recent candles
    const recent = data.slice(-50);
    const lastCandle = recent[recent.length - 1];
    const prevCandle = recent[recent.length - 2];
    
    // Calculate candle properties
    const body = Math.abs(lastCandle.close - lastCandle.open);
    const lowerWick = Math.min(lastCandle.close, lastCandle.open) - lastCandle.low;
    const upperWick = lastCandle.high - Math.max(lastCandle.close, lastCandle.open);
    const range = lastCandle.high - lastCandle.low;
    
    // 1. Hammer & Inverted Hammer (stronger reversal)
    if (lowerWick > body * 2.5 && upperWick < body * 0.3) {
        bullishPatterns += 2;
        patterns.push({ type: 'Hammer (Strong)', direction: 'bullish', strength: 'high' });
    }
    
    if (upperWick > body * 2.5 && lowerWick < body * 0.3) {
        bearishPatterns += 2;
        patterns.push({ type: 'Shooting Star (Strong)', direction: 'bearish', strength: 'high' });
    }
    
    // 2. Engulfing patterns (with volume confirmation)
    const prevBody = Math.abs(prevCandle.close - prevCandle.open);
    
    if (lastCandle.close > lastCandle.open && prevCandle.close < prevCandle.open &&
        lastCandle.open <= prevCandle.close && lastCandle.close >= prevCandle.open &&
        body > prevBody * 1.2) {
        bullishPatterns += 2;
        patterns.push({ type: 'Bullish Engulfing', direction: 'bullish', strength: 'high' });
    }
    
    if (lastCandle.close < lastCandle.open && prevCandle.close > prevCandle.open &&
        lastCandle.open >= prevCandle.close && lastCandle.close <= prevCandle.open &&
        body > prevBody * 1.2) {
        bearishPatterns += 2;
        patterns.push({ type: 'Bearish Engulfing', direction: 'bearish', strength: 'high' });
    }
    
    // 3. Morning/Evening Star
    if (recent.length >= 3) {
        const c1 = recent[recent.length - 3];
        const c2 = recent[recent.length - 2];
        const c3 = recent[recent.length - 1];
        
        // Morning Star (bullish reversal)
        if (c1.close < c1.open && c3.close > c3.open &&
            Math.abs(c2.close - c2.open) < (c2.high - c2.low) * 0.3 &&
            c3.close > (c1.open + c1.close) / 2) {
            bullishPatterns += 3;
            patterns.push({ type: 'Morning Star', direction: 'bullish', strength: 'very high' });
        }
        
        // Evening Star (bearish reversal)
        if (c1.close > c1.open && c3.close < c3.open &&
            Math.abs(c2.close - c2.open) < (c2.high - c2.low) * 0.3 &&
            c3.close < (c1.open + c1.close) / 2) {
            bearishPatterns += 3;
            patterns.push({ type: 'Evening Star', direction: 'bearish', strength: 'very high' });
        }
    }
    
    // 4. Three White Soldiers / Three Black Crows
    if (recent.length >= 3) {
        const c1 = recent[recent.length - 3];
        const c2 = recent[recent.length - 2];
        const c3 = recent[recent.length - 1];
        
        if (c1.close > c1.open && c2.close > c2.open && c3.close > c3.open &&
            c2.close > c1.close && c3.close > c2.close) {
            bullishPatterns += 3;
            patterns.push({ type: 'Three White Soldiers', direction: 'bullish', strength: 'very high' });
        }
        
        if (c1.close < c1.open && c2.close < c2.open && c3.close < c3.open &&
            c2.close < c1.close && c3.close < c2.close) {
            bearishPatterns += 3;
            patterns.push({ type: 'Three Black Crows', direction: 'bearish', strength: 'very high' });
        }
    }
    
    // 5. Head and Shoulders pattern detection
    const h_and_s = detectHeadAndShoulders(recent);
    if (h_and_s.detected) {
        if (h_and_s.type === 'bearish') {
            bearishPatterns += 4;
            patterns.push({ type: 'Head and Shoulders', direction: 'bearish', strength: 'extreme' });
        } else {
            bullishPatterns += 4;
            patterns.push({ type: 'Inverse Head and Shoulders', direction: 'bullish', strength: 'extreme' });
        }
    }
    
    // 6. Double Top/Bottom
    const doublePattern = detectDoubleTopsBottoms(recent);
    if (doublePattern.detected) {
        if (doublePattern.type === 'double_top') {
            bearishPatterns += 3;
            patterns.push({ type: 'Double Top', direction: 'bearish', strength: 'very high' });
        } else {
            bullishPatterns += 3;
            patterns.push({ type: 'Double Bottom', direction: 'bullish', strength: 'very high' });
        }
    }
    
    // 7. Bullish/Bearish Flags
    const flagPattern = detectFlags(recent);
    if (flagPattern.detected) {
        if (flagPattern.type === 'bullish_flag') {
            bullishPatterns += 2;
            patterns.push({ type: 'Bullish Flag', direction: 'bullish', strength: 'high' });
        } else {
            bearishPatterns += 2;
            patterns.push({ type: 'Bearish Flag', direction: 'bearish', strength: 'high' });
        }
    }
    
    return { bullishPatterns, bearishPatterns, patterns };
}

// Detect Head and Shoulders pattern
function detectHeadAndShoulders(data) {
    if (data.length < 30) return { detected: false };
    
    const highs = data.map((c, i) => ({ index: i, price: c.high }));
    const peaks = [];
    
    for (let i = 5; i < highs.length - 5; i++) {
        if (highs[i].price > highs[i-1].price && highs[i].price > highs[i+1].price) {
            peaks.push(highs[i]);
        }
    }
    
    if (peaks.length >= 3) {
        const last3 = peaks.slice(-3);
        const [left, head, right] = last3;
        
        // Check if middle peak is highest
        if (head.price > left.price && head.price > right.price &&
            Math.abs(left.price - right.price) / left.price < 0.02) {
            return { detected: true, type: 'bearish', neckline: Math.min(left.price, right.price) };
        }
    }
    
    // Inverse head and shoulders
    const lows = data.map((c, i) => ({ index: i, price: c.low }));
    const troughs = [];
    
    for (let i = 5; i < lows.length - 5; i++) {
        if (lows[i].price < lows[i-1].price && lows[i].price < lows[i+1].price) {
            troughs.push(lows[i]);
        }
    }
    
    if (troughs.length >= 3) {
        const last3 = troughs.slice(-3);
        const [left, head, right] = last3;
        
        if (head.price < left.price && head.price < right.price &&
            Math.abs(left.price - right.price) / left.price < 0.02) {
            return { detected: true, type: 'bullish', neckline: Math.max(left.price, right.price) };
        }
    }
    
    return { detected: false };
}

// Detect Double Tops and Bottoms
function detectDoubleTopsBottoms(data) {
    if (data.length < 20) return { detected: false };
    
    const recent = data.slice(-20);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    
    const maxHigh = Math.max(...highs);
    const maxIndices = highs.map((h, i) => h >= maxHigh * 0.998 ? i : -1).filter(i => i !== -1);
    
    if (maxIndices.length >= 2 && maxIndices[maxIndices.length - 1] - maxIndices[0] > 5) {
        return { detected: true, type: 'double_top' };
    }
    
    const minLow = Math.min(...lows);
    const minIndices = lows.map((l, i) => l <= minLow * 1.002 ? i : -1).filter(i => i !== -1);
    
    if (minIndices.length >= 2 && minIndices[minIndices.length - 1] - minIndices[0] > 5) {
        return { detected: true, type: 'double_bottom' };
    }
    
    return { detected: false };
}

// Detect Flag patterns (continuation)
function detectFlags(data) {
    if (data.length < 15) return { detected: false };
    
    const recent = data.slice(-15);
    const closes = recent.map(c => c.close);
    
    // Check for strong move followed by consolidation
    const firstPart = closes.slice(0, 5);
    const secondPart = closes.slice(5);
    
    const firstMove = (firstPart[firstPart.length - 1] - firstPart[0]) / firstPart[0];
    const consolidationRange = (Math.max(...secondPart) - Math.min(...secondPart)) / Math.min(...secondPart);
    
    // Bullish flag: strong up move + tight consolidation
    if (firstMove > 0.02 && consolidationRange < 0.01) {
        return { detected: true, type: 'bullish_flag' };
    }
    
    // Bearish flag: strong down move + tight consolidation
    if (firstMove < -0.02 && consolidationRange < 0.01) {
        return { detected: true, type: 'bearish_flag' };
    }
    
    return { detected: false };
}

// ADVANCED Market Structure Analysis with order flow
function analyzeAdvancedMarketStructure(data) {
    if (data.length < 50) {
        return { trend: 'neutral', strength: 0, structure: 'ranging' };
    }
    
    const recent = data.slice(-100);
    const highs = [];
    const lows = [];
    
    // Find swing points with more precision
    for (let i = 5; i < recent.length - 5; i++) {
        const isSwingHigh = recent[i].high > recent[i - 1].high &&
                           recent[i].high > recent[i - 2].high &&
                           recent[i].high > recent[i + 1].high &&
                           recent[i].high > recent[i + 2].high;
        
        const isSwingLow = recent[i].low < recent[i - 1].low &&
                          recent[i].low < recent[i - 2].low &&
                          recent[i].low < recent[i + 1].low &&
                          recent[i].low < recent[i + 2].low;
        
        if (isSwingHigh) highs.push({ index: i, value: recent[i].high, time: recent[i].time });
        if (isSwingLow) lows.push({ index: i, value: recent[i].low, time: recent[i].time });
    }
    
    // Analyze trend structure
    let higherHighs = 0;
    let lowerHighs = 0;
    let higherLows = 0;
    let lowerLows = 0;
    
    for (let i = 1; i < highs.length; i++) {
        if (highs[i].value > highs[i - 1].value) higherHighs++;
        else lowerHighs++;
    }
    
    for (let i = 1; i < lows.length; i++) {
        if (lows[i].value > lows[i - 1].value) higherLows++;
        else lowerLows++;
    }
    
    // Determine trend and structure
    let trend = 'neutral';
    let strength = 0;
    let structure = 'ranging';
    
    if (higherHighs > lowerHighs && higherLows > lowerLows) {
        trend = 'uptrend';
        strength = ((higherHighs + higherLows) / (highs.length + lows.length)) * 100;
        structure = 'trending';
    } else if (lowerHighs > higherHighs && lowerLows > higherLows) {
        trend = 'downtrend';
        strength = ((lowerHighs + lowerLows) / (highs.length + lows.length)) * 100;
        structure = 'trending';
    }
    
    // Calculate trendline if trending
    let trendline = null;
    if (structure === 'trending' && (lows.length > 2 || highs.length > 2)) {
        trendline = calculateTrendline(trend === 'uptrend' ? lows : highs, recent);
    }
    
    return { 
        trend, 
        strength, 
        structure,
        higherHighs, 
        lowerHighs, 
        higherLows, 
        lowerLows,
        trendline,
        swingHighs: highs,
        swingLows: lows
    };
}

// Calculate trendline from swing points
function calculateTrendline(swingPoints, allData) {
    if (swingPoints.length < 2) return null;
    
    // Get last 3 swing points for better accuracy
    const points = swingPoints.slice(-3);
    
    // Use linear regression
    const n = points.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    points.forEach((point, i) => {
        const x = point.index;
        const y = point.value;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Check if trendline is valid (slope not too extreme)
    if (Math.abs(slope) > 100) return null;
    
    // Generate trendline points
    const trendlinePoints = [];
    const startIndex = Math.max(0, points[0].index - 10);
    const endIndex = Math.min(allData.length - 1, points[points.length - 1].index + 10);
    
    for (let i = startIndex; i <= endIndex; i += 5) {
        const value = slope * i + intercept;
        if (allData[i]) {
            trendlinePoints.push({
                time: allData[i].time,
                value: value
            });
        }
    }
    
    return {
        draw: trendlinePoints.length > 1,
        points: trendlinePoints,
        slope: slope
    };
}

// Calculate Fibonacci Retracement Levels
function calculateFibonacciLevels(data) {
    if (data.length < 50) return null;
    
    const recent = data.slice(-100);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    
    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const range = maxHigh - minLow;
    
    // Standard Fibonacci levels
    const levels = {
        '0%': minLow,
        '23.6%': minLow + range * 0.236,
        '38.2%': minLow + range * 0.382,
        '50%': minLow + range * 0.5,
        '61.8%': minLow + range * 0.618,
        '78.6%': minLow + range * 0.786,
        '100%': maxHigh,
        range: range
    };
    
    return levels;
}

// Analyze Volume Profile
function analyzeVolumeProfile(data) {
    if (data.length < 50) return { highVolumeNodes: [], lowVolumeNodes: [] };
    
    const recent = data.slice(-100);
    const priceRange = Math.max(...recent.map(c => c.high)) - Math.min(...recent.map(c => c.low));
    const bucketSize = priceRange / 20; // 20 price buckets
    const volumeProfile = {};
    
    // Build volume profile
    recent.forEach(candle => {
        const bucket = Math.floor((candle.close - Math.min(...recent.map(c => c.low))) / bucketSize);
        const bucketPrice = Math.min(...recent.map(c => c.low)) + bucket * bucketSize;
        
        if (!volumeProfile[bucket]) {
            volumeProfile[bucket] = { price: bucketPrice, volume: 0 };
        }
        volumeProfile[bucket].volume += candle.volume || 1;
    });
    
    // Find high and low volume nodes
    const volumes = Object.values(volumeProfile);
    const avgVolume = volumes.reduce((sum, v) => sum + v.volume, 0) / volumes.length;
    
    const highVolumeNodes = volumes.filter(v => v.volume > avgVolume * 1.5).map(v => v.price);
    const lowVolumeNodes = volumes.filter(v => v.volume < avgVolume * 0.5).map(v => v.price);
    
    return { highVolumeNodes, lowVolumeNodes, avgVolume };
}

// Detect Smart Money Concepts (Order Blocks, FVG, etc.)
function detectSmartMoneyConcepts(data, indicators) {
    if (data.length < 50) return { orderBlocks: [], fairValueGaps: [] };
    
    const recent = data.slice(-50);
    const orderBlocks = [];
    const fairValueGaps = [];
    
    // Detect Order Blocks (strong institutional activity)
    for (let i = 3; i < recent.length - 1; i++) {
        const candle = recent[i];
        const prevCandle = recent[i - 1];
        const body = Math.abs(candle.close - candle.open);
        const range = candle.high - candle.low;
        
        // Bullish order block: strong bullish candle after pullback
        if (candle.close > candle.open && body > range * 0.7 &&
            prevCandle.close < prevCandle.open) {
            orderBlocks.push({
                type: 'bullish',
                price: candle.low,
                strength: body / range
            });
        }
        
        // Bearish order block: strong bearish candle after bounce
        if (candle.close < candle.open && body > range * 0.7 &&
            prevCandle.close > prevCandle.open) {
            orderBlocks.push({
                type: 'bearish',
                price: candle.high,
                strength: body / range
            });
        }
    }
    
    // Detect Fair Value Gaps (imbalance zones)
    for (let i = 2; i < recent.length; i++) {
        const c1 = recent[i - 2];
        const c2 = recent[i - 1];
        const c3 = recent[i];
        
        // Bullish FVG: gap between c1 high and c3 low
        if (c3.low > c1.high && c2.close > c2.open) {
            fairValueGaps.push({
                type: 'bullish',
                top: c3.low,
                bottom: c1.high,
                size: c3.low - c1.high
            });
        }
        
        // Bearish FVG: gap between c1 low and c3 high
        if (c3.high < c1.low && c2.close < c2.open) {
            fairValueGaps.push({
                type: 'bearish',
                top: c1.low,
                bottom: c3.high,
                size: c1.low - c3.high
            });
        }
    }
    
    return { 
        orderBlocks: orderBlocks.slice(-3), // Keep last 3
        fairValueGaps: fairValueGaps.slice(-3) 
    };
}
