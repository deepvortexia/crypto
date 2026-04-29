const BINANCE = 'https://api.binance.com/api/v3'

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

// Shared close-price cache (30-day daily history) — shared by fetchPrediction + fetchIndicators
let _ohlcCache = null
let _ohlcCacheTime = 0

async function getOhlc() {
  const now = Date.now()
  if (_ohlcCache && now - _ohlcCacheTime < 5 * 60 * 1000) return _ohlcCache
  const data = await get(`${BINANCE}/klines?symbol=BTCUSDT&interval=1d&limit=200`)
  _ohlcCache = data.map(k => parseFloat(k[4]))
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
  const ticker = await get(`${BINANCE}/ticker/24hr?symbol=BTCUSDT`)
  const price = parseFloat(ticker.lastPrice)
  return {
    price,
    change_24h_pct: parseFloat(ticker.priceChangePercent),
    volume_24h: parseFloat(ticker.quoteVolume),
    market_cap: price * 19700000,
    last_updated: new Date().toISOString(),
  }
}

export async function fetchPriceHistory() {
  const data = await get(`${BINANCE}/klines?symbol=BTCUSDT&interval=1d&limit=60`)
  return data.map(k => [k[0], parseFloat(k[4])])
}

export async function fetchSentiment() {
  const data = await get('/alternativeme/fng/?limit=1')
  const entry = data.data[0]
  return {
    value: parseInt(entry.value, 10),
    classification: entry.value_classification,
    timestamp: entry.timestamp,
  }
}

export async function fetchOnchain() {
  return get('/blockchain/stats')
}

const HORIZON_DAYS = { '4h': 4 / 24, '8h': 8 / 24, '12h': 12 / 24, '24h': 1, '1week': 7, '1month': 30 }

export async function fetchPrediction(horizon) {
  if (!(horizon in HORIZON_DAYS)) {
    throw new Error(`Invalid horizon "${horizon}". Must be one of: ${Object.keys(HORIZON_DAYS).join(', ')}`)
  }
  const closes = await getOhlc()
  const currentPrice = closes[closes.length - 1]

  const sma7 = _sma(closes, 7)
  const sma14 = _sma(closes, 14)
  const lastSma7 = sma7[sma7.length - 1]
  const lastSma14 = sma14[sma14.length - 1]

  const dailyTrend = (lastSma7 - lastSma14) / lastSma14
  const projectedChange = dailyTrend * HORIZON_DAYS[horizon]
  const predictedPrice = currentPrice * (1 + projectedChange)
  const changePct = projectedChange * 100

  const confidence = parseFloat((50 + Math.min(Math.abs(dailyTrend) * 100, 1) * 45).toFixed(1))

  return {
    predicted_price: parseFloat(predictedPrice.toFixed(2)),
    change_pct: parseFloat(changePct.toFixed(2)),
    direction: changePct >= 0 ? 'up' : 'down',
    confidence,
  }
}

export async function fetchIndicators() {
  const closes = await getOhlc()
  return {
    rsi: _calcRsi(closes),
    macd: _calcMacd(closes),
    bollinger_bands: _calcBollinger(closes),
    ema50:  parseFloat(_ema(closes, 50).at(-1).toFixed(2)),
    ema200: parseFloat(_ema(closes, 200).at(-1).toFixed(2)),
    price: closes[closes.length - 1],
    timestamp: new Date().toISOString(),
  }
}

export async function fetchFundingRate() {
  const data = await get('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1')
  const rate = parseFloat(data[0].fundingRate) * 100
  return { rate, signal: rate > 0.05 ? 'Longs overloaded' : rate < -0.05 ? 'Shorts overloaded' : 'Neutral' }
}

export async function fetchLongShortRatio() {
  const data = await get('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1')
  const ratio = parseFloat(data[0].longShortRatio)
  return { ratio, longPct: parseFloat(data[0].longAccount)*100, shortPct: parseFloat(data[0].shortAccount)*100, signal: ratio > 1.5 ? 'Too many longs' : ratio < 0.7 ? 'Too many shorts' : 'Balanced' }
}

export async function fetchOpenInterest() {
  const data = await get('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT')
  return { value: parseFloat(data.openInterest) }
}

