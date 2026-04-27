const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

class ApiError extends Error {
  constructor(status, message, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`
  let res
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    })
  } catch (err) {
    throw new ApiError(0, `Network error: ${err.message}`)
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail || body.message || detail
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, detail)
  }

  return res.json()
}

/**
 * Current BTC price from CoinGecko.
 * Returns: { price, change_24h_pct, market_cap, volume_24h, last_updated }
 */
export function fetchLivePrice() {
  return request('/api/price/live')
}

/**
 * Ensemble prediction for the given horizon.
 * @param {'4h'|'8h'|'12h'|'24h'|'1month'} horizon
 * Returns: { horizon, current_price, predicted_price, change_pct, direction,
 *            confidence, model_predictions, weights_used, timestamp, target_time }
 */
export function fetchPrediction(horizon) {
  const valid = ['4h', '8h', '12h', '24h', '1month']
  if (!valid.includes(horizon)) throw new Error(`Invalid horizon "${horizon}". Must be one of: ${valid.join(', ')}`)
  return request(`/api/predict/${horizon}`)
}

/**
 * Technical indicators snapshot.
 * Returns: { rsi, macd, bollinger_bands, ema, obv, atr, price, timestamp }
 */
export function fetchIndicators() {
  return request('/api/indicators')
}

/**
 * Fear & Greed Index from Alternative.me.
 * Returns: { value, classification, timestamp, history }
 */
export function fetchSentiment() {
  return request('/api/sentiment')
}

/**
 * On-chain metrics from Blockchain.com.
 * Returns: { hash_rate_th, difficulty, blocks_mined_today, mempool_size,
 *            total_fees_btc, minutes_between_blocks, trade_volume_usd, ... }
 */
export function fetchOnchain() {
  return request('/api/onchain')
}

/**
 * Historical prediction accuracy broken down by horizon.
 * Returns: { total_predictions, overall_mape, overall_direction_accuracy,
 *            by_horizon, current_weights }
 */
export function fetchAccuracy() {
  return request('/api/accuracy')
}

/**
 * Backend health / model training status.
 * Returns: { status, is_training, last_trained, models_ready }
 */
export function fetchStatus() {
  return request('/api/status')
}
