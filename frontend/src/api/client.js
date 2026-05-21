import { supabase } from '../lib/supabase'

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

export async function pingHealth() {
  return get(`${BACKEND_URL}/health`, { timeout: 5000, retries: 0 })
}

export async function fetchLivePrice() {
  try {
    return await get(`${BACKEND_URL}/api/price/live`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchLivePrice] Failed:', err.message)
    return null
  }
}

export async function fetchPriceHistory() {
  try {
    // Route through backend proxy (already fetched from CoinGecko) — avoids geo-blocks
    const data = await get(`${BACKEND_URL}/api/ohlc`, { timeout: 10000, retries: 2 })
    return data.slice(-60).map(k => [k[0], k[4]])
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

let _sessionPromise = null
let _sessionTs = 0
function getProSession() {
  if (_sessionPromise && Date.now() - _sessionTs < 30000) return _sessionPromise
  _sessionTs = Date.now()
  _sessionPromise = (async () => {
    let { data: { session } } = await supabase.auth.getSession()
    if (session?.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
      const { data: refreshed } = await supabase.auth.refreshSession()
      if (refreshed?.session) session = refreshed.session
    }
    if (!session) { _sessionPromise = null; throw new ApiError(401, 'Not authenticated') }
    return session
  })()
  return _sessionPromise
}

export async function fetchPrediction(horizon) {
  if (horizon === '1h') {
    return get(`${BACKEND_URL}/api/predict/1h`, { retries: 1 })
  }
  const session = await getProSession()
  return get(`${BACKEND_URL}/api/predict/${horizon}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    retries: 1,
  })
}

export async function fetchIndicators() {
  const [ohlcResult, backendResult] = await Promise.allSettled([
    getOhlc(),
    get(`${BACKEND_URL}/api/indicators`, { timeout: 10000, retries: 1 }),
  ])
  const closes = ohlcResult.status === 'fulfilled' ? ohlcResult.value : []
  let ema50  = closes.length ? parseFloat(_ema(closes, 50).at(-1).toFixed(2))  : null
  let ema200 = closes.length ? parseFloat(_ema(closes, 200).at(-1).toFixed(2)) : null
  const backend = backendResult.status === 'fulfilled' ? backendResult.value : null
  if (backend?.ema?.ema50)  ema50  = backend.ema.ema50
  if (backend?.ema?.ema200) ema200 = backend.ema.ema200
  return {
    rsi: _calcRsi(closes),
    macd: _calcMacd(closes),
    bollinger_bands: _calcBollinger(closes),
    ema50,
    ema200,
    price: closes[closes.length - 1] ?? null,
    timestamp: new Date().toISOString(),
  }
}

export async function fetchFundingRate() {
  try {
    return await get(`${BACKEND_URL}/api/funding-rate`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchFundingRate] Failed:', err.message)
    return { rate: 0, signal: 'Unknown' }
  }
}

export async function fetchLongShortRatio() {
  try {
    return await get(`${BACKEND_URL}/api/long-short-ratio`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchLongShortRatio] Failed:', err.message)
    return { ratio: 1.0, longPct: 50, shortPct: 50, signal: 'Unknown' }
  }
}

export async function fetchOpenInterest() {
  try {
    return await get(`${BACKEND_URL}/api/open-interest`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchOpenInterest] Failed:', err.message)
    return { value: null }
  }
}

export async function fetchWhales() {
  try {
    return await get(`${BACKEND_URL}/api/whales`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchWhales] Failed:', err.message)
    return { largeCount: '50% buy / 50% sell', buyVol: 0, sellVol: 0, signal: 'Unknown' }
  }
}

export async function fetchLiquidations() {
  try {
    return await get(`${BACKEND_URL}/api/liquidations`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchLiquidations] Failed:', err.message)
    return { current: null, change: 0, signal: 'Unknown' }
  }
}

export async function fetchOrderBook() {
  try {
    return await get(`${BACKEND_URL}/api/order-book`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchOrderBook] Failed:', err.message)
    return { topBid: null, topAsk: null, ratio: 1.0, signal: 'Unknown' }
  }
}

export async function fetchMempool() {
  try {
    const [stats, fees] = await Promise.all([
      get('https://mempool.space/api/mempool', { timeout: 5000, retries: 0, fallback: null }),
      get('https://mempool.space/api/v1/fees/recommended', { timeout: 5000, retries: 0, fallback: null })
    ])
    if (!stats || !fees) return null
    return {
      count: stats.count,
      vsize: stats.vsize,
      fastestFee: fees.fastestFee,
      halfHourFee: fees.halfHourFee,
      hourFee: fees.hourFee,
      signal: fees.fastestFee >= 50 ? 'Network congested 🔥' : fees.fastestFee >= 20 ? 'Moderate congestion' : fees.fastestFee >= 5 ? 'Normal activity' : 'Network quiet'
    }
  } catch {
    return null
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

export async function fetchKeyLevels(_currentPrice) {
  try {
    return await get(`${BACKEND_URL}/api/key-levels`, { timeout: 10000, retries: 2 })
  } catch (err) {
    console.error('[fetchKeyLevels] Failed:', err.message)
    return null
  }
}

export async function fetchOHLCCandles(limit = 100) {
  try {
    return await get(`${BACKEND_URL}/api/ohlc-candles?limit=${limit}`, { timeout: 10000, retries: 2 })
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
    const detail = data?.detail || {}
    const msg = detail.message || 'No credits remaining'
    throw Object.assign(new Error(msg), { status: res.status, code: detail.error })
  }
  return data
}

export async function openBillingPortal() {
  const headers = await getAuthHeaders()
  const res = await fetch(`${BACKEND_URL}/api/billing-portal`, { method: 'POST', headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Billing portal unavailable')
  }
  const { url } = await res.json()
  window.location.href = url
}

export async function purchaseCreditsPack(pack) {
  const headers = { ...(await getAuthHeaders()), 'Content-Type': 'application/json' }
  const res = await fetch(`${BACKEND_URL}/api/credits/purchase`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pack: String(pack) }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.detail || data?.message || 'Failed to start checkout'
    throw Object.assign(new Error(typeof msg === 'string' ? msg : 'Failed to start checkout'), { status: res.status })
  }
  return data  // { url, credits, dollars }
}

