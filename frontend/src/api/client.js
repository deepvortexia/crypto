import { supabase } from '../lib/supabase'

const BINANCE = 'https://api.binance.com/api/v3'
const COINGECKO = 'https://api.coingecko.com/api/v3'
const BACKEND_URL = 'https://crypto-production-f7c5.up.railway.app'

class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Robust fetch with timeout, retry, and error handling
async function get(url, options = {}) {
  const {
    timeout = 10000,
    retries = 2,
    fallback = null
  } = options

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new ApiError(res.status, res.statusText)
      }

      return await res.json()
    } catch (err) {
      const isLastAttempt = attempt === retries

      // Log error on last attempt
      if (isLastAttempt) {
        console.warn(`[API] Failed to fetch ${url} after ${retries + 1} attempts:`, err.message)
      }

      // If last attempt and fallback provided, return fallback
      if (isLastAttempt && fallback !== null) {
        return fallback
      }

      // If last attempt and no fallback, throw error
      if (isLastAttempt) {
        throw new ApiError(err.status || 0, `Network error: ${err.message}`)
      }

      // Wait before retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }
}

// Shared close-price cache (30-day daily history) — shared by fetchPrediction + fetchIndicators
let _ohlcCache = null
let _ohlcCacheTime = 0

async function getOhlc() {
  const now = Date.now()

  // Return fresh cache if available (< 5 min old)
  if (_ohlcCache && now - _ohlcCacheTime < 5 * 60 * 1000) {
    return _ohlcCache
  }

  try {
    const data = await get(`${BACKEND_URL}/api/ohlc`, {
      timeout: 10000,
      retries: 2
    })
    _ohlcCache = data.map(k => parseFloat(k[4]))
    _ohlcCacheTime = now
    return _ohlcCache
  } catch (err) {
    // If fetch fails but we have stale cache (< 30 min old), use it
    if (_ohlcCache && now - _ohlcCacheTime < 30 * 60 * 1000) {
      console.warn('[getOhlc] Using stale cache due to API failure:', err.message)
      return _ohlcCache
    }
    // No cache available, throw error
    throw err
  }
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
  try {
    const ticker = await get(`${BINANCE}/ticker/24hr?symbol=BTCUSDT`, {
      timeout: 10000,
      retries: 2
    })
    const price = parseFloat(ticker.lastPrice)
    return {
      price,
      change_24h_pct: parseFloat(ticker.priceChangePercent),
      volume_24h: parseFloat(ticker.quoteVolume),
      market_cap: price * 19700000,
      last_updated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[fetchLivePrice] Failed:', err.message)
    return null
  }
}

export async function fetchPriceHistory() {
  try {
    const data = await get(`${BINANCE}/klines?symbol=BTCUSDT&interval=1d&limit=60`, {
      timeout: 10000,
      retries: 2
    })
    return data.map(k => [k[0], parseFloat(k[4])])
  } catch (err) {
    console.error('[fetchPriceHistory] Failed:', err.message)
    return []
  }
}

export async function fetchSentiment() {
  try {
    const data = await get(`${BACKEND_URL}/api/sentiment`, {
      timeout: 10000,
      retries: 2
    })

    // Backend returns flat object with history array
    return {
      value: parseInt(data.value, 10),
      classification: data.classification,
      timestamp: data.timestamp,
      history: Array.isArray(data.history) ? data.history : [],
    }
  } catch (err) {
    console.error('[fetchSentiment] Failed:', err.message)
    return { value: 50, classification: 'Neutral', timestamp: null, history: [] }
  }
}

export async function fetchNewsSentiment() {
  try {
    return await get(`${BACKEND_URL}/api/news-sentiment`, { timeout: 15000, retries: 1 })
  } catch (err) {
    console.error('[fetchNewsSentiment] Failed:', err.message)
    return null
  }
}

export async function fetchOnchain() {
  try {
    const data = await get(`${BACKEND_URL}/api/onchain`, {
      timeout: 10000,
      retries: 2
    })

    return data
  } catch (err) {
    console.error('[fetchOnchain] Failed:', err.message)
    return null
  }
}

export async function fetchPrediction(horizon) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new ApiError(401, 'Not authenticated')
  return get(`${BACKEND_URL}/api/predict/${horizon}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    retries: 1,
  })
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
  try {
    const data = await get('https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=1', {
      timeout: 10000,
      retries: 2
    })
    const rate = parseFloat(data[0].fundingRate) * 100
    return { rate, signal: rate > 0.05 ? 'Longs overloaded' : rate < -0.05 ? 'Shorts overloaded' : 'Neutral' }
  } catch (err) {
    console.error('[fetchFundingRate] Failed:', err.message)
    return { rate: 0, signal: 'Unknown' }
  }
}

export async function fetchLongShortRatio() {
  try {
    const data = await get('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1', {
      timeout: 10000,
      retries: 2
    })
    const ratio = parseFloat(data[0].longShortRatio)
    return { ratio, longPct: parseFloat(data[0].longAccount)*100, shortPct: parseFloat(data[0].shortAccount)*100, signal: ratio > 1.5 ? 'Too many longs' : ratio < 0.7 ? 'Too many shorts' : 'Balanced' }
  } catch (err) {
    console.error('[fetchLongShortRatio] Failed:', err.message)
    return { ratio: 1.0, longPct: 50, shortPct: 50, signal: 'Unknown' }
  }
}

export async function fetchOpenInterest() {
  try {
    const data = await get('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT', {
      timeout: 10000,
      retries: 2
    })
    return { value: parseFloat(data.openInterest) }
  } catch (err) {
    console.error('[fetchOpenInterest] Failed:', err.message)
    return { value: null }
  }
}

export async function fetchWhales() {
  try {
    const data = await get('https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=BTCUSDT&period=1h&limit=1', {
      timeout: 10000,
      retries: 2
    })
    const buyRatio = parseFloat(data[0].buyVol) / (parseFloat(data[0].buyVol) + parseFloat(data[0].sellVol)) * 100
    const sellRatio = 100 - buyRatio
    return {
      largeCount: Math.round(buyRatio) + '% buy / ' + Math.round(sellRatio) + '% sell',
      buyVol: parseFloat(data[0].buyVol),
      sellVol: parseFloat(data[0].sellVol),
      signal: buyRatio > 55 ? 'Whales buying' : buyRatio < 45 ? 'Whales selling' : 'Neutral'
    }
  } catch (err) {
    console.error('[fetchWhales] Failed:', err.message)
    return { largeCount: '50% buy / 50% sell', buyVol: 0, sellVol: 0, signal: 'Unknown' }
  }
}

export async function fetchLiquidations() {
  try {
    const data = await get('https://fapi.binance.com/futures/data/openInterestHist?symbol=BTCUSDT&period=1h&limit=24', {
      timeout: 10000,
      retries: 2
    })
    const latest = parseFloat(data[data.length-1].sumOpenInterest)
    const prev = parseFloat(data[0].sumOpenInterest)
    const change = ((latest-prev)/prev*100).toFixed(2)
    const latestUsd = parseFloat(data[data.length-1].sumOpenInterestValue)
    return { current: latestUsd, change: parseFloat(change), signal: change > 5 ? 'OI rising - trend strengthening' : change < -5 ? 'OI dropping - trend weakening' : 'OI stable' }
  } catch (err) {
    console.error('[fetchLiquidations] Failed:', err.message)
    return { current: null, change: 0, signal: 'Unknown' }
  }
}

export async function fetchOrderBook() {
  try {
    const data = await get('https://api.binance.com/api/v3/depth?symbol=BTCUSDT&limit=5', {
      timeout: 10000,
      retries: 2
    })
    const bestBid = parseFloat(data.bids[0][0])  // highest buy price
    const bestAsk = parseFloat(data.asks[0][0])  // lowest sell price
    const bidVol = data.bids.reduce((a,b)=>a+parseFloat(b[0])*parseFloat(b[1]),0)
    const askVol = data.asks.reduce((a,b)=>a+parseFloat(b[0])*parseFloat(b[1]),0)
    const ratio = parseFloat((bidVol/askVol).toFixed(2))
    return { topBid: bestBid, topAsk: bestAsk, ratio, signal:ratio>1.3?'Strong buy wall':ratio<0.7?'Strong sell wall':'Balanced' }
  } catch (err) {
    console.error('[fetchOrderBook] Failed:', err.message)
    return { topBid: null, topAsk: null, ratio: 1.0, signal: 'Unknown' }
  }
}

export async function fetchMempool() {
  try {
    const [stats, fees] = await Promise.all([
      get('https://mempool.space/api/mempool', { timeout: 10000, retries: 2 }),
      get('https://mempool.space/api/v1/fees/recommended', { timeout: 10000, retries: 2 })
    ])

    // DEBUG: Print raw mempool.space responses
    return {
      count: stats.count,
      vsize: stats.vsize,
      fastestFee: fees.fastestFee,
      halfHourFee: fees.halfHourFee,
      hourFee: fees.hourFee,
      signal: stats.count > 50000 ? 'Network congested' : stats.count > 20000 ? 'Moderate activity' : 'Network clear'
    }
  } catch (err) {
    console.error('[fetchMempool] Failed:', err.message)
    return {
      count: null,
      vsize: null,
      fastestFee: null,
      halfHourFee: null,
      hourFee: null,
      signal: 'Unknown'
    }
  }
}

export async function fetchNews() {
  const data = await get('https://api.coinstats.app/public/v1/news?limit=5')
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
  try {
    // Use 7-day data for more dynamic Fibonacci levels
    const data = await get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=4h&limit=42', {
      timeout: 10000,
      retries: 2
    })
    const highs = data.map(k => parseFloat(k[2]))
    const lows = data.map(k => parseFloat(k[3]))
    const closes = data.map(k => parseFloat(k[4]))

    // 7-day high/low for Fibonacci
    const H = Math.max(...highs)
    const L = Math.min(...lows)
    const lastClose = closes[closes.length - 1]

    // Classic pivot point
    const P = (H + L + lastClose) / 3

    // Fibonacci retracements from swing high to swing low
    const range = H - L
    const fib = [0.236, 0.382, 0.5, 0.618, 0.786].map(f => ({
      level: f,
      price: Math.round(H - range * f)
    }))

    // Find if current price is near any Fibonacci level (within 0.8%)
    const nearLevel = fib.find(f => Math.abs(f.price - currentPrice) / currentPrice < 0.008)

    return {
      pivot: Math.round(P),
      r1: Math.round(2 * P - L),
      r2: Math.round(P + range),
      r3: Math.round(H + 2 * (P - L)),
      s1: Math.round(2 * P - H),
      s2: Math.round(P - range),
      s3: Math.round(L - 2 * (H - P)),
      fib,
      nearLevel,
      range: { high: Math.round(H), low: Math.round(L) }
    }
  } catch (err) {
    console.error('[fetchKeyLevels] Failed:', err.message)
    return null
  }
}

export async function fetchOHLCCandles(limit = 100) {
  try {
    const data = await get(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=${limit}`, {
      timeout: 10000,
      retries: 2
    })
    return data.map(k => ({
      x: k[0],
      o: parseFloat(k[1]),
      h: parseFloat(k[2]),
      l: parseFloat(k[3]),
      c: parseFloat(k[4]),
    }))
  } catch (err) {
    console.error('[fetchOHLCCandles] Failed:', err.message)
    return []
  }
}

