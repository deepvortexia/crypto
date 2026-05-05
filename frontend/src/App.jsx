import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
import About from './pages/About'
import {
  fetchLivePrice,
  fetchSentiment,
  fetchPrediction,
  fetchIndicators,
  fetchOnchain,
  fetchFundingRate,
  fetchLongShortRatio,
  fetchOpenInterest,
  fetchWhales,
  fetchMempool,
  fetchOrderBook,
  fetchKeyLevels,
  fetchLiquidations,
} from './api/client'

// ── tokens ───────────────────────────────────────────────────────────────────
const G = {
  bg:       '#0a0a0a',
  card:     '#141414',
  border:   '#2a1f00',
  gold:     '#f59e0b',
  goldDim:  'rgba(245,158,11,0.15)',
  goldGlow: 'rgba(245,158,11,0.4)',
  green:    '#10b981',
  red:      '#ef4444',
  text:     '#a8a29e',
  bright:   '#fef3c7',
}

// ── helpers ──────────────────────────────────────────────────────────────────
const fmtPrice = n =>
  n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

const fmtLarge = n => {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

const fmtPct = (n, decimals = 2) =>
  n == null ? '—' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(decimals)}%`

const fmtNum = (n, dec = 2) =>
  n == null ? '—' : Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })

// ── shared styles ─────────────────────────────────────────────────────────────
const cardStyle = {
  background: G.card,
  border: `1px solid ${G.border}`,
  borderRadius: 10,
  padding: '18px 22px',
  boxShadow: `0 0 0 1px ${G.border}, 0 4px 32px rgba(0,0,0,0.6)`,
  transition: 'border-color 0.2s, box-shadow 0.2s',
}

const labelStyle = {
  fontFamily: '"Share Tech Mono", monospace',
  fontSize: 10,
  letterSpacing: '0.25em',
  color: G.text,
  textTransform: 'uppercase',
  marginBottom: 8,
}

const goldText = {
  color: G.gold,
  textShadow: `0 0 8px ${G.goldGlow}`,
}

const sectionLabel = {
  fontFamily: '"Share Tech Mono", monospace',
  fontSize: 10,
  letterSpacing: '0.3em',
  color: G.text,
  textTransform: 'uppercase',
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: `1px solid ${G.border}`,
}

// ── sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, valueColor, icon }) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={labelStyle}>{label}</div>
        {icon && <span style={{ fontSize: 16, opacity: 0.5 }}>{icon}</span>}
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 24, fontWeight: 'normal', color: valueColor || G.gold, ...( valueColor ? {} : goldText) }}>
        {value}
      </div>
      {sub && <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: G.text, marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

const HORIZON_CONFIDENCE = { '4h': 92, '8h': 88, '12h': 84, '24h': 78, '1week': 65, '1month': 51 }

function PredCard({ horizon, horizonKey, data, loading }) {
  const gold = G.gold
  // Derive direction from change_pct (single source of truth — never trust the string field alone)
  const up = data != null ? (data.change_pct ?? 0) >= 0 : false
  const dirColor = up ? G.green : G.red
  const conf = data ? (HORIZON_CONFIDENCE[horizonKey] ?? (data.confidence != null ? Math.round(data.confidence > 1 ? data.confidence : data.confidence * 100) : 75)) : 0

  return (
    <div style={{
      ...cardStyle,
      borderColor: data ? (up ? `rgba(16,185,129,0.3)` : `rgba(239,68,68,0.3)`) : G.border,
      boxShadow: data
        ? `0 0 12px ${up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}, 0 4px 32px rgba(0,0,0,0.6)`
        : cardStyle.boxShadow,
    }}>
      <div className="pred-horizon" style={labelStyle}>{horizon}</div>

      {loading && <div style={{ color: G.text, fontSize: 13, opacity: 0.5 }}>Loading…</div>}

      {!loading && data && (
        <>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 20, ...goldText, marginBottom: 8 }}>
            {fmtPrice(data.predicted_price)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18, color: dirColor, lineHeight: 1 }}>{up ? '▲' : '▼'}</span>
            <span className="pred-direction" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: dirColor, letterSpacing: '0.1em' }}>
              {up ? 'UP' : 'DOWN'}
            </span>
            <span className="pred-pct" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: dirColor }}>
              {fmtPct(data.change_pct)}
            </span>
          </div>
          {/* confidence bar */}
          <div style={{ background: '#1a1a1a', borderRadius: 3, height: 3, overflow: 'hidden', marginBottom: 4 }}>
            <div style={{
              height: '100%',
              width: `${conf}%`,
              background: `linear-gradient(90deg, ${up ? G.green : G.red}, ${G.gold})`,
              borderRadius: 3,
              transition: 'width 0.8s ease',
            }} />
          </div>
          <div className="pred-conf" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.text, letterSpacing: '0.2em' }}>
            CONFIDENCE {conf}%
          </div>
        </>
      )}

      {!loading && !data && (
        <div style={{ color: G.red, fontSize: 11, fontFamily: '"Share Tech Mono", monospace' }}>UNAVAILABLE</div>
      )}
    </div>
  )
}


function getBarValue(name, value) {
  const n = parseFloat(value)
  switch (name) {
    case 'rsi':       return { pct: isNaN(n) ? 50 : Math.min(100, Math.max(0, n)), color: n < 30 ? '#10b981' : n > 70 ? '#ef4444' : '#f59e0b' }
    case 'macd':      return { pct: isNaN(n) ? 50 : n > 0 ? 80 : 20,              color: n > 0 ? '#10b981' : '#ef4444' }
    case 'macdSig':   return { pct: isNaN(n) ? 50 : n > 0 ? 80 : 20,              color: n > 0 ? '#10b981' : '#ef4444' }
    case 'bbUpper':   return { pct: 50,  color: '#f59e0b' }
    case 'bbLower':   return { pct: 50,  color: '#f59e0b' }
    case 'hashRate':  return { pct: 80,  color: '#10b981' }
    case 'blockTime': return { pct: isNaN(n) ? 60 : n < 8 ? 90 : n > 12 ? 30 : 60, color: n < 8 ? '#10b981' : n > 12 ? '#ef4444' : '#f59e0b' }
    case 'fees':        return { pct: 50,  color: '#f59e0b' }
    case 'fundingRate': return { pct: isNaN(n) ? 50 : Math.min(100, Math.max(0, 50 + n * 500)), color: n > 0.05 ? '#ef4444' : n < -0.05 ? '#10b981' : '#f59e0b' }
    case 'longShort':   return { pct: isNaN(n) ? 50 : Math.min(100, Math.max(0, (n / 3) * 100)), color: n > 1.5 ? '#ef4444' : n < 0.7 ? '#10b981' : '#f59e0b' }
    case 'oiChange':    return { pct: isNaN(n) ? 50 : Math.min(100, Math.max(0, 50 + n * 5)),    color: n > 0 ? '#10b981' : '#ef4444' }
    default:            return { pct: 50,  color: '#f59e0b' }
  }
}

function IndCard({ label, value, sub, barName, barRaw }) {
  const bar = barName ? getBarValue(barName, barRaw ?? value) : null
  return (
    <div className="ind-card" style={{ ...cardStyle, padding: '14px 18px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.1em', color: '#9ca3af', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>{label}</span>
      </div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 20, marginTop: 6, marginBottom: 4, color: G.gold, textShadow: `0 0 8px ${G.goldGlow}` }}>{value}</div>
      {sub && <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: '#6b7280' }}>{sub}</div>}
      {bar && (
        <div style={{ marginTop: 8 }}>
          <div style={{height:3,borderRadius:2,background:'#1a1a1a',overflow:'hidden'}}>
            <div style={{height:'100%',width:`${bar.pct}%`,background:bar.color,borderRadius:2,boxShadow:`0 0 6px ${bar.color}`,transition:'width 0.8s ease'}}/>
          </div>
        </div>
      )}
    </div>
  )
}

function SentimentMeter({ value, label, history }) {
  const color = value == null ? G.text : value >= 75 ? G.green : value >= 55 ? '#84cc16' : value >= 45 ? G.gold : value >= 25 ? '#f97316' : G.red
  const gradAngle = value != null ? Math.round((value / 100) * 360) : 180
  const ticks = Array.from({ length: 10 }, (_, i) => i * 36)

  console.log('history:', history)

  const getHistoryColor = (val) => {
    if (val == null) return G.text
    if (val >= 56) return '#22c55e'
    if (val >= 46) return '#f59e0b'
    return '#ef4444'
  }

  const dayLabels = ['TODAY', 'YDAY', '2D', '3D', '4D', '5D', '6D']

  return (
    <div className="sentiment-card" style={{ ...cardStyle, minWidth: 0, width: '100%' }}>
      <div style={labelStyle}>Fear & Greed<Tooltip text="0-25 Extreme Fear — 26-45 Fear — 46-55 Neutral — 56-75 Greed — 76-100 Extreme Greed"/></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>

        {/* ── futuristic circle ── */}
        <div style={{ position: 'relative', width: 90, height: 90, flexShrink: 0 }}>

          {/* rotating dashed outer ring */}
          <div style={{
            position: 'absolute', inset: -6,
            borderRadius: '50%',
            border: `1px dashed ${color}55`,
            animation: 'rotateDash 8s linear infinite',
          }} />

          {/* tick marks */}
          {ticks.map(deg => (
            <div key={deg} style={{
              position: 'absolute',
              width: 2, height: 6,
              background: `${color}66`,
              borderRadius: 1,
              top: '50%', left: '50%',
              transform: `rotate(${deg}deg) translateY(-46px) translateX(-1px)`,
              transformOrigin: '1px 0',
            }} />
          ))}

          {/* main circle */}
          <div style={{
            width: 90, height: 90, borderRadius: '50%',
            border: `3px solid transparent`,
            background: `linear-gradient(#141414, #141414) padding-box,
                         linear-gradient(${gradAngle}deg, ${G.red}, ${G.gold}, ${G.green}) border-box`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'circlePulse 2.5s ease-in-out infinite',
            color,
          }}>
            <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 26, color, fontWeight: 'bold', lineHeight: 1 }}>
              {value ?? '—'}
            </span>
          </div>
        </div>

        {/* label + bar */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 15, color, marginBottom: 6 }}>{label ?? '—'}</div>
          {value != null && (
            <div style={{ background: '#1a1a1a', borderRadius: 3, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${G.red}, ${G.gold}, ${G.green})`, borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
          )}
        </div>
      </div>

      {/* ── 7-day history ── */}
      {Array.isArray(history) && history.length > 0 && (
        <>
          <div style={{ height: 1, background: G.border, marginTop: 20, marginBottom: 14 }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {history.slice(0, 7).map((item, i) => {
              const dayValue = parseInt(item.value, 10)
              const dayColor = getHistoryColor(dayValue)
              const isToday = i === 0
              const classText = (item.classification || '').toUpperCase().replace('EXTREME ', 'EXT ')

              return (
                <div key={i} className={i >= 4 ? 'hide-mobile' : ''} style={{
                  ...cardStyle,
                  flex: '1 1 0',
                  minWidth: 52,
                  minHeight: 70,
                  padding: '10px 6px',
                  background: isToday ? G.goldDim : G.card,
                  border: isToday ? `2px solid ${G.gold}` : `1px solid ${G.border}`,
                  borderRadius: 6,
                  textAlign: 'center',
                  boxShadow: isToday ? `0 0 10px ${G.goldGlow}` : cardStyle.boxShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}>
                  {/* horizon-style label */}
                  <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 11,
                    letterSpacing: '0.1em',
                    color: isToday ? G.gold : '#9ca3af',
                    fontWeight: isToday ? 'bold' : 'normal',
                    textTransform: 'uppercase',
                  }}>
                    {dayLabels[i]}
                  </div>

                  {/* value */}
                  <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 20,
                    color: dayColor,
                    fontWeight: 'bold',
                    lineHeight: 1,
                  }}>
                    {dayValue}
                  </div>

                  {/* classification */}
                  <div style={{
                    fontFamily: '"Share Tech Mono", monospace',
                    fontSize: 8,
                    color: dayColor,
                    opacity: 0.8,
                    letterSpacing: '0.08em',
                    lineHeight: 1,
                  }}>
                    {classText}
                  </div>

                  {/* color dot */}
                  <div style={{
                    width: 5, height: 5,
                    borderRadius: '50%',
                    background: dayColor,
                    boxShadow: `0 0 5px ${dayColor}`,
                  }} />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
const PRED_HORIZONS = ['1h', '4h', '8h', '12h', '24h', '1week', '1month']
const REFRESH_MS    = 60_000

function Tooltip({text}) {
  const [show, setShow] = useState(false)
  return (
    <span style={{position:'relative',display:'inline-block',marginLeft:6}}>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)} onClick={()=>setShow(!show)}
        style={{cursor:'pointer',fontSize:12,marginLeft:4}}>💡</span>
      {show && <div style={{position:'absolute',bottom:'120%',left:'50%',transform:'translateX(-50%)',background:'#1a1a1a',border:'1px solid #f59e0b33',borderRadius:6,padding:'8px 10px',width:200,fontSize:10,color:'#d1d5db',fontFamily:'"Share Tech Mono",monospace',lineHeight:1.5,zIndex:200,pointerEvents:'none'}}>{text}</div>}
    </span>
  )
}

export default function App() {
  const [price,       setPrice]       = useState(null)
  const [sentiment,   setSentiment]   = useState(null)
  const [preds,       setPreds]       = useState({})
  const [indics,      setIndics]      = useState(null)
  const [onchain,     setOnchain]     = useState(null)
  const [fundingRate, setFundingRate] = useState(null)
  const [longShort,   setLongShort]   = useState(null)
  const [openInterest,setOpenInterest]= useState(null)
  const [whales,      setWhales]      = useState(null)
  const [mempool,     setMempool]     = useState(null)
  const [orderBook,   setOrderBook]   = useState(null)
  const [keyLevels,     setKeyLevels]     = useState(null)
  const [liquidations,  setLiquidations]  = useState(null)
const [deepOpen,      setDeepOpen]      = useState(false)
  const [deepLogs,      setDeepLogs]      = useState([])
  const [deepResult,    setDeepResult]    = useState(null)
  const [deepRunning,   setDeepRunning]   = useState(false)
  const [deepHorizon,   setDeepHorizon]   = useState(null)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [authOpen,    setAuthOpen]    = useState(false)
  const [authTab,     setAuthTab]     = useState('signup') // 'signup' | 'login'
  const [authEmail,   setAuthEmail]   = useState('')
  const [authPass,    setAuthPass]    = useState('')
  const [authBusy,    setAuthBusy]    = useState(false)
  const [authError,   setAuthError]   = useState('')
  const [authSuccess, setAuthSuccess] = useState(false)
  const [user,        setUser]        = useState(null)
  const [lastAt,      setLastAt]      = useState(null)
  const [countdown,   setCountdown]   = useState(REFRESH_MS / 1000)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadAll = useCallback(async () => {
    const [p, s, ind] = await Promise.allSettled([
      fetchLivePrice(),
      fetchSentiment(),
      fetchIndicators(),
    ])
    if (p.status  === 'fulfilled') setPrice(p.value)
    if (s.status  === 'fulfilled') setSentiment(s.value)
    if (ind.status=== 'fulfilled') setIndics(ind.value)

    // predictions in parallel
    const predResults = await Promise.allSettled(PRED_HORIZONS.map(h => fetchPrediction(h)))
    const map = {}
    PRED_HORIZONS.forEach((h, i) => {
      if (predResults[i].status === 'fulfilled') map[h] = predResults[i].value
    })
    setPreds(map)

    // onchain (may fail — proxied)
    try { setOnchain(await fetchOnchain()) } catch {}
    try { setFundingRate(await fetchFundingRate()) } catch {}
    try { setLongShort(await fetchLongShortRatio()) } catch {}
    try { setOpenInterest(await fetchOpenInterest()) } catch {}
    try { setWhales(await fetchWhales()) } catch {}
    try { setMempool(await fetchMempool()) } catch {}
    try { setOrderBook(await fetchOrderBook()) } catch {}
    const currentPrice = p.status === 'fulfilled' ? p.value?.price : null
    try { if (currentPrice) setKeyLevels(await fetchKeyLevels(currentPrice)) } catch {}
    try { setLiquidations(await fetchLiquidations()) } catch {}

    setLoading(false)
    setLastAt(new Date())
    setCountdown(REFRESH_MS / 1000)
  }, [])

  useEffect(() => {
    loadAll()
    const id = setInterval(loadAll, REFRESH_MS)
    return () => clearInterval(id)
  }, [loadAll])


  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    let ws = null
    let reconnectAttempts = 0
    let reconnectTimeout = null
    let restFallbackInterval = null
    const MAX_RECONNECT_ATTEMPTS = 5

    function connectWebSocket() {
      try {
        ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker')

        ws.onopen = () => {
          console.log('[WebSocket] Connected to Binance price stream')
          reconnectAttempts = 0
          // Clear REST fallback if WebSocket connects
          if (restFallbackInterval) {
            clearInterval(restFallbackInterval)
            restFallbackInterval = null
          }
        }

        ws.onmessage = (e) => {
          const d = JSON.parse(e.data)
          setPrice(prev => ({
            ...prev,
            price: parseFloat(d.c),
            change_24h_pct: parseFloat(d.P),
            volume_24h: parseFloat(d.q)
          }))
        }

        ws.onerror = (err) => {
          console.warn('[WebSocket] Error:', err)
        }

        ws.onclose = () => {
          console.warn('[WebSocket] Disconnected')

          // Try to reconnect with exponential backoff
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)
            console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`)
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++
              connectWebSocket()
            }, delay)
          } else {
            // Fall back to REST API polling if WebSocket fails
            console.warn('[WebSocket] Max reconnect attempts reached, falling back to REST API polling')
            if (!restFallbackInterval) {
              restFallbackInterval = setInterval(async () => {
                try {
                  const ticker = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT')
                    .then(r => r.json())
                  setPrice(prev => ({
                    ...prev,
                    price: parseFloat(ticker.lastPrice),
                    change_24h_pct: parseFloat(ticker.priceChangePercent),
                    volume_24h: parseFloat(ticker.quoteVolume)
                  }))
                } catch (err) {
                  console.error('[REST Fallback] Failed to fetch price:', err)
                }
              }, 5000) // Poll every 5 seconds
            }
          }
        }
      } catch (err) {
        console.error('[WebSocket] Failed to create connection:', err)
      }
    }

    connectWebSocket()

    return () => {
      if (ws) ws.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (restFallbackInterval) clearInterval(restFallbackInterval)
    }
  }, [])

  async function runDeepAnalysis(horizon) {
    setDeepOpen(true); setDeepRunning(true); setDeepLogs([]); setDeepResult(null)
    const L = [
      'Connecting...',
      'BTC: $'+price?.price?.toLocaleString(),
      'RSI '+indics?.rsi,
      'MACD: '+(indics?.macd?.histogram>0?'Bullish':'Bearish'),
      'Fear: '+sentiment?.value,
      'EMA: '+(indics?.ema50>indics?.ema200?'Golden Cross':'Death Cross'),
      'Funding: '+fundingRate?.signal,
      'Order Book: '+orderBook?.signal,
      'Bollinger: $'+indics?.bollinger_bands?.middle,
      'Open Interest: '+fmtLarge((openInterest?.value||0)*(price?.price||0)),
      'Long/Short: '+longShort?.ratio?.toFixed(2),
      'Mempool: '+mempool?.signal,
      'Key level: '+(keyLevels?.nearLevel?'Fib '+(keyLevels.nearLevel.level*100).toFixed(1)+'%':'None'),
      'OI Change: '+liquidations?.change+'%',
      'Horizon: '+horizon,
      'Predicted: $'+preds[horizon?.toLowerCase()]?.predicted_price?.toLocaleString(),
      'Running model...','CONSENSUS REACHED',
    ]
    for(const l of L){await new Promise(r=>setTimeout(r,500));setDeepLogs(p=>[...p,l])}
    const s=Math.round([indics?.rsi<50,indics?.macd?.histogram>0,sentiment?.value<40,indics?.ema50>indics?.ema200,longShort?.ratio<1,orderBook?.ratio>1].filter(Boolean).length/6*100)
    setDeepResult({score:s,direction:s>50?'BULLISH':'BEARISH',recommendation:s>65?'Strong Buy':s>50?'Weak Buy':s>35?'Hold':'Sell'})
    setDeepRunning(false)
  }

  const isUnlocked = () => !!user

  const handleDeepClick = () => {
    if (isUnlocked()) { setDeepOpen(true) } else { setAuthOpen(true) }
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    if (!authEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setAuthError('Please enter a valid email address.')
      return
    }
    if (authPass.length < 6) {
      setAuthError('Password must be at least 6 characters.')
      return
    }
    setAuthBusy(true)
    setAuthError('')
    try {
      if (authTab === 'signup') {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPass })
        if (error) throw error
        setAuthSuccess(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
        if (error) throw error
        setAuthOpen(false)
        setAuthEmail('')
        setAuthPass('')
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.')
    }
    setAuthBusy(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleGoogleLogin = async () => {
    setAuthBusy(true)
    setAuthError('')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://predictalpha.app'
        }
      })
      if (error) throw error
    } catch (err) {
      setAuthError(err.message || 'Google login failed.')
      setAuthBusy(false)
    }
  }

  const change  = price?.change_24h_pct ?? null
  const isUp    = change != null && change >= 0
  const chgColor = change == null ? G.gold : isUp ? G.green : G.red
  const rsi     = indics?.rsi
  const macd    = indics?.macd
  const bb      = indics?.bollinger_bands
  const ema50   = indics?.ema50
  const ema200  = indics?.ema200
  const curPrice = indics?.price ?? price?.price

  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/about" element={<About />} />
      <Route path="/" element={
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: 64 }}>

      <div style={{position:'fixed',top:0,left:'-2px',width:'2px',height:'100vh',zIndex:999,pointerEvents:'none',background:`linear-gradient(180deg,transparent,#f59e0b,transparent)`,boxShadow:'0 0 8px #f59e0b',animation:'introScan 1.2s linear 1 forwards'}} />
      <div style={{position:'fixed',top:'-2px',left:0,width:'100vw',height:'2px',zIndex:999,pointerEvents:'none',background:`linear-gradient(90deg,transparent,#f59e0b,transparent)`,boxShadow:'0 0 8px #f59e0b',animation:'introScanH 1.2s linear 1 forwards',animationDelay:'0.3s'}} />

      {/* ── HEADER ── */}
      <header className="header-inner" style={{
        position: 'sticky', top: 0, zIndex: 50, overflow: 'visible',
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 32px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* logo */}
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logoegyptfinal.webp" alt="PredictAlpha" className="navbar-logo" style={{width:'auto',objectFit:'contain',verticalAlign:'middle'}} />
          <div style={{display:'flex',flexDirection:'column',gap:3}}>
            <span className="navbar-brand" style={{fontFamily:'"Orbitron",sans-serif',letterSpacing:'0.05em',opacity:0.9,whiteSpace:'nowrap'}}>
              <span style={{color:'#f59e0b',fontWeight:400}}>PREDICT</span>{' '}<span style={{color:'#f59e0b',fontWeight:700,textShadow:'0 0 8px rgba(245,158,11,0.4)'}}>ALPHA</span>
            </span>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:G.green,boxShadow:`0 0 8px ${G.green}`,animation:'blink 0.5s ease-in-out infinite'}} />
              <span style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,letterSpacing:'0.3em',color:G.green}}>LIVE</span>
            </div>
          </div>
        </div>

        {/* learn link — desktop only */}
        <Link to="/about" className="hide-mobile" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>LEARN</Link>

        {/* auth — desktop only */}
        {user ? (
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="User avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: `2px solid ${G.gold}`,
                  boxShadow: `0 0 8px ${G.goldGlow}`
                }}
              />
            ) : (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: G.goldDim,
                border: `2px solid ${G.gold}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Share Tech Mono",monospace',
                fontSize: 12,
                fontWeight: 'bold',
                color: G.gold,
                boxShadow: `0 0 8px ${G.goldGlow}`
              }}>
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.1em', color: G.text, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
            <button onClick={handleLogout} style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, background: 'none', border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '4px 10px', cursor: 'pointer', textTransform: 'uppercase' }}>LOGOUT</button>
          </div>
        ) : (
          <button className="hide-mobile" onClick={() => setAuthOpen(true)} style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase' }}>LOGIN</button>
        )}

        {/* hamburger — mobile only */}
        <button className="show-mobile" onClick={() => setMenuOpen(o => !o)} style={{background:'none',border:'none',cursor:'pointer',color:'#f59e0b',fontSize:32,lineHeight:1,padding:'8px',display:'none'}}>☰</button>

        {/* mobile dropdown */}
        {menuOpen && (
          <div style={{position:'absolute',top:68,left:0,right:0,background:'rgba(10,10,10,0.97)',borderBottom:`1px solid #2a1f00`,zIndex:200,padding:'12px 0'}}>
            {/* User section for mobile */}
            {user ? (
              <div style={{padding:'12px 24px',borderBottom:`1px solid #2a1f00`,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="User avatar" style={{width:28,height:28,borderRadius:'50%',border:`2px solid ${G.gold}`}} />
                ) : (
                  <div style={{width:28,height:28,borderRadius:'50%',background:G.goldDim,border:`2px solid ${G.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'"Share Tech Mono",monospace',fontSize:11,fontWeight:'bold',color:G.gold}}>
                    {user.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div style={{flex:1,overflow:'hidden'}}>
                  <div style={{fontFamily:'"Share Tech Mono",monospace',fontSize:10,color:G.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user.email}</div>
                  <button onClick={() => { handleLogout(); setMenuOpen(false) }} style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,letterSpacing:'0.1em',color:G.gold,background:'none',border:'none',cursor:'pointer',padding:0,marginTop:4,textTransform:'uppercase'}}>LOGOUT</button>
                </div>
              </div>
            ) : (
              <div style={{padding:'12px 24px',borderBottom:`1px solid #2a1f00`,marginBottom:8}}>
                <button onClick={() => { setAuthOpen(true); setMenuOpen(false) }} style={{width:'100%',fontFamily:'"Share Tech Mono",monospace',fontSize:10,letterSpacing:'0.15em',color:G.gold,background:G.goldDim,border:`1px solid ${G.gold}44`,borderRadius:4,padding:'8px 12px',cursor:'pointer',textTransform:'uppercase'}}>LOGIN</button>
              </div>
            )}
            {[
              { label: 'Dashboard', to: '/', dim: false },
              { label: 'Learn',     to: '/about', dim: false },
            ].map(({ label, to }) => (
              <Link key={label} to={to} onClick={() => setMenuOpen(false)} style={{display:'block',fontFamily:'"Share Tech Mono",monospace',fontSize:13,letterSpacing:'0.2em',color:'#f59e0b',textDecoration:'none',padding:'12px 24px',textTransform:'uppercase'}}>{label}</Link>
            ))}
            <div style={{borderTop:'1px solid #2a1f00',marginTop:8,paddingTop:8}}>
              {['ETH','SOL','GOLD','FOREX'].map(item => (
                <div key={item} style={{display:'block',fontFamily:'"Share Tech Mono",monospace',fontSize:13,letterSpacing:'0.2em',color:'#6b7280',padding:'12px 24px',textTransform:'uppercase',cursor:'default'}}>
                  {item} <span style={{fontSize:9,letterSpacing:'0.15em',opacity:0.6}}>COMING SOON</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* live ticker */}
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {lastAt && (
            <div className="hide-mobile" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.text, letterSpacing: '0.2em', textAlign: 'right' }}>
              <div>REFRESHES IN {countdown}s</div>
              <div style={{ opacity: 0.5 }}>{lastAt.toLocaleTimeString()}</div>
            </div>
          )}
<div style={{ textAlign: 'right' }}>
            <div className="header-price" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 26, ...goldText, letterSpacing: 1 }}>
              {loading ? '———' : fmtPrice(price?.price)}
            </div>
            {!loading && change != null && (
              <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: chgColor, marginTop: 2 }}>
                {fmtPct(change)} 24h
              </div>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section" style={{display:'block',width:'100%'}}>
        <div style={{padding:'10px 16px',borderBottom:'1px solid #1a1a1a',textAlign:'center',background:'#0a0a0a'}}>
          <span className="ai-title ai-banner" style={{fontFamily:'"Share Tech Mono",monospace',fontSize:16,letterSpacing:'0.3em',color:'#f59e0b',opacity:0.8,animation:'textPulse 2.5s ease-in-out infinite'}}>AI PREDICTING FUTURE</span>
          <div className="ai-sub" style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,color:'#6b7280',letterSpacing:'0.15em',opacity:0.6,marginTop:3}}>Predictions may be inaccurate · Not financial advice · For educational purposes only</div>
        </div>
        <div style={{textAlign:'center',padding:'16px 0'}}>
          <button className="deep-btn" onClick={handleDeepClick}
          style={{
            fontFamily:'"Orbitron",sans-serif',
            fontSize:14,
            letterSpacing:'0.35em',
            padding:'16px 40px',
            background:'linear-gradient(135deg, #f59e0b 0%, #fbbf24 25%, #d97706 50%, #f59e0b 75%, #fbbf24 100%)',
            backgroundSize:'200% 200%',
            animation:'gradientShift 3s ease infinite, buttonGlow 2s ease-in-out infinite',
            border:'2px solid rgba(251,191,36,0.6)',
            borderRadius:14,
            color:'#000',
            cursor:'pointer',
            boxShadow:'0 0 30px #f59e0b66, 0 0 60px #f59e0b33, inset 0 1px 0 rgba(255,255,255,0.3)',
            transition:'all 0.3s ease',
            fontWeight:800,
            textShadow:'0 1px 0 rgba(255,255,255,0.3)',
            position:'relative',
            overflow:'hidden'
          }}
          onMouseEnter={e => { e.target.style.boxShadow='0 0 50px #f59e0b99, 0 0 100px #f59e0b55'; e.target.style.transform='scale(1.05)'; e.target.style.borderColor='#fbbf24' }}
          onMouseLeave={e => { e.target.style.boxShadow='0 0 30px #f59e0b66, 0 0 60px #f59e0b33, inset 0 1px 0 rgba(255,255,255,0.3)'; e.target.style.transform='scale(1)'; e.target.style.borderColor='rgba(251,191,36,0.6)' }}
        >
            DEEP ANALYSIS
          </button>
        </div>

        <div style={{textAlign:'center',padding:'12px 0',borderBottom:'1px solid #1a1a1a'}}>
          <span style={{fontFamily:'"Orbitron",sans-serif',fontSize:22,letterSpacing:'0.2em',color:'#f59e0b',fontWeight:'bold'}}>₿ BITCOIN</span>
        </div>
      </section>

      {/* ── BODY ── */}
      <main className="main-pad" style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px' }}>

        {/* row 1 — market overview */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Market Overview</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard label={<>BTC Price<Tooltip text="Live price updated every 30s via Binance WebSocket"/></>}   value={fmtPrice(price?.price)}          sub="USD · Last updated live" icon="₿" />
            <StatCard label={<>24h Change<Tooltip text="Price change last 24h — positive means bullish momentum"/></>}  value={fmtPct(change)}                  sub={isUp ? 'Bullish momentum' : 'Bearish momentum'} valueColor={chgColor} icon={isUp ? '▲' : '▼'} />
            <StatCard label={<>24h Volume<Tooltip text="Total trading volume spot + derivatives"/></>}  value={fmtLarge(price?.volume_24h)}     sub="Spot + derivatives" />
            <StatCard label={<>Market Cap<Tooltip text="Total market value = price × circulating supply"/></>}  value={fmtLarge(price?.market_cap || null)} sub="USD market cap" />
          </div>
        </div>

        {/* row 2 — AI predictions */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>AI Price Predictions</div>
          <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 16 }}>

            {/* 1H — always free */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: '#10b981', color: '#000', fontFamily: '"Share Tech Mono",monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', padding: '2px 7px', borderRadius: 4 }}>FREE</div>
              <PredCard key="1h" horizonKey="1h" horizon={<>1H<Tooltip text="Shortest horizon — highest confidence intraday signal"/></>} data={preds['1h']} loading={loading} />
            </div>

            {/* 4H–1MONTH — locked unless unlocked_until valid */}
            {[
              { k: '4h',     label: '4H',     tip: '4-hour AI ensemble prediction' },
              { k: '8h',     label: '8H',     tip: '8-hour AI ensemble prediction' },
              { k: '12h',    label: '12H',    tip: '12-hour AI ensemble prediction' },
              { k: '24h',    label: '24H',    tip: '24-hour AI ensemble prediction' },
              { k: '1week',  label: '1WEEK',  tip: 'Weekly AI ensemble prediction' },
              { k: '1month', label: '1MONTH', tip: 'Monthly AI ensemble prediction' },
            ].map(({ k, label, tip }) => (
              <div key={k} style={{ position: 'relative' }}>
                {/* blurred card underneath */}
                <div style={{ filter: isUnlocked() ? 'none' : 'blur(5px)', pointerEvents: isUnlocked() ? 'auto' : 'none', userSelect: 'none' }}>
                  <PredCard horizonKey={k} horizon={<>{label}<Tooltip text={tip}/></>} data={preds[k]} loading={loading} />
                </div>
                {/* lock overlay */}
                {!isUnlocked() && (
                  <div onClick={handleDeepClick} style={{
                    position: 'absolute', inset: 0, zIndex: 3,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(10,10,10,0.55)',
                    backdropFilter: 'blur(1px)',
                    border: `1px solid ${G.gold}33`,
                    gap: 6,
                  }}>
                    <span style={{ fontSize: 20 }}>🔒</span>
                    <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center', lineHeight: 1.5 }}>UNLOCK WITH<br/>EMAIL</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* row 3 — sentiment (full-width) + indicators */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Market Sentiment & Technical Indicators</div>
          <SentimentMeter value={sentiment?.value} label={sentiment?.classification} history={sentiment?.history} />
          <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 14, marginTop: 16 }}>
              <IndCard
                label={<>RSI (14)<Tooltip text="Below 30 oversold buy signal — above 70 overbought sell signal"/></>}
                value={rsi != null ? fmtNum(rsi, 1) : '—'}
                sub={rsi == null ? '' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
                barName="rsi" barRaw={rsi}
              />
              <IndCard
                label={<>MACD<Tooltip text="MACD above signal line = bullish momentum"/></>}
                value={macd ? fmtNum(macd.macd, 1) : '—'}
                sub={macd ? (macd.macd > 0 ? 'Bullish' : 'Bearish') : ''}
                barName="macd" barRaw={macd?.macd}
              />
              <IndCard
                label={<>MACD Signal<Tooltip text="MACD above signal line = bullish momentum"/></>}
                value={macd ? fmtNum(macd.signal, 1) : '—'}
                sub={macd ? `Hist: ${fmtNum(macd.histogram, 1)}` : ''}
                barName="macdSig" barRaw={macd?.histogram}
              />
              <IndCard
                label={<>BB Upper<Tooltip text="Price near upper band = overbought potential reversal"/></>}
                value={bb ? fmtPrice(bb.upper) : '—'}
                sub={bb && curPrice ? (curPrice > bb.upper ? 'Overbought ⚠️' : 'Bollinger Band') : 'Bollinger Band'}
                barName="bbUpper"
              />
              <IndCard
                label={<>BB Lower<Tooltip text="Price near lower band = oversold potential reversal"/></>}
                value={bb ? fmtPrice(bb.lower) : '—'}
                sub={bb && curPrice ? (curPrice < bb.lower ? 'Oversold ⚠️' : 'Bollinger Band') : 'Bollinger Band'}
                barName="bbLower"
              />
              <IndCard
                label={<>EMA 50<Tooltip text="Price above = bullish trend"/></>}
                value={ema50 ? fmtPrice(ema50) : '—'}
                sub={ema50 && curPrice ? (curPrice > ema50 ? 'Price above' : 'Price below') : ''}
                barName="macd" barRaw={ema50 && curPrice ? curPrice - ema50 : null}
              />
              <IndCard
                label={<>EMA 200<Tooltip text="Price below = long-term bearish"/></>}
                value={ema200 ? fmtPrice(ema200) : '—'}
                sub={ema200 && curPrice ? (curPrice > ema200 ? 'Price above' : 'Price below') : ''}
                barName="macd" barRaw={ema200 && curPrice ? curPrice - ema200 : null}
              />
            </div>
          {ema50 != null && ema200 != null && ema50 > ema200 && (
            <div style={{ marginTop: 12, fontFamily: '"Share Tech Mono", monospace', fontSize: 12, letterSpacing: '0.15em', color: G.green }}>
              🟢 GOLDEN CROSS — Bullish
            </div>
          )}
        </div>

        {/* row 4 — onchain (optional) */}
        {onchain && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>On-Chain Data</div>
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {onchain.n_tx       != null && <IndCard label="Transactions"    value={Number(onchain.n_tx).toLocaleString()}       sub="Last 24h" />}
              {onchain.hash_rate  != null && <IndCard label={<>Hash Rate<Tooltip text="Higher = more miners = stronger network security"/></>}       value={`${Number(onchain.hash_rate).toFixed(2)} EH/s`} sub="Network difficulty" barName="hashRate" />}
              {onchain.minutes_between_blocks != null && <IndCard label={<>Block Time<Tooltip text="Normal ~10 min — higher means network congestion"/></>} value={`${Number(onchain.minutes_between_blocks).toFixed(1)} min`} sub="Avg block interval" barName="blockTime" barRaw={onchain.minutes_between_blocks} />}
              {onchain.total_fees_btc != null && <IndCard label={<>Total Fees<Tooltip text="Total BTC paid as fees to miners last 24h"/></>}  value={`${Number(onchain.total_fees_btc).toFixed(4)} BTC`} sub="Last 24h" barName="fees" />}
            </div>
          </div>
        )}

        {/* row 5 — futures market */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Futures Market</div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <IndCard
              label={<>Funding Rate<Tooltip text="Positive = longs pay shorts bullish market"/></>}
              value={fundingRate != null ? (fundingRate.rate.toFixed(4) + '%') : '—'}
              sub={fundingRate?.signal}
              barName="fundingRate"
              barRaw={fundingRate?.rate}
            />
            <IndCard
              label={<>Long/Short Ratio<Tooltip text="Above 1 more longs than shorts"/></>}
              value={longShort != null ? longShort.ratio.toFixed(2) : '—'}
              sub={longShort?.signal}
              barName="longShort"
              barRaw={longShort?.ratio}
            />
            <IndCard
              label={<>Open Interest<Tooltip text="Rising OI = strong trend confirmation"/></>}
              value={openInterest?.value && price?.price ? fmtLarge(openInterest.value * price.price) : '—'}
              sub="BTC futures open"
            />
            <IndCard
              label={<>Whale Activity<Tooltip text="Large wallet moves — whales buying is bullish signal"/></>}
              value={whales != null ? (whales.largeCount + ' trades') : '—'}
              sub={whales?.signal}
            />
            <IndCard
              label={<>Open Int. Change<Tooltip text="Rising OI with price up = strong bullish confirmation"/></>}
              value={liquidations?.change != null ? (liquidations.change + '%') : '—'}
              sub={liquidations?.signal}
              barName="oiChange"
              barRaw={liquidations?.change}
            />
          </div>
        </div>

        {/* row 6 — order book */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Order Book</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <IndCard
              label="Best Bid"
              value={orderBook?.topBid != null ? `$${orderBook.topBid.toFixed(2)}` : '—'}
              sub="Highest buy order"
            />
            <IndCard
              label="Best Ask"
              value={orderBook?.topAsk != null ? `$${orderBook.topAsk.toFixed(2)}` : '—'}
              sub="Lowest sell order"
            />
            <IndCard
              label="Bid/Ask Ratio"
              value={orderBook?.ratio != null ? orderBook.ratio.toFixed(2) : '—'}
              sub={orderBook?.signal}
              barName="longShort"
              barRaw={orderBook?.ratio}
            />
            <IndCard
              label="SPREAD"
              value={orderBook?.topBid != null && orderBook?.topAsk != null ? `$${(orderBook.topAsk - orderBook.topBid).toFixed(2)}` : '—'}
              sub="Bid/Ask gap"
            />
          </div>
        </div>

        {/* row 7 — key levels */}
        {keyLevels && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>Key Levels</div>
            <div style={{ ...cardStyle, padding: '20px 24px' }}>

              {/* Pivot */}
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.2em', color: G.text, textTransform: 'uppercase' }}>Pivot<Tooltip text="Central price level — above is bullish below is bearish"/></span>
                <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 22, ...goldText, marginTop: 4 }}>{fmtPrice(keyLevels.pivot)}</div>
              </div>

              {/* Resistance / Support grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Support */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.green, letterSpacing: '0.15em', marginBottom: 4 }}>SUPPORT<Tooltip text="Support levels — price may bounce up here"/></div>
                  {[['S1', keyLevels.s1], ['S2', keyLevels.s2], ['S3', keyLevels.s3]].map(([lbl, val]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${G.green}11`, borderRadius: 6, padding: '8px 12px', border: `1px solid ${G.green}33` }}>
                      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.15em', color: G.green }}>{lbl}</span>
                      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 14, color: G.green }}>{fmtPrice(val)}</span>
                    </div>
                  ))}
                </div>
                {/* Resistance */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.red, letterSpacing: '0.15em', marginBottom: 4 }}>RESISTANCE<Tooltip text="Resistance levels — price may reverse down here"/></div>
                  {[['R1', keyLevels.r1], ['R2', keyLevels.r2], ['R3', keyLevels.r3]].map(([lbl, val]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${G.red}11`, borderRadius: 6, padding: '8px 12px', border: `1px solid ${G.red}33` }}>
                      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.15em', color: G.red }}>{lbl}</span>
                      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 14, color: G.red }}>{fmtPrice(val)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fibonacci badges */}
              <div style={{ borderTop: `1px solid ${G.border}`, paddingTop: 14 }}>
                <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.2em', color: G.text, textTransform: 'uppercase', marginBottom: 10 }}>Fibonacci Retracements<Tooltip text="Golden ratio levels where price often reverses — 61.8% is strongest"/></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {keyLevels.fib.map(f => (
                    <div key={f.level} style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, padding: '5px 10px', borderRadius: 5, background: G.goldDim, border: `1px solid ${G.gold}44`, color: G.gold, letterSpacing: '0.1em' }}>
                      {(f.level * 100).toFixed(1)}% · {fmtPrice(f.price)}
                    </div>
                  ))}
                </div>
                {keyLevels.nearLevel && (
                  <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, ...goldText, marginTop: 12, letterSpacing: '0.15em' }}>
                    ⚠️ Near Fibonacci level {(keyLevels.nearLevel.level * 100).toFixed(1)}% · {fmtPrice(keyLevels.nearLevel.price)}<Tooltip text="Price is dangerously close to a key reversal level"/>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* row 8 — mempool */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Mempool</div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <IndCard
              label={<>Pending Txns<Tooltip text="Number of unconfirmed transactions waiting — high means network congested"/></>}
              value={mempool?.count != null ? mempool.count.toLocaleString() : '—'}
              sub={mempool?.signal}
            />
            <IndCard
              label={<>Fast Fee<Tooltip text="Minimum fee to get confirmed in next block"/></>}
              value={mempool?.fastestFee != null ? (mempool.fastestFee + ' sat/vB') : '—'}
              sub="Next block"
            />
            <IndCard
              label={<>Hour Fee<Tooltip text="Minimum fee to get confirmed within 1 hour"/></>}
              value={mempool?.hourFee != null ? (mempool.hourFee + ' sat/vB') : '—'}
              sub="Within 1 hour"
            />
          </div>
        </div>

        {/* footer */}
        <div style={{borderTop:`1px solid ${G.border}`,paddingTop:24,marginTop:8,
          display:'flex',flexWrap:'wrap',justifyContent:'center',
          alignItems:'center',gap:12,textAlign:'center'}}>
          <div style={{fontFamily:'"Orbitron",sans-serif',fontSize:13,letterSpacing:'0.12em',color:'#f59e0b'}}>
            PREDICT ALPHA
          </div>
          <div style={{fontFamily:'"Share Tech Mono",monospace',fontSize:10,color:'#6b7280',letterSpacing:'0.2em'}}>
            NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY
          </div>
        </div>
      </main>

      {/* ── auth modal ── */}
      {authOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
          {authSuccess ? (
            /* success screen */
            <div style={{
              background:G.card, borderRadius:14, width:'95%', maxWidth:400, padding:'48px 32px', textAlign:'center',
              border:`2px solid ${G.gold}`,
              boxShadow:`0 0 60px ${G.goldGlow}`,
              animation:'authSuccessPulse 2s ease-in-out infinite',
            }}>
              <img src="/logoegyptfinal.webp" alt="" style={{ width:80, height:80, objectFit:'contain', marginBottom:24 }} />
              <h2 style={{ fontFamily:'"Orbitron",sans-serif', fontSize:18, letterSpacing:'0.2em', color:G.gold, textShadow:`0 0 12px ${G.goldGlow}`, marginBottom:16 }}>
                CHECK YOUR EMAIL
              </h2>
              <p style={{ fontFamily:'"Share Tech Mono",monospace', fontSize:12, color:G.text, lineHeight:1.9, letterSpacing:'0.03em', marginBottom:28 }}>
                We sent a confirmation link to your email address. Click it to unlock all predictions.
              </p>
              <button
                onClick={() => { setAuthOpen(false); setAuthSuccess(false); setAuthEmail(''); setAuthPass('') }}
                style={{
                  fontFamily:'"Share Tech Mono",monospace', fontSize:11, letterSpacing:'0.2em',
                  padding:'12px 28px', borderRadius:8, cursor:'pointer',
                  background:'none', border:`1px solid ${G.gold}55`, color:G.gold,
                  textTransform:'uppercase',
                }}
              >
                GOT IT
              </button>
            </div>
          ) : (
            /* form */
            <div style={{ background:G.card, border:`1px solid ${G.gold}55`, borderRadius:14, boxShadow:`0 0 60px ${G.goldGlow}`, width:'95%', maxWidth:400, padding:'32px 28px' }}>
              {/* close */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
                <button onClick={() => { setAuthOpen(false); setAuthError('') }} style={{ background:'none', border:'none', color:G.text, cursor:'pointer', fontSize:18, lineHeight:1 }}>✕</button>
              </div>
              {/* tabs */}
              <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:`1px solid ${G.border}` }}>
                {['signup', 'login'].map(tab => (
                  <button key={tab} onClick={() => { setAuthTab(tab); setAuthError('') }} style={{
                    flex:1, fontFamily:'"Orbitron",sans-serif', fontSize:11, letterSpacing:'0.2em', textTransform:'uppercase',
                    padding:'12px 0', background:'none', border:'none', cursor:'pointer',
                    color: authTab === tab ? G.gold : G.text,
                    borderBottom: authTab === tab ? `2px solid ${G.gold}` : '2px solid transparent',
                    marginBottom: -1,
                  }}>{tab === 'signup' ? 'SIGN UP' : 'LOGIN'}</button>
                ))}
              </div>
              {/* Google Sign In Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={authBusy}
                type="button"
                style={{
                  width:'100%', fontFamily:'"Share Tech Mono",monospace', fontSize:12, letterSpacing:'0.15em',
                  padding:'14px', borderRadius:8, cursor: authBusy ? 'not-allowed' : 'pointer',
                  background: '#fff', border:`2px solid ${G.gold}44`, color:'#000', fontWeight:600,
                  boxShadow: `0 0 12px ${G.goldGlow}`, transition:'all 0.2s', marginBottom:20,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                }}
                onMouseEnter={e => !authBusy && (e.target.style.boxShadow = `0 0 20px ${G.goldGlow}`)}
                onMouseLeave={e => !authBusy && (e.target.style.boxShadow = `0 0 12px ${G.goldGlow}`)}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.184l-2.909-2.258c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                SIGN IN WITH GOOGLE
              </button>

              {/* Divider */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ flex:1, height:1, background:G.border }} />
                <span style={{ fontFamily:'"Share Tech Mono",monospace', fontSize:9, color:G.text, letterSpacing:'0.15em' }}>OR</span>
                <div style={{ flex:1, height:1, background:G.border }} />
              </div>

              {/* form inputs */}
              <form onSubmit={handleAuthSubmit}>
                <input
                  type="email"
                  placeholder="Email"
                  value={authEmail}
                  onChange={e => { setAuthEmail(e.target.value); setAuthError('') }}
                  style={{
                    width:'100%', boxSizing:'border-box',
                    fontFamily:'"Share Tech Mono",monospace', fontSize:13,
                    background:'#0a0a0a', border:`1px solid ${authError ? G.red : G.border}`,
                    borderRadius:8, color:G.bright, padding:'12px 16px',
                    outline:'none', marginBottom:12, letterSpacing:'0.05em',
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authPass}
                  onChange={e => { setAuthPass(e.target.value); setAuthError('') }}
                  style={{
                    width:'100%', boxSizing:'border-box',
                    fontFamily:'"Share Tech Mono",monospace', fontSize:13,
                    background:'#0a0a0a', border:`1px solid ${authError ? G.red : G.border}`,
                    borderRadius:8, color:G.bright, padding:'12px 16px',
                    outline:'none', marginBottom: authError ? 8 : 20, letterSpacing:'0.05em',
                  }}
                />
                {authError && (
                  <div style={{ fontFamily:'"Share Tech Mono",monospace', fontSize:11, color:G.red, marginBottom:12, letterSpacing:'0.05em' }}>{authError}</div>
                )}
                <button
                  type="submit"
                  disabled={authBusy}
                  style={{
                    width:'100%', fontFamily:'"Orbitron",sans-serif', fontSize:12, letterSpacing:'0.25em',
                    padding:'14px', borderRadius:8, cursor: authBusy ? 'not-allowed' : 'pointer',
                    background: authBusy ? G.border : `linear-gradient(135deg,${G.gold},#d97706)`,
                    border:'none', color:'#000', fontWeight:700,
                    boxShadow: authBusy ? 'none' : `0 0 24px ${G.goldGlow}`,
                    transition:'all 0.2s',
                  }}
                >
                  {authBusy ? 'PLEASE WAIT…' : (authTab === 'signup' ? 'CREATE ACCOUNT' : 'LOGIN')}
                </button>
              </form>
              <div style={{ fontFamily:'"Share Tech Mono",monospace', fontSize:9, color:'#4b5563', letterSpacing:'0.15em', textAlign:'center', marginTop:16 }}>
                {authTab === 'signup' ? 'FREE · UNLOCK ALL PREDICTIONS' : 'WELCOME BACK'}
              </div>
            </div>
          )}
        </div>
      )}

      {deepOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.88)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
        }}>
          <div style={{
            background: G.card,
            border: `1px solid ${G.gold}55`,
            borderRadius: 12,
            boxShadow: `0 0 40px ${G.goldGlow}`,
            width: '95%', maxWidth: 680,
            maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* header */}
            <div style={{
              padding: '16px 24px',
              borderBottom: `1px solid ${G.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 13, letterSpacing: '0.25em', color: G.gold }}>
                DEEP ANALYSIS
              </span>
              {!deepRunning && (
                <button onClick={() => { setDeepOpen(false); setDeepHorizon(null) }}
                  style={{ background: 'none', border: 'none', color: G.text, cursor: 'pointer', fontSize: 18 }}>✕</button>
              )}
            </div>

            {/* horizon selector */}
            {!deepHorizon && (
              <div style={{textAlign:'center',padding:20}}>
                <div style={{fontFamily:'"Orbitron",sans-serif',color:'#f59e0b',marginBottom:20}}>SELECT HORIZON</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
                  {['4h','8h','12h','24h','1week','1month'].map(h=>(
                    <button key={h} onClick={()=>{setDeepHorizon(h);runDeepAnalysis(h)}} style={{fontFamily:'"Orbitron",sans-serif',padding:'14px',background:'#1a1a1a',border:'1px solid #f59e0b',borderRadius:8,color:'#f59e0b',cursor:'pointer',fontSize:13,letterSpacing:'0.2em'}}>{h.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            )}

            {/* log stream */}
            {deepHorizon && (
            <div style={{ display:'flex', flexDirection:'column', overflow:'hidden' }}>
              <div style={{
                maxHeight:'180px', overflowY:'auto', padding: '20px 24px',
                fontFamily: '"Share Tech Mono",monospace', fontSize: 12, color: G.text,
              }}>
                {deepLogs.map((line, i) => (
                  <div key={i} style={{ marginBottom: 7, color: i === deepLogs.length - 1 && deepRunning ? G.gold : G.text }}>
                    <span style={{ color: `${G.gold}66`, marginRight: 10 }}>[{String(i + 1).padStart(2, '0')}]</span>
                    {line}
                  </div>
                ))}
                {deepRunning && (
                  <div style={{position:'relative',overflow:'hidden',height:3,background:'#1a1a1a',margin:'8px 0',borderRadius:2}}>
                    <div style={{position:'absolute',top:0,height:'100%',width:'30%',background:'linear-gradient(90deg,transparent,#f59e0b,transparent)',animation:'scanLine 1.5s linear infinite'}}/>
                  </div>
                )}
              </div>

              {deepResult && (
                <div style={{textAlign:'center',padding:20,borderTop:`1px solid ${G.border}`}}>
                  <div style={{fontSize:11,color:'#6b7280',marginBottom:8}}>PREDICTED IN {deepHorizon?.toUpperCase()}</div>
                  <div style={{fontFamily:'"Orbitron",sans-serif',fontSize:36,color:'#f59e0b',animation:'goldPulse 2s ease-in-out infinite',marginBottom:4,lineHeight:1}}>
                    ${preds[deepHorizon?.toLowerCase()]?.predicted_price?.toLocaleString()}
                  </div>
                  <div style={{fontSize:11,color:'#6b7280',letterSpacing:'0.2em',marginBottom:20}}>USD PREDICTED PRICE</div>
                  <div style={{display:'flex',gap:12,justifyContent:'center',marginBottom:12}}>
                    <div style={{border:`1px solid ${deepResult.score>50?'#10b981':'#ef4444'}`,borderRadius:8,padding:'8px 20px',color:deepResult.score>50?'#10b981':'#ef4444',fontFamily:'"Orbitron",sans-serif',fontSize:12}}>
                      {deepResult.direction?.toUpperCase()}
                    </div>
                    <div style={{border:'1px solid #f59e0b',borderRadius:8,padding:'8px 20px',color:'#f59e0b',fontFamily:'"Orbitron",sans-serif',fontSize:12}}>
                      {deepResult.score}% CONFIDENCE
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}

            {/* footer */}
            {!deepRunning && deepHorizon && (
              <div style={{ padding: '12px 24px', borderTop: `1px solid ${G.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => { setDeepHorizon(null); setDeepLogs([]); setDeepResult(null) }} style={{
                  fontFamily: '"Share Tech Mono",monospace', fontSize: 11, letterSpacing: '0.15em',
                  background: G.goldDim, border: `1px solid ${G.gold}`, borderRadius: 6,
                  color: G.gold, cursor: 'pointer', padding: '8px 18px', textTransform: 'uppercase',
                }}>Re-run</button>
                <button onClick={() => { setDeepOpen(false); setDeepHorizon(null) }} style={{
                  fontFamily: '"Share Tech Mono",monospace', fontSize: 11, letterSpacing: '0.15em',
                  background: 'none', border: `1px solid ${G.border}`, borderRadius: 6,
                  color: G.text, cursor: 'pointer', padding: '8px 18px', textTransform: 'uppercase',
                }}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes textPulse   { 0%,100%{opacity:0.5; text-shadow:0 0 8px #f59e0b} 50%{opacity:1; text-shadow:0 0 20px #f59e0b, 0 0 40px #f59e0b88} }
        @keyframes rotateDash  { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes circlePulse { 0%,100%{box-shadow:0 0 15px currentColor} 50%{box-shadow:0 0 30px currentColor, 0 0 60px currentColor} }
        @keyframes goldPulse   { 0%,100%{text-shadow:0 0 20px #f59e0b} 50%{text-shadow:0 0 60px #f59e0b} }
        @keyframes fadeUp      { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scanLine    { 0%{left:-100%} 100%{left:200%} }
        @keyframes fillBar     { from{width:0} to{width:var(--w)} }
        @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
        @keyframes buttonGlow  { 0%,100%{box-shadow:0 0 30px #f59e0b66, 0 0 60px #f59e0b33, inset 0 1px 0 rgba(255,255,255,0.3)} 50%{box-shadow:0 0 45px #f59e0b88, 0 0 90px #f59e0b44, inset 0 1px 0 rgba(255,255,255,0.4)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes authSuccessPulse { 0%,100%{box-shadow:0 0 20px rgba(245,158,11,0.4)} 50%{box-shadow:0 0 40px rgba(245,158,11,0.7)} }
        @media (max-width: 768px) {
          .grid-3       { grid-template-columns: 1fr 1fr 1fr !important; gap: 10px !important; }
          .grid-4       { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .grid-5       { grid-template-columns: 1fr 1fr !important; }
          .grid-2col    { grid-template-columns: 1fr !important; }
          .sentiment-card { width: 100% !important; min-width: 0 !important; }
          .grid-6       { grid-template-columns: 1fr 1fr 1fr !important; gap: 10px !important; }
          .ind-card     { min-height: 90px !important; padding: 10px 12px !important; }
          .main-pad     { padding: 16px !important; }
          .header-inner { flex-direction: row !important; justify-content: space-between !important; align-items: center !important; padding: 10px 12px !important; flex-wrap: nowrap !important; }
          .header-right { position: static !important; gap: 8px !important; }
          .header-price { font-size: 20px !important; }
          .hide-mobile  { display: none !important; }
          .show-mobile  { display: block !important; }
          .navbar-logo  { height: 62px !important; }
          .navbar-brand { font-size: 13px !important; white-space: nowrap !important; }
          .ai-title     { font-size: 13px !important; }
          .ai-banner    { font-size: 12px !important; letter-spacing: 0.15em !important; }
          .ai-sub       { font-size: 7px !important; }
          .deep-btn     { font-size: 13px !important; padding: 12px 24px !important; max-width: 280px !important; }
          .pred-horizon { font-size: 13px !important; font-weight: 600 !important; letter-spacing: 0.1em !important; }
          .pred-direction { font-size: 11px !important; }
          .pred-pct     { font-size: 12px !important; }
          .pred-conf    { font-size: 11px !important; }
        }
        @media (max-width: 420px) {
          .grid-3       { grid-template-columns: 1fr !important; }
          .grid-6       { grid-template-columns: 1fr 1fr !important; }
          .header-price { font-size: 18px !important; }
          .navbar-logo  { height: 50px !important; }
          .navbar-brand { font-size: 13px !important; letter-spacing: 0.05em !important; white-space: nowrap !important; }
          .main-pad     { padding: 12px !important; }
          .pred-horizon { font-size: 12px !important; }
        }
        .navbar-logo  { height: 80px; margin-right: 10px; }
        .navbar-brand { font-size: 22px; }
        @keyframes introScan  { 0%{left:-2px;opacity:1} 100%{left:100vw;opacity:0} }
        @keyframes introScanH { 0%{top:-2px;opacity:1}  100%{top:100vh;opacity:0}  }
      `}</style>
    </div>
      } />
    </Routes>
    </>
  )
}
