class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function get(url) {
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    throw new ApiError(0, `Network error: ${err.message}`)
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText)
  return res.json()
}

// Shared OHLC cache so fetchPrediction and fetchIndicators share one request per 5 min
let _ohlcCache = null
let _ohlcCacheTime = 0

async function getOhlc() {
  const now = Date.now()
  if (_ohlcCache && now - _ohlcCacheTime < 5 * 60 * 1000) return _ohlcCache
  _ohlcCache = await get('https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=30')
  _ohlcCacheTime = now
  return _ohlcCache
}

// --- Local math helpers ---

function _ema(values, period) {
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  const result = [prev]
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

function _sma(values, period) {
  const result = []
  for (let i = period - 1; i < values.length; i++) {
    result.push(values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period)
  }
  return result
}

function _stddev(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length)
}

function _calcRsi(closes, period = 14) {
  if (closes.length < period + 1) return null
  const gains = [], losses = []
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    gains.push(d > 0 ? d : 0)
    losses.push(d < 0 ? -d : 0)
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period
  }
  if (avgLoss === 0) return 100
  return parseFloat((100 - 100 / (1 + avgGain / avgLoss)).toFixed(2))
}

function _calcMacd(closes) {
  if (closes.length < 35) return null
  const ema12 = _ema(closes, 12)
  const ema26 = _ema(closes, 26)
  // ema12 is longer by 14 values; align to ema26 indices
  const offset = ema12.length - ema26.length
  const macdLine = ema26.map((v, i) => ema12[i + offset] - v)
  const signal = _ema(macdLine, 9)
  const lastMacd = macdLine[macdLine.length - 1]
  const lastSignal = signal[signal.length - 1]
  return {
    macd: parseFloat(lastMacd.toFixed(2)),
    signal: parseFloat(lastSignal.toFixed(2)),
    histogram: parseFloat((lastMacd - lastSignal).toFixed(2)),
  }
}

function _calcBollinger(closes, period = 20) {
  if (closes.length < period) return null
  const slice = closes.slice(-period)
  const middle = slice.reduce((a, b) => a + b, 0) / period
  const sd = _stddev(slice)
  return {
    upper: parseFloat((middle + 2 * sd).toFixed(2)),
    middle: parseFloat(middle.toFixed(2)),
    lower: parseFloat((middle - 2 * sd).toFixed(2)),
  }
}

// --- Public API ---

export async function fetchLivePrice() {
  const data = await get(
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true'
  )
  const btc = data.bitcoin
  return {
    price: btc.usd,
    change_24h_pct: btc.usd_24h_change,
    market_cap: btc.usd_market_cap,
    volume_24h: btc.usd_24h_vol,
    last_updated: new Date().toISOString(),
  }
}

export async function fetchPriceHistory() {
  return get(
    'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily'
  )
}

export async function fetchSentiment() {
  const data = await get('https://api.alternative.me/fng/?limit=1')
  const entry = data.data[0]
  return {
    value: parseInt(entry.value, 10),
    classification: entry.value_classification,
    timestamp: entry.timestamp,
  }
}

export async function fetchOnchain() {
  return get('https://api.blockchain.info/stats')
}

const HORIZON_DAYS = { '4h': 4 / 24, '8h': 8 / 24, '12h': 12 / 24, '24h': 1, '1month': 30 }

export async function fetchPrediction(horizon) {
  if (!(horizon in HORIZON_DAYS)) {
    throw new Error(`Invalid horizon "${horizon}". Must be one of: ${Object.keys(HORIZON_DAYS).join(', ')}`)
  }
  const ohlc = await getOhlc()
  const closes = ohlc.map(c => c[4])
  const currentPrice = closes[closes.length - 1]

  const sma7 = _sma(closes, 7)
  const sma14 = _sma(closes, 14)
  const lastSma7 = sma7[sma7.length - 1]
  const lastSma14 = sma14[sma14.length - 1]

  // Daily momentum rate from short/long SMA divergence
  const dailyTrend = (lastSma7 - lastSma14) / lastSma14
  const projectedChange = dailyTrend * HORIZON_DAYS[horizon]
  const predictedPrice = currentPrice * (1 + projectedChange)
  const changePct = projectedChange * 100

  // Confidence: stronger trend signal = higher confidence, bounded 50–95 %
  const confidence = parseFloat((50 + Math.min(Math.abs(dailyTrend) * 100, 1) * 45).toFixed(1))

  return {
    predicted_price: parseFloat(predictedPrice.toFixed(2)),
    change_pct: parseFloat(changePct.toFixed(2)),
    direction: changePct >= 0 ? 'up' : 'down',
    confidence,
  }
}

export async function fetchIndicators() {
  const ohlc = await getOhlc()
  const closes = ohlc.map(c => c[4])
  return {
    rsi: _calcRsi(closes),
    macd: _calcMacd(closes),
    bollinger_bands: _calcBollinger(closes),
    price: closes[closes.length - 1],
    timestamp: new Date().toISOString(),
  }
}
