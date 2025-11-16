# BTC/USD Live Trading Chart

A professional, real-time Bitcoin price tracker with interactive charts, built with vanilla JavaScript and Chart.js.

## Features

- **Real-time Price Updates**: Live BTC/USD prices updated every 60 seconds
- **Interactive Charts**: Beautiful candlestick-style line charts with zoom and pan capabilities
- **Multiple Timeframes**: 1H, 4H, 1D, 7D, and 30D views
- **Key Statistics**: 24h High/Low, Volume, and Market Cap
- **Fully Responsive**: Perfect mobile experience for iOS and Android
- **Dark Theme**: Easy on the eyes with a professional dark UI
- **Fast Loading**: Optimized API calls with fallback support

## Data Sources

- Primary: Binance API (faster real-time updates)
- Fallback: CoinGecko API (reliable historical data)

## How to Use

1. Open `index.html` in any modern web browser
2. The chart will automatically load with 1-hour timeframe
3. Click timeframe buttons to change the view period
4. Use the refresh button to manually update data
5. Hover/tap on the chart to see exact prices at specific times

## Mobile Support

- Fully optimized for iOS Safari and Chrome
- Touch-friendly controls
- Responsive design adapts to all screen sizes
- Smooth animations and transitions
- No horizontal scrolling

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Android Chrome 90+

## API Rate Limits

- Binance: No API key required, generous rate limits
- CoinGecko: 50 calls/minute (free tier)

The app is designed to stay well within these limits with 60-second update intervals.

## Files

- `index.html` - Main HTML structure
- `styles.css` - All styling and responsive design
- `script.js` - Application logic and API integration
- `README.md` - This file

## License

Free to use and modify. No attribution required.