export async function fetchWhales() {
  const data = await get('https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1')
  const buyRatio = parseFloat(data[0].buyVol) / (parseFloat(data[0].buyVol) + parseFloat(data[0].sellVol)) * 100
  const sellRatio = 100 - buyRatio
  return {
    largeCount: Math.round(buyRatio) + '% buy / ' + Math.round(sellRatio) + '% sell',
    buyVol: parseFloat(data[0].buyVol),
    sellVol: parseFloat(data[0].sellVol),
    signal: buyRatio > 55 ? 'Whales buying' : buyRatio < 45 ? 'Whales selling' : 'Neutral'
  }
}

export async function fetchLiquidations() {
  const data = await get('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=24')
  const latest = parseFloat(data[data.length-1].sumOpenInterest)
  const prev = parseFloat(data[0].sumOpenInterest)
  const change = ((latest-prev)/prev*100).toFixed(2)
  const latestUsd = parseFloat(data[data.length-1].sumOpenInterestValue)
  return { current: latestUsd, change: parseFloat(change), signal: change > 5 ? 'OI rising - trend strengthening' : change < -5 ? 'OI dropping - trend weakening' : 'OI stable' }
}

export async function fetchOrderBook() {
  const data = await get('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5')
  const bestBid = parseFloat(data.bids[0][0])  // highest buy price
  const bestAsk = parseFloat(data.asks[0][0])  // lowest sell price
  const bidVol = data.bids.reduce((a,b)=>a+parseFloat(b[0])*parseFloat(b[1]),0)
  const askVol = data.asks.reduce((a,b)=>a+parseFloat(b[0])*parseFloat(b[1]),0)
  const ratio = bidVol/askVol
  return { topBid: bestBid, topAsk: bestAsk, ratio, signal:ratio>1.3?'Strong buy wall':ratio<0.7?'Strong sell wall':'Balanced' }
}

export async function fetchMempool() {
  const [stats, fees] = await Promise.all([
    get('https://mempool.space/api/mempool'),
    get('https://mempool.space/api/v1/fees/recommended')
  ])
  return {
    count: stats.count,
    vsize: stats.vsize,
    fastestFee: fees.fastestFee,
    halfHourFee: fees.halfHourFee,
    hourFee: fees.hourFee,
    signal: stats.count > 50000 ? 'Network congested' : stats.count > 20000 ? 'Moderate activity' : 'Network clear'
  }
}

export async function fetchNews() {
  const data = await get('/coinstats/news?limit=5')
  const articles = data.news || data || []
  return articles.slice(0, 5).map(n => ({
    title: n.title || n.feedTitle || '',
    url: n.link || n.url || '#',
    source: n.source || n.feedTitle || 'CoinStats',
    sentiment: n.sentiment === 'positive' ? 'bullish' : n.sentiment === 'negative' ? 'bearish' : 'neutral',
    time: n.publishedAt ? new Date(n.publishedAt).toLocaleDateString() : ''
  }))
}

export async function fetchKeyLevels(currentPrice) {
  const data = await get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=30')
  const highs = data.map(k=>parseFloat(k[2]))
  const lows = data.map(k=>parseFloat(k[3]))
  const closes = data.map(k=>parseFloat(k[4]))
  const H = Math.max(...highs), L = Math.min(...lows)
  const P = (H + L + closes[closes.length-1]) / 3
  const fib = [0.236,0.382,0.5,0.618,0.786].map(f=>({level:f,price:parseFloat((H-(H-L)*f).toFixed(0))}))
  return {
    pivot:parseFloat(P.toFixed(0)),
    r1:parseFloat((2*P-L).toFixed(0)), r2:parseFloat((P+(H-L)).toFixed(0)), r3:parseFloat((H+2*(P-L)).toFixed(0)),
    s1:parseFloat((2*P-H).toFixed(0)), s2:parseFloat((P-(H-L)).toFixed(0)), s3:parseFloat((L-2*(H-P)).toFixed(0)),
    fib, nearLevel:fib.find(f=>Math.abs(f.price-currentPrice)/currentPrice<0.01)
  }
}