export async function fetchMarketTensions() {
  return await get(`${BACKEND_URL}/api/market-tensions`, { timeout: 30000, retries: 1 })
}

// ── Subscription API ────────────────────────────────────────────────────────
async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function fetchSubscriptionStatus() {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BACKEND_URL}/api/subscription-status`, { headers })
    if (!res.ok) throw new Error(res.statusText)
    return await res.json()
  } catch (err) {
    console.error('[fetchSubscriptionStatus] Failed:', err.message)
    return { status: 'inactive', current_period_end: null }
  }
}

export async function createCheckoutSession() {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}/api/create-checkout-session`, {
    method: 'POST',
    headers
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Checkout failed')
  }
  return await res.json()
}

export async function fetchDeepAnalysisRemaining() {
  try {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BACKEND_URL}/api/deep-analysis/remaining`, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function consumeDeepAnalysisCredit() {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}/api/deep-analysis/use`, { method: 'POST', headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.detail?.message || 'Daily limit reached'
    throw Object.assign(new Error(msg), { status: res.status })
  }
  return data
}

export async function fetchUserCredits() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { credits_remaining: 0 }
    const { data, error } = await supabase
      .from('user_credits')
      .select('credits_remaining')
      .eq('user_id', session.user.id)
      .single()
    if (error) throw error
    return data || { credits_remaining: 3 }
  } catch (err) {
    console.error('[fetchUserCredits] Failed:', err.message)
    return { credits_remaining: 0 }
  }
}
