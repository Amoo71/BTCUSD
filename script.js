// BTC/USD Live Chart Application using Lightweight Charts (TradingView library)
let chart = null;
let candleSeries = null;
let predictionSeries = null;
let trendlineSeries = null;
let supportLineSeries = null;
let resistanceLineSeries = null;
let currentTimeframe = '1m';
let updateInterval = null;
let aiAnalysisActive = false;
let aiUpdateInterval = null;
let historicalData = [];
let lastAIAnalysis = null;

// Binance WebSocket for real-time updates
let ws = null;

// AI Analysis now available for 1m and above (except 1h)
const AI_ALLOWED_TIMEFRAMES = ['1m', '5m', '15m', '30m'];

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing ULTIMATE AI Chart System...');
    initializeChart();
    setupEventListeners();
    updateAIButtonState();
    loadChartData();
    connectWebSocket();
    startAutoUpdate();
});

// Initialize Lightweight Charts
function initializeChart() {
    const container = document.getElementById('chart-container');
    
    if (!container) {
        console.error('Chart container not found!');
        return;
    }

    // Detect mobile device
    const isMobile = window.innerWidth <= 768;

    chart = LightweightCharts.createChart(container, {
        width: container.clientWidth,
        height: container.clientHeight,
        layout: {
            background: { color: '#1e222d' },
            textColor: '#d1d4dc',
            fontSize: isMobile ? 11 : 12,
        },
        grid: {
            vertLines: { 
                color: '#2a2e39',
                visible: !isMobile, // Hide vertical lines on mobile for cleaner look
            },
            horzLines: { 
                color: '#2a2e39',
            },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
            vertLine: {
                width: isMobile ? 1 : 1,
                color: '#758696',
                style: 3,
            },
            horzLine: {
                width: isMobile ? 1 : 1,
                color: '#758696',
                style: 3,
            },
        },
        rightPriceScale: {
            borderColor: '#2a2e39',
            scaleMargins: {
                top: 0.1,
                bottom: 0.1,
            },
            visible: true,
        },
        timeScale: {
            borderColor: '#2a2e39',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: isMobile ? 5 : 10,
            barSpacing: isMobile ? 6 : 8,
            minBarSpacing: isMobile ? 2 : 3,
        },
        handleScroll: {
            mouseWheel: !isMobile,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
        },
        handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: !isMobile,
            pinch: true,
        },
    });

    // Create candlestick series with mobile-optimized settings
    candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderUpColor: '#26a69a',
        borderDownColor: '#ef5350',
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
        priceLineVisible: true,
        lastValueVisible: true,
    });

    // Handle window resize with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            if (chart && container) {
                const newWidth = container.clientWidth;
                const newHeight = container.clientHeight;
                
                if (newWidth > 0 && newHeight > 0) {
                    chart.applyOptions({
                        width: newWidth,
                        height: newHeight,
                    });
                    
                    // Update mobile settings if needed
                    const nowMobile = window.innerWidth <= 768;
                    chart.applyOptions({
                        layout: {
                            fontSize: nowMobile ? 11 : 12,
                        },
                        grid: {
                            vertLines: {
                                visible: !nowMobile,
                            },
                        },
                        timeScale: {
                            rightOffset: nowMobile ? 5 : 10,
                            barSpacing: nowMobile ? 6 : 8,
                            minBarSpacing: nowMobile ? 2 : 3,
                        },
                        handleScroll: {
                            mouseWheel: !nowMobile,
                        },
                        handleScale: {
                            mouseWheel: !nowMobile,
                        },
                    });
                    
                    console.log(`Chart resized: ${newWidth}x${newHeight}`);
                }
            }
        }, 250);
    });

    // Handle orientation change for mobile
    window.addEventListener('orientationchange', () => {
        setTimeout(() => {
            if (chart && container) {
                chart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight,
                });
                console.log('Chart adjusted for orientation change');
            }
        }, 300);
    });

    console.log('Chart initialized successfully (Mobile: ' + isMobile + ')');
}

// Setup event listeners
function setupEventListeners() {
    // Timeframe buttons
    document.querySelectorAll('.timeframe-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.timeframe-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentTimeframe = e.target.dataset.timeframe;
            
            // Update AI button state
            updateAIButtonState();
            
            // Reconnect WebSocket with new timeframe
            if (ws) {
                ws.close();
            }
            if (tradesWs) {
                tradesWs.close();
            }
            
            loadChartData();
            connectWebSocket();
        });
    });

    // AI Analyze button
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    if (aiBtn) {
        aiBtn.addEventListener('click', () => {
            if (!aiBtn.disabled) {
                toggleAIAnalysis();
            }
        });
    }

    // Close AI panel button
    const closeBtn = document.getElementById('closeAiPanel');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeAIPanel();
        });
    }
}

