const BASE = 'https://crypto-production-f7c5.up.railway.app'

async function get(url) {
  let res
  try {
    res = await fetch(url)
  } catch (err) {
    throw new Error(`Network error: ${err.message}`)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

export const fetchLivePrice    = () => get(`${BASE}/api/btc/price`)
export const fetchSentiment    = () => get(`${BASE}/api/btc/sentiment`)
export const fetchIndicators   = () => get(`${BASE}/api/btc/indicators`)
export const fetchPredictions  = () => get(`${BASE}/api/btc/predict`)
export const fetchHistory      = () => get(`${BASE}/api/btc/history`)
export const fetchAccuracy     = () => get(`${BASE}/api/btc/accuracy`)

// Keep fetchPrediction(horizon) as a wrapper so existing callers still work
export async function fetchPrediction(horizon) {
  const all = await fetchPredictions()
  const map = { '4h': '4h', '8h': '8h', '12h': '12h', '24h': '24h', '1month': '1month' }
  const key = map[horizon]
  if (!key || !all[key]) throw new Error(`No prediction for horizon "${horizon}"`)
  return {
    predicted_price: all[key].price,
    change_pct:      all[key].change_pct ?? null,
    direction:       all[key].direction,
    confidence:      all[key].confidence,
  }
}

// Keep fetchOnchain — Railway backend doesn't expose onchain yet, fall back gracefully
export async function fetchOnchain() {
  return get(`${BASE}/api/btc/price`).then(() => null).catch(() => null)
}

// fetchPriceHistory uses /history endpoint
export async function fetchPriceHistory() {
  const rows = await fetchHistory()
  return rows.map(r => [new Date(r.timestamp).getTime(), r.close])
}