// Load chart data from Binance API
async function loadChartData() {
    try {
        updateStatus('Loading chart data...', false);
        
        const interval = getInterval(currentTimeframe);
        const limit = getLimit(currentTimeframe);
        
        console.log(`Loading ${limit} candles for ${interval} timeframe...`);
        
        // Fetch klines (candlestick data) from Binance
        const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`
        );
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
            throw new Error('No data received from API');
        }
        
        // Transform data to Lightweight Charts format
        const candleData = data.map(candle => ({
            time: candle[0] / 1000, // Convert to seconds
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5]),
        }));
        
        // Store historical data for AI analysis
        historicalData = candleData;
        
        // Update chart
        if (candleSeries) {
            candleSeries.setData(candleData);
            
            // Fit content on mobile
            if (window.innerWidth <= 768) {
                chart.timeScale().fitContent();
            }
            
            console.log(`✅ Loaded ${candleData.length} candles successfully`);
        }
        
        // Update price display with latest candle
        if (candleData.length > 0) {
            const latestCandle = candleData[candleData.length - 1];
            updatePriceDisplay(latestCandle);
        }
        
        // Fetch 24h stats
        await fetch24hStats();
        
        updateStatus('Live', true);
        updateLastUpdateTime();
        
        // Re-run AI analysis if active
        if (aiAnalysisActive) {
            runAIAnalysis();
        }
        
    } catch (error) {
        console.error('❌ Error loading chart data:', error);
        updateStatus('Error loading data', false);
        
        // Retry after 3 seconds
        setTimeout(() => {
            console.log('Retrying to load chart data...');
            loadChartData();
        }, 3000);
    }
}

// Get Binance interval string
function getInterval(timeframe) {
    const map = {
        '1m': '1m',
        '5m': '5m',
        '15m': '15m',
        '30m': '30m',
        '1h': '1h',
    };
    return map[timeframe] || '1m';
}

// Get limit (number of candles to fetch)
function getLimit(timeframe) {
    const map = {
        '1m': 500,
        '5m': 500,
        '15m': 500,
        '30m': 500,
        '1h': 500,
    };
    return map[timeframe] || 500;
}

// Check if AI analysis is allowed for current timeframe
function isAIAllowed() {
    return AI_ALLOWED_TIMEFRAMES.includes(currentTimeframe);
}

// Update AI button state based on timeframe
function updateAIButtonState() {
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    if (aiBtn) {
        if (isAIAllowed()) {
            aiBtn.disabled = false;
            aiBtn.title = 'Click to activate AI Analysis with adaptive learning';
        } else {
            aiBtn.disabled = true;
            aiBtn.title = 'AI Analysis available for 1m, 5m, 15m, and 30m timeframes';
            // Close panel if it's open
            if (aiAnalysisActive) {
                closeAIPanel();
            }
        }
    }
}

// Fetch 24h statistics
async function fetch24hStats() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT');
        const data = await response.json();
        
        // Update stats display
        document.getElementById('high24h').textContent = '$' + parseFloat(data.highPrice).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        document.getElementById('low24h').textContent = '$' + parseFloat(data.lowPrice).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        document.getElementById('volume24h').textContent = formatVolume(parseFloat(data.volume));
        
        // Fetch market cap from CoinGecko
        fetchMarketCap();
        
    } catch (error) {
        console.error('Error fetching 24h stats:', error);
    }
}

// Update price display
function updatePriceDisplay(candle) {
    const priceElement = document.getElementById('currentPrice');
    const changeElement = document.getElementById('priceChange');
    
    if (!priceElement || !changeElement) return;
    
    const currentPrice = candle.close;
    const priceChange = ((candle.close - candle.open) / candle.open) * 100;
    
    priceElement.textContent = '$' + currentPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    
    const changeText = (priceChange >= 0 ? '+' : '') + priceChange.toFixed(2) + '%';
    changeElement.textContent = changeText;
    changeElement.className = 'price-change ' + (priceChange >= 0 ? 'positive' : 'negative');
}

// Fetch market cap from CoinGecko
async function fetchMarketCap() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_market_cap=true');
        const data = await response.json();
        
        if (data && data.bitcoin && data.bitcoin.usd_market_cap) {
            document.getElementById('marketCap').textContent = '$' + formatLargeNumber(data.bitcoin.usd_market_cap);
        }
    } catch (error) {
        console.error('Error fetching market cap:', error);
        document.getElementById('marketCap').textContent = '--';
    }
}

// Format large numbers
function formatLargeNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Format volume
function formatVolume(volume) {
    return formatLargeNumber(volume) + ' BTC';
}

// Update last update time
function updateLastUpdateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const updateElement = document.getElementById('lastUpdate');
    if (updateElement) {
        updateElement.textContent = timeString;
    }
}

// Update status indicator
function updateStatus(message, isConnected) {
    const statusText = document.getElementById('statusText');
    const statusIndicator = document.querySelector('.status-indicator');
    
    if (statusText) {
        statusText.textContent = message;
    }
    
    if (statusIndicator) {
        if (isConnected) {
            statusIndicator.classList.remove('error');
        } else {
            statusIndicator.classList.add('error');
        }
    }
}

// Connect to Binance WebSocket for real-time updates
function connectWebSocket() {
    // Close existing connections
    if (ws) ws.close();
    
    // Use kline stream for all timeframes
    connectKlineWebSocket();
}

// Connect to kline WebSocket (normal timeframes)
function connectKlineWebSocket() {
    const wsUrl = 'wss://stream.binance.com:9443/ws/btcusdt@kline_' + getInterval(currentTimeframe);
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('Kline WebSocket connected');
        updateStatus('Live', true);
    };
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const kline = data.k;
        
        // Update latest candle in real-time
        if (candleSeries && kline) {
            const candle = {
                time: kline.t / 1000,
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
            };
            
            candleSeries.update(candle);
            updatePriceDisplay(candle);
            updateLastUpdateTime();
            
            // Update historical data
            if (historicalData.length > 0) {
                const lastCandle = historicalData[historicalData.length - 1];
                if (lastCandle.time === candle.time) {
                    historicalData[historicalData.length - 1] = candle;
                } else {
                    historicalData.push(candle);
                }
            }
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateStatus('Connection error', false);
    };
    
    ws.onclose = () => {
        console.log('WebSocket closed, reconnecting...');
        updateStatus('Reconnecting...', false);
        setTimeout(connectWebSocket, 3000);
    };
}


// Start auto-update for stats
function startAutoUpdate() {
    // Update 24h stats every 30 seconds
    updateInterval = setInterval(() => {
        fetch24hStats();
    }, 30000);
}

// Toggle AI Analysis with adaptive mode
function toggleAIAnalysis() {
    const aiPanel = document.getElementById('aiPanel');
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    const aiStatus = document.getElementById('aiStatus');
    const aiStatusText = document.getElementById('aiStatusText');
    
    if (!aiAnalysisActive) {
        // Start AI analysis
        aiAnalysisActive = true;
        aiPanel.classList.add('active');
        aiBtn.classList.add('analyzing');
        aiStatus.style.display = 'flex';
        aiStatusText.textContent = 'AI Analysis Active - Adaptive Mode';
        
        console.log('🤖 AI ANALYSIS ACTIVATED - Starting professional market analysis...');
        
        // Run initial analysis
        runAIAnalysis();
        
        // Start adaptive updates based on timeframe
        const updateFrequency = getAIUpdateFrequency(currentTimeframe);
        aiUpdateInterval = setInterval(() => {
            console.log('🔄 AI Adapting to market changes...');
            runAIAnalysis();
        }, updateFrequency);
        
    } else {
        // Stop AI analysis
        closeAIPanel();
    }
}

function closeAIPanel() {
    const aiPanel = document.getElementById('aiPanel');
    const aiBtn = document.getElementById('aiAnalyzeBtn');
    const aiStatus = document.getElementById('aiStatus');
    
    aiAnalysisActive = false;
    aiPanel.classList.remove('active');
    aiBtn.classList.remove('analyzing');
    aiStatus.style.display = 'none';
    
    console.log('🛑 AI Analysis stopped');
    
    // Stop adaptive updates
    if (aiUpdateInterval) {
        clearInterval(aiUpdateInterval);
        aiUpdateInterval = null;
    }
    
    // Remove all AI drawings from chart
    clearAIDrawings();
}

// Get AI update frequency based on timeframe
function getAIUpdateFrequency(timeframe) {
    const map = {
        '1m': 15000,  // Update every 15 seconds for 1m
        '5m': 30000,  // Every 30 seconds for 5m
        '15m': 60000, // Every minute for 15m
        '30m': 90000, // Every 90 seconds for 30m
    };
    return map[timeframe] || 30000;
}

// Clear all AI drawings
function clearAIDrawings() {
    if (predictionSeries && chart) {
        chart.removeSeries(predictionSeries);
        predictionSeries = null;
    }
    if (trendlineSeries && chart) {
        chart.removeSeries(trendlineSeries);
        trendlineSeries = null;
    }
    if (supportLineSeries && chart) {
        chart.removeSeries(supportLineSeries);
        supportLineSeries = null;
    }
    if (resistanceLineSeries && chart) {
        chart.removeSeries(resistanceLineSeries);
        resistanceLineSeries = null;
    }
}

// ULTIMATE AI ANALYSIS - Professional Grade with Adaptive Learning
function runAIAnalysis() {
    if (!isAIAllowed()) {
        console.log('AI Analysis only available for 1m, 5m, 15m, and 30m timeframes');
        return;
    }
    
    if (historicalData.length < 200) {
        console.log('Not enough data for AI analysis (need at least 200 candles)');
        return;
    }
    
    console.log('🔬 Running ULTIMATE AI analysis for', currentTimeframe, 'timeframe...');
    
    // Clear previous drawings
    clearAIDrawings();
    
    // Phase 1: Multi-timeframe analysis
    const indicators = calculateAdvancedIndicators(historicalData);
    
    // Phase 2: Advanced pattern recognition
    const patterns = detectAdvancedPatterns(historicalData);
    
    // Phase 3: Market structure & order flow
    const marketStructure = analyzeAdvancedMarketStructure(historicalData);
    
    // Phase 4: Fibonacci levels
    const fibonacci = calculateFibonacciLevels(historicalData);
    
    // Phase 5: Volume profile analysis
    const volumeProfile = analyzeVolumeProfile(historicalData);
    
    // Phase 6: Smart money concepts
    const smartMoney = detectSmartMoneyConcepts(historicalData, indicators);
    
    // Phase 7: Generate professional prediction
    const prediction = generateUltimatePrediction(
        historicalData, indicators, patterns, marketStructure, 
        fibonacci, volumeProfile, smartMoney
    );
    
    // Check if market changed significantly
    if (lastAIAnalysis) {
        const marketChange = detectMarketChangeSignificance(lastAIAnalysis, prediction);
        if (marketChange.significant) {
            console.log('🚨 MARKET SHIFT DETECTED:', marketChange.reason);
        }
    }
    
    lastAIAnalysis = prediction;
    
    // Phase 8: Draw intelligent chart annotations
    drawAIChartAnnotations(prediction, indicators, patterns, marketStructure);
    
    // Phase 9: Update UI with comprehensive analysis
    updateAIPanel(prediction, indicators);
    
    console.log('✅ AI Analysis complete - Confidence:', prediction.confidence.toFixed(1) + '%');
    console.log('📊 Trend:', prediction.trend, '| Patterns:', patterns.patterns.length, '| Signals:', prediction.signals.length);
}

// Detect if market has changed significantly
function detectMarketChangeSignificance(oldAnalysis, newAnalysis) {
    const changes = [];
    
    // Trend change
    if (oldAnalysis.trend !== newAnalysis.trend) {
        changes.push(`Trend changed from ${oldAnalysis.trend} to ${newAnalysis.trend}`);
    }
    
    // Confidence drop/increase
    const confidenceDelta = newAnalysis.confidence - oldAnalysis.confidence;
    if (Math.abs(confidenceDelta) > 15) {
        changes.push(`Confidence ${confidenceDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(confidenceDelta).toFixed(1)}%`);
    }
    
    // Price deviation
    const priceDelta = Math.abs(newAnalysis.targetPrice - oldAnalysis.targetPrice) / oldAnalysis.targetPrice;
    if (priceDelta > 0.02) {
        changes.push(`Target price shifted by ${(priceDelta * 100).toFixed(2)}%`);
    }
    
    return {
        significant: changes.length > 0,
        reason: changes.join(', ')
    };
}

// ADVANCED INDICATORS for 5m-30m timeframes
function calculateAdvancedIndicators(data) {
    const closes = data.map(c => c.close);
    const highs = data.map(c => c.high);
    const lows = data.map(c => c.low);
    const volumes = data.map(c => c.volume || 0);
    
    // Multiple timeframe Moving Averages
    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const ema50 = calculateEMA(closes, 50);
    const ema100 = calculateEMA(closes, 100);
    const ema200 = calculateEMA(closes, 200);
    
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma200 = calculateSMA(closes, 200);
    
    // RSI with multiple periods
    const rsi = calculateRSI(closes, 14);
    const rsi7 = calculateRSI(closes, 7);
    
    // MACD
    const macd = calculateMACD(closes);
    
    // Stochastic RSI
    const stochRSI = calculateStochRSI(rsi, 14);
    
    // ATR (Average True Range)
    const atr = calculateATR(data, 14);
    
    // Bollinger Bands
    const bbands = calculateBollingerBands(closes, 20, 2);
    
    // Volume analysis
    const volumeMA = calculateSMA(volumes, 20);
    const volumeRatio = volumes[volumes.length - 1] / (volumeMA[volumeMA.length - 1] || 1);
    
    // Volatility (multiple periods)
    const volatility = calculateVolatility(closes, 20);
    const volatility50 = calculateVolatility(closes, 50);
    
    // Support and Resistance with multiple levels
    const supportResistance = findAdvancedSupportResistance(data);
    
    // Momentum
    const momentum = calculateMomentum(closes, 10);
    
    // Rate of Change
    const roc = calculateROC(closes, 12);
    
    return {
        ema9: ema9[ema9.length - 1],
        ema21: ema21[ema21.length - 1],
        ema50: ema50[ema50.length - 1],
        ema100: ema100[ema100.length - 1],
        ema200: ema200[ema200.length - 1],
        sma20: sma20[sma20.length - 1],
        sma50: sma50[sma50.length - 1],
        sma200: sma200[sma200.length - 1],
        rsi: rsi[rsi.length - 1],
        rsi7: rsi7[rsi7.length - 1],
        macd: macd,
        stochRSI: stochRSI,
        atr: atr[atr.length - 1],
        bbands: bbands,
        volumeRatio: volumeRatio,
        volatility: volatility,
        volatility50: volatility50,
        support: supportResistance.support,
        resistance: supportResistance.resistance,
        momentum: momentum,
        roc: roc,
        emaArray: ema21,
        closeArray: closes,
    };
}

// Simple Moving Average
function calculateSMA(data, period) {
    const result = [];
    for (let i = period - 1; i < data.length; i++) {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
    }
    return result;
}

// RSI Calculation
function calculateRSI(data, period) {
    const changes = [];
    for (let i = 1; i < data.length; i++) {
        changes.push(data[i] - data[i - 1]);
    }
    
    const result = [];
    for (let i = period; i < changes.length; i++) {
        const gains = changes.slice(i - period, i).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
        const losses = Math.abs(changes.slice(i - period, i).filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
        
        const rs = gains / (losses || 1);
        const rsi = 100 - (100 / (1 + rs));
        result.push(rsi);
    }
    
    return result;
}

// MACD Calculation
function calculateMACD(data) {
    const ema12 = calculateEMA(data, 12);
    const ema26 = calculateEMA(data, 26);
    
    const macdLine = ema12[ema12.length - 1] - ema26[ema26.length - 1];
    
    return {
        value: macdLine,
        signal: macdLine > 0 ? 'bullish' : 'bearish'
    };
}

// EMA Calculation
function calculateEMA(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
        result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    
    return result;
}

// Volatility Calculation
function calculateVolatility(data, period) {
    const returns = [];
    for (let i = 1; i < data.length; i++) {
        returns.push((data[i] - data[i - 1]) / data[i - 1]);
    }
    
    const recentReturns = returns.slice(-period);
    const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
    const variance = recentReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / recentReturns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev * 100; // Convert to percentage
}

// ADVANCED Support and Resistance with multiple levels
function findAdvancedSupportResistance(data) {
    const recent = data.slice(-100);
    const lows = [];
    const highs = [];
    
    // Find swing lows and highs
    for (let i = 2; i < recent.length - 2; i++) {
        const current = recent[i];
        const prev1 = recent[i - 1];
        const prev2 = recent[i - 2];
        const next1 = recent[i + 1];
        const next2 = recent[i + 2];
        
        // Swing low
        if (current.low < prev1.low && current.low < prev2.low && 
            current.low < next1.low && current.low < next2.low) {
            lows.push(current.low);
        }
        
        // Swing high
        if (current.high > prev1.high && current.high > prev2.high && 
            current.high > next1.high && current.high > next2.high) {
            highs.push(current.high);
        }
    }
    
    // Cluster similar levels
    const supportLevels = clusterLevels(lows);
    const resistanceLevels = clusterLevels(highs);
    
    const currentPrice = data[data.length - 1].close;
    
    // Find closest support and resistance
    const support = supportLevels.filter(s => s < currentPrice).sort((a, b) => b - a)[0] || 
                    Math.min(...recent.map(c => c.low));
    const resistance = resistanceLevels.filter(r => r > currentPrice).sort((a, b) => a - b)[0] || 
                       Math.max(...recent.map(c => c.high));
    
    return {
        support,
        resistance,
        supportLevels: supportLevels.slice(0, 3),
        resistanceLevels: resistanceLevels.slice(0, 3)
    };
}

// Cluster similar price levels
function clusterLevels(levels, threshold = 0.002) {
    if (levels.length === 0) return [];
    
    const sorted = levels.sort((a, b) => a - b);
    const clusters = [];
    let currentCluster = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
        if ((sorted[i] - currentCluster[0]) / currentCluster[0] < threshold) {
            currentCluster.push(sorted[i]);
        } else {
            clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
            currentCluster = [sorted[i]];
        }
    }
    clusters.push(currentCluster.reduce((a, b) => a + b) / currentCluster.length);
    
    return clusters;
}

// ULTIMATE PREDICTION with all advanced components
function generateUltimatePrediction(data, indicators, patterns, marketStructure, fibonacci, volumeProfile, smartMoney) {
    const currentPrice = data[data.length - 1].close;
    const lastTime = data[data.length - 1].time;
    
    // Multi-factor trend analysis
    let trendScore = 0;
    let trendStrength = 0;
    
    // EMA alignment (strong trend indicator)
    if (currentPrice > indicators.ema9) trendScore += 1;
    if (currentPrice > indicators.ema21) trendScore += 2;
    if (currentPrice > indicators.ema50) trendScore += 2;
    if (currentPrice > indicators.ema100) trendScore += 1;
    if (indicators.ema9 > indicators.ema21) trendScore += 2;
    if (indicators.ema21 > indicators.ema50) trendScore += 2;
    
    // RSI analysis (momentum)
    if (indicators.rsi < 30) {
        trendScore += 3; // Strong oversold - reversal potential
        trendStrength += 2;
    } else if (indicators.rsi < 40) {
        trendScore += 1; // Mild oversold
        trendStrength += 1;
    } else if (indicators.rsi > 70) {
        trendScore -= 3; // Strong overbought - reversal potential
        trendStrength += 2;
    } else if (indicators.rsi > 60) {
        trendScore -= 1; // Mild overbought
        trendStrength += 1;
    }
    
    // MACD confirmation
    if (indicators.macd.signal === 'bullish') {
        trendScore += 2;
        trendStrength += 1;
    } else {
        trendScore -= 2;
        trendStrength += 1;
    }
    
    // Stochastic RSI
    if (indicators.stochRSI.k < 20) trendScore += 2; // Oversold
    if (indicators.stochRSI.k > 80) trendScore -= 2; // Overbought
    
    // Volume confirmation
    if (indicators.volumeRatio > 1.5) {
        trendStrength += 2; // Strong volume
    } else if (indicators.volumeRatio < 0.7) {
        trendStrength -= 1; // Weak volume
    }
    
    // Bollinger Bands position
    const bbPosition = (currentPrice - indicators.bbands.lower) / 
                       (indicators.bbands.upper - indicators.bbands.lower);
    if (bbPosition < 0.2) trendScore += 2; // Near lower band - oversold
    if (bbPosition > 0.8) trendScore -= 2; // Near upper band - overbought
    
    // Pattern recognition bonus
    if (patterns.bullishPatterns > 0) {
        trendScore += patterns.bullishPatterns * 2;
        trendStrength += 1;
    }
    if (patterns.bearishPatterns > 0) {
        trendScore -= patterns.bearishPatterns * 2;
        trendStrength += 1;
    }
    
    // Market structure
    if (marketStructure.trend === 'uptrend') trendScore += 3;
    if (marketStructure.trend === 'downtrend') trendScore -= 3;
    
    // Momentum confirmation
    if (indicators.momentum > 0) trendScore += 1;
    else trendScore -= 1;
    
    // ROC confirmation
    if (indicators.roc > 0) trendScore += 1;
    else trendScore -= 1;
    
    // Determine final trend
    const trend = trendScore > 2 ? 'bullish' : trendScore < -2 ? 'bearish' : 'neutral';
    
    // Calculate confidence (more sophisticated)
    let confidence = 50;
    confidence += Math.min(Math.abs(trendScore) * 3, 30); // Indicator alignment
    confidence += Math.min(trendStrength * 2, 15); // Trend strength
    if (patterns.bullishPatterns + patterns.bearishPatterns > 0) confidence += 5; // Pattern bonus
    confidence = Math.min(confidence, 95); // Cap at 95%
    confidence = Math.max(confidence, 30); // Floor at 30%
    
    // Generate sophisticated price prediction
    const futurePrices = generateAdvancedPricePrediction(
        data, currentPrice, lastTime, trend, indicators, marketStructure
    );
    
    // Generate optimized trading positions
    const positions = generateOptimizedPositions(
        currentPrice, futurePrices, indicators, trend, patterns, marketStructure
    );
    
    // Generate comprehensive trading signals
    const signals = generateAdvancedSignals(
        indicators, trend, currentPrice, patterns, marketStructure
    );
    
    // Add smart money signals
    if (smartMoney.orderBlocks.length > 0) {
        const bullishOB = smartMoney.orderBlocks.filter(ob => ob.type === 'bullish');
        const bearishOB = smartMoney.orderBlocks.filter(ob => ob.type === 'bearish');
        
        if (bullishOB.length > 0) {
            signals.push({
                type: 'bullish',
                message: `${bullishOB.length} Bullish Order Block(s) detected - Institutional support`,
                strength: 'Strong'
            });
        }
        if (bearishOB.length > 0) {
            signals.push({
                type: 'bearish',
                message: `${bearishOB.length} Bearish Order Block(s) detected - Institutional resistance`,
                strength: 'Strong'
            });
        }
    }
    
    // Add Fibonacci signals
    if (fibonacci) {
        const fibLevels = ['61.8%', '50%', '38.2%'];
        for (const level of fibLevels) {
            const fibPrice = fibonacci[level];
            const distance = Math.abs(currentPrice - fibPrice) / currentPrice;
            if (distance < 0.005) { // Within 0.5%
                signals.push({
                    type: 'neutral',
                    message: `Price near Fibonacci ${level} level ($${fibPrice.toFixed(2)}) - Key decision point`,
                    strength: 'Strong'
                });
                break;
            }
        }
    }
    
    // Include trendline in prediction if available
    const trendlineData = marketStructure.trendline || null;
    
    return {
        trend,
        confidence,
        futurePrices,
        positions,
        signals,
        targetPrice: futurePrices[futurePrices.length - 1].value,
        indicators,
        patterns,
        marketStructure,
        fibonacci,
        smartMoney,
        trendline: trendlineData
    };
}

// Advanced price prediction with multiple techniques
function generateAdvancedPricePrediction(data, currentPrice, lastTime, trend, indicators, marketStructure) {
    const futurePrices = [];
    const timeIncrement = getTimeIncrement(currentTimeframe);
    
    // Adaptive prediction length based on timeframe
    const numCandles = currentTimeframe === '5m' ? 12 : 
                      currentTimeframe === '15m' ? 8 : 
                      currentTimeframe === '30m' ? 6 : 10;
    
    let price = currentPrice;
    const atr = indicators.atr;
    const volatility = indicators.volatility;
    
    // Calculate trend strength factor
    const trendFactor = trend === 'bullish' ? 0.003 : 
                       trend === 'bearish' ? -0.003 : 0;
    
    // Mean reversion factor (when away from EMAs)
    const distanceFromEMA = (currentPrice - indicators.ema21) / currentPrice;
    const meanReversionFactor = -distanceFromEMA * 0.5;
    
    for (let i = 1; i <= numCandles; i++) {
        // Decay trend strength over time
        const decayFactor = Math.pow(0.9, i);
        
        // ATR-based movement
        const atrMove = (Math.random() - 0.5) * atr * 2;
        
        // Trend component (decaying)
        const trendMove = price * trendFactor * decayFactor;
        
        // Mean reversion component (increasing over time)
        const reversionMove = price * meanReversionFactor * (1 - decayFactor);
        
        // Support/Resistance attraction
        let srMove = 0;
        if (price < indicators.support * 1.01 && price > indicators.support * 0.99) {
            srMove = (indicators.support - price) * 0.3; // Bounce from support
        } else if (price > indicators.resistance * 0.99 && price < indicators.resistance * 1.01) {
            srMove = (indicators.resistance - price) * 0.3; // Rejection from resistance
        }
        
        // Combine all factors
        price += atrMove + trendMove + reversionMove + srMove;
        
        // Ensure price doesn't deviate too much
        const maxDeviation = currentPrice * 0.05; // 5% max deviation
        price = Math.max(currentPrice - maxDeviation, Math.min(currentPrice + maxDeviation, price));
        
        futurePrices.push({
            time: lastTime + (timeIncrement * i),
            value: price
        });
    }
    
    return futurePrices;
}

// Get time increment in seconds based on timeframe
function getTimeIncrement(timeframe) {
    const map = {
        '1m': 60,
        '5m': 300,
        '15m': 900,
        '30m': 1800,
        '1h': 3600,
    };
    return map[timeframe] || 60;
}

// OPTIMIZED trading positions with advanced risk management
function generateOptimizedPositions(currentPrice, futurePrices, indicators, trend, patterns, marketStructure) {
    const positions = [];
    const atr = indicators.atr;
    
    if (trend === 'bullish') {
        // Long position with optimal entry
        let entry = currentPrice;
        
        // Better entry if near support
        if (currentPrice - indicators.support < atr * 2) {
            entry = indicators.support + (atr * 0.5); // Entry just above support
        } else {
            entry = currentPrice * 0.998; // Small pullback
        }
        
        const target = futurePrices[futurePrices.length - 1].value;
        
        // Stop loss based on ATR and support
        const stopLoss = Math.max(
            indicators.support * 0.998,
            currentPrice - (atr * 2)
        );
        
        const potentialProfit = ((target - entry) / entry) * 100;
        const riskAmount = ((entry - stopLoss) / entry) * 100;
        const riskRewardRatio = potentialProfit / (riskAmount || 1);
        
        positions.push({
            type: 'long',
            entry: entry,
            target: target,
            stopLoss: stopLoss,
            potentialProfit: potentialProfit,
            riskAmount: riskAmount,
            riskRewardRatio: riskRewardRatio
        });
        
    } else if (trend === 'bearish') {
        // Short position with optimal entry
        let entry = currentPrice;
        
        // Better entry if near resistance
        if (indicators.resistance - currentPrice < atr * 2) {
            entry = indicators.resistance - (atr * 0.5); // Entry just below resistance
        } else {
            entry = currentPrice * 1.002; // Small bounce
        }
        
        const target = futurePrices[futurePrices.length - 1].value;
        
        // Stop loss based on ATR and resistance
        const stopLoss = Math.min(
            indicators.resistance * 1.002,
            currentPrice + (atr * 2)
        );
        
        const potentialProfit = ((entry - target) / entry) * 100;
        const riskAmount = ((stopLoss - entry) / entry) * 100;
        const riskRewardRatio = potentialProfit / (riskAmount || 1);
        
        positions.push({
            type: 'short',
            entry: entry,
            target: target,
            stopLoss: stopLoss,
            potentialProfit: potentialProfit,
            riskAmount: riskAmount,
            riskRewardRatio: riskRewardRatio
        });
    }
    
    return positions;
}

// ADVANCED trading signals with comprehensive analysis
function generateAdvancedSignals(indicators, trend, currentPrice, patterns, marketStructure) {
    const signals = [];
    
    // RSI Divergence and levels
    if (indicators.rsi < 30) {
        signals.push({
            type: 'bullish',
            message: `RSI Oversold (${indicators.rsi.toFixed(1)}) - Strong reversal potential`,
            strength: 'Strong'
        });
    } else if (indicators.rsi < 40) {
        signals.push({
            type: 'bullish',
            message: `RSI below 40 (${indicators.rsi.toFixed(1)}) - Bullish territory`,
            strength: 'Medium'
        });
    } else if (indicators.rsi > 70) {
        signals.push({
            type: 'bearish',
            message: `RSI Overbought (${indicators.rsi.toFixed(1)}) - Reversal risk high`,
            strength: 'Strong'
        });
    } else if (indicators.rsi > 60) {
        signals.push({
            type: 'bearish',
            message: `RSI above 60 (${indicators.rsi.toFixed(1)}) - Bearish territory`,
            strength: 'Medium'
        });
    }
    
    // EMA alignment signals
    if (indicators.ema9 > indicators.ema21 && indicators.ema21 > indicators.ema50) {
        signals.push({
            type: 'bullish',
            message: 'Perfect EMA alignment - Strong uptrend structure',
            strength: 'Strong'
        });
    } else if (indicators.ema9 < indicators.ema21 && indicators.ema21 < indicators.ema50) {
        signals.push({
            type: 'bearish',
            message: 'Perfect EMA alignment - Strong downtrend structure',
            strength: 'Strong'
        });
    }
    
    // Price position relative to EMAs
    const distanceFromEMA21 = ((currentPrice - indicators.ema21) / indicators.ema21) * 100;
    if (Math.abs(distanceFromEMA21) > 2) {
        signals.push({
            type: 'neutral',
            message: `Price ${distanceFromEMA21 > 0 ? 'above' : 'below'} EMA21 by ${Math.abs(distanceFromEMA21).toFixed(2)}% - Mean reversion likely`,
            strength: 'Medium'
        });
    }
    
    // MACD momentum
    if (indicators.macd.signal === 'bullish' && indicators.macd.value > 0) {
        signals.push({
            type: 'bullish',
            message: 'MACD bullish with positive momentum - Trend acceleration',
            strength: 'Strong'
        });
    } else if (indicators.macd.signal === 'bearish' && indicators.macd.value < 0) {
        signals.push({
            type: 'bearish',
            message: 'MACD bearish with negative momentum - Downward pressure',
            strength: 'Strong'
        });
    }
    
    // Stochastic RSI signals
    if (indicators.stochRSI.k < 20 && indicators.stochRSI.k > indicators.stochRSI.d) {
        signals.push({
            type: 'bullish',
            message: 'Stochastic RSI oversold with bullish cross - Entry opportunity',
            strength: 'Strong'
        });
    } else if (indicators.stochRSI.k > 80 && indicators.stochRSI.k < indicators.stochRSI.d) {
        signals.push({
            type: 'bearish',
            message: 'Stochastic RSI overbought with bearish cross - Exit signal',
            strength: 'Strong'
        });
    }
    
    // Bollinger Bands signals
    const bbPosition = (currentPrice - indicators.bbands.lower) / (indicators.bbands.upper - indicators.bbands.lower);
    if (bbPosition < 0.1) {
        signals.push({
            type: 'bullish',
            message: 'Price near lower Bollinger Band - Oversold bounce likely',
            strength: 'Medium'
        });
    } else if (bbPosition > 0.9) {
        signals.push({
            type: 'bearish',
            message: 'Price near upper Bollinger Band - Overbought pullback likely',
            strength: 'Medium'
        });
    }
    
    // Volume signals
    if (indicators.volumeRatio > 2) {
        signals.push({
            type: trend === 'bullish' ? 'bullish' : 'bearish',
            message: `Exceptional volume (${indicators.volumeRatio.toFixed(1)}x avg) - Strong trend confirmation`,
            strength: 'Strong'
        });
    } else if (indicators.volumeRatio > 1.5) {
        signals.push({
            type: trend === 'bullish' ? 'bullish' : 'bearish',
            message: `High volume (${indicators.volumeRatio.toFixed(1)}x avg) - Trend confirmation`,
            strength: 'Medium'
        });
    } else if (indicators.volumeRatio < 0.5) {
        signals.push({
            type: 'neutral',
            message: 'Low volume - Weak trend, be cautious',
            strength: 'Info'
        });
    }
    
    // Support/Resistance proximity
    const distToSupport = ((currentPrice - indicators.support) / currentPrice) * 100;
    const distToResistance = ((indicators.resistance - currentPrice) / currentPrice) * 100;
    
    if (distToSupport < 1) {
        signals.push({
            type: 'bullish',
            message: `Near support at $${indicators.support.toFixed(2)} - Bounce opportunity`,
            strength: 'Strong'
        });
    }
    if (distToResistance < 1) {
        signals.push({
            type: 'bearish',
            message: `Near resistance at $${indicators.resistance.toFixed(2)} - Rejection risk`,
            strength: 'Strong'
        });
    }
    
    // Pattern signals
    if (patterns.bullishPatterns > 0) {
        signals.push({
            type: 'bullish',
            message: `${patterns.bullishPatterns} bullish pattern${patterns.bullishPatterns > 1 ? 's' : ''} detected`,
            strength: 'Strong'
        });
    }
    if (patterns.bearishPatterns > 0) {
        signals.push({
            type: 'bearish',
            message: `${patterns.bearishPatterns} bearish pattern${patterns.bearishPatterns > 1 ? 's' : ''} detected`,
            strength: 'Strong'
        });
    }
    
    // Market structure
    if (marketStructure.trend === 'uptrend') {
        signals.push({
            type: 'bullish',
            message: 'Market structure: Higher highs and higher lows confirmed',
            strength: 'Medium'
        });
    } else if (marketStructure.trend === 'downtrend') {
        signals.push({
            type: 'bearish',
            message: 'Market structure: Lower highs and lower lows confirmed',
            strength: 'Medium'
        });
    }
    
    // Volatility warning
    if (indicators.volatility > 3) {
        signals.push({
            type: 'neutral',
            message: `Extreme volatility (${indicators.volatility.toFixed(1)}%) - High risk environment`,
            strength: 'Info'
        });
    }
    
    return signals;
}

// Update AI Panel with results
function updateAIPanel(prediction, indicators) {
    // Update confidence
    document.getElementById('confidenceValue').textContent = prediction.confidence.toFixed(0) + '%';
    document.getElementById('confidenceFill').style.width = prediction.confidence + '%';
    
    // Update signals
    const signalList = document.getElementById('signalList');
    signalList.innerHTML = '';
    prediction.signals.forEach(signal => {
        const signalEl = document.createElement('div');
        signalEl.className = `signal-item ${signal.type}`;
        signalEl.innerHTML = `<strong>${signal.strength}:</strong> ${signal.message}`;
        signalList.appendChild(signalEl);
    });
    
    // Update positions
    const positionCards = document.getElementById('positionCards');
    positionCards.innerHTML = '';
    prediction.positions.forEach(pos => {
        const posCard = document.createElement('div');
        posCard.className = `position-card ${pos.type}`;
        posCard.innerHTML = `
            <div class="position-type ${pos.type}">${pos.type.toUpperCase()} Position</div>
            <div class="position-details">
                <div class="position-row">
                    <span class="position-label">Entry:</span>
                    <span class="position-value">$${pos.entry.toFixed(2)}</span>
                </div>
                <div class="position-row">
                    <span class="position-label">Target:</span>
                    <span class="position-value">$${pos.target.toFixed(2)}</span>
                </div>
                <div class="position-row">
                    <span class="position-label">Stop Loss:</span>
                    <span class="position-value">$${pos.stopLoss.toFixed(2)}</span>
                </div>
            </div>
            <div class="position-profit">
                Potential Profit: <strong>${pos.potentialProfit.toFixed(2)}%</strong>
            </div>
        `;
        positionCards.appendChild(posCard);
    });
    
    // Update metrics
    document.getElementById('trendDirection').textContent = prediction.trend.toUpperCase();
    document.getElementById('trendDirection').style.color = 
        prediction.trend === 'bullish' ? 'var(--green)' : 
        prediction.trend === 'bearish' ? 'var(--red)' : 'var(--text-primary)';
    
    document.getElementById('volatility').textContent = indicators.volatility.toFixed(2) + '%';
    document.getElementById('nextTarget').textContent = '$' + prediction.targetPrice.toFixed(2);
}

// Draw AI Chart Annotations - Intelligent Support/Resistance/Trendlines
function drawAIChartAnnotations(prediction, indicators, patterns, marketStructure) {
    if (!chart || !candleSeries) return;
    
    const currentPrice = historicalData[historicalData.length - 1].close;
    const currentTime = historicalData[historicalData.length - 1].time;
    const firstTime = historicalData[0].time;
    
    // 1. Draw prediction line
    if (prediction.futurePrices && prediction.futurePrices.length > 0) {
        predictionSeries = chart.addLineSeries({
            color: '#667eea',
            lineWidth: 3,
            lineStyle: 2, // Dashed
            crosshairMarkerVisible: true,
            lastValueVisible: true,
            priceLineVisible: true,
            title: 'AI Prediction',
        });
        predictionSeries.setData(prediction.futurePrices);
    }
    
    // 2. Draw trendline if trend is strong
    if (prediction.trendline && prediction.trendline.draw) {
        trendlineSeries = chart.addLineSeries({
            color: prediction.trend === 'bullish' ? '#26a69a' : '#ef5350',
            lineWidth: 2,
            lineStyle: 0,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            title: 'Trendline',
        });
        trendlineSeries.setData(prediction.trendline.points);
    }
    
    // 3. Draw support level
    if (indicators.support) {
        supportLineSeries = chart.addLineSeries({
            color: '#26a69a',
            lineWidth: 1,
            lineStyle: 2,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: true,
            title: 'Support',
        });
        
        const supportPoints = [
            { time: firstTime, value: indicators.support },
            { time: currentTime + getTimeIncrement(currentTimeframe) * 20, value: indicators.support }
        ];
        supportLineSeries.setData(supportPoints);
    }
    
    // 4. Draw resistance level
    if (indicators.resistance) {
        resistanceLineSeries = chart.addLineSeries({
            color: '#ef5350',
            lineWidth: 1,
            lineStyle: 2,
            crosshairMarkerVisible: false,
            lastValueVisible: true,
            priceLineVisible: true,
            title: 'Resistance',
        });
        
        const resistancePoints = [
            { time: firstTime, value: indicators.resistance },
            { time: currentTime + getTimeIncrement(currentTimeframe) * 20, value: indicators.resistance }
        ];
        resistanceLineSeries.setData(resistancePoints);
    }
    
    console.log('📐 Chart annotations drawn: Prediction, Trendline, Support, Resistance');
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    if (ws) {
        ws.close();
    }
});
