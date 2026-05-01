import { useState, useEffect, useCallback } from 'react'
import {
  fetchLivePrice,
  fetchSentiment,
  fetchPrediction,
  fetchIndicators,
  fetchPriceHistory,
  fetchOnchain,
  fetchNews,
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
  const up = data?.direction === 'up'
  const dirColor = up ? G.green : G.red
  const conf = data ? (HORIZON_CONFIDENCE[horizonKey] ?? Math.round(data.confidence * 100)) : 0

  return (
    <div style={{
      ...cardStyle,
      borderColor: data ? (up ? `rgba(16,185,129,0.3)` : `rgba(239,68,68,0.3)`) : G.border,
      boxShadow: data
        ? `0 0 12px ${up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}, 0 4px 32px rgba(0,0,0,0.6)`
        : cardStyle.boxShadow,
    }}>
      <div style={labelStyle}>{horizon}</div>

      {loading && <div style={{ color: G.text, fontSize: 13, opacity: 0.5 }}>Loading…</div>}

      {!loading && data && (
        <>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 20, ...goldText, marginBottom: 8 }}>
            {fmtPrice(data.predicted_price)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18, color: dirColor, lineHeight: 1 }}>{up ? '▲' : '▼'}</span>
            <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: dirColor, letterSpacing: '0.1em' }}>
              {data.direction?.toUpperCase()}
            </span>
            <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, color: G.text }}>
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
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.text, letterSpacing: '0.2em' }}>
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

function SentimentMeter({ value, label }) {
  const color = value >= 75 ? G.green : value >= 55 ? '#84cc16' : value >= 45 ? G.gold : value >= 25 ? '#f97316' : G.red
  // Gradient border: map value 0→100 to red→gold→green
  const gradAngle = value != null ? Math.round((value / 100) * 360) : 0
  const ticks = Array.from({ length: 10 }, (_, i) => i * 36)

  return (
    <div className="sentiment-card" style={{ ...cardStyle, minWidth: 0, width: '100%' }}>
      <div style={labelStyle}>Fear & Greed<Tooltip text="0-25=Extreme Fear best buy zone. 75-100=Extreme Greed consider selling"/></div>
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
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: G.text, letterSpacing: '0.2em', marginBottom: 8 }}>ALTERNATIVE.ME</div>
          {value != null && (
            <div style={{ background: '#1a1a1a', borderRadius: 3, height: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${G.red}, ${G.gold}, ${G.green})`, borderRadius: 3, transition: 'width 0.8s ease' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
const PRED_HORIZONS = ['4h', '8h', '12h', '24h', '1week', '1month']
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
  const [news,        setNews]        = useState([])
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
  const [loading,     setLoading]     = useState(true)
  const [lastAt,      setLastAt]      = useState(null)
  const [countdown,   setCountdown]   = useState(REFRESH_MS / 1000)

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
    try { const n = await fetchNews(); console.log('NEWS:', n); setNews(n) } catch(e) { console.error('NEWS ERROR:', e) }
    try { setFundingRate(await fetchFundingRate()) } catch {}
    try { setLongShort(await fetchLongShortRatio()) } catch {}
    try { setOpenInterest(await fetchOpenInterest()) } catch {}
    try { setWhales(await fetchWhales()) } catch {}
    try { setMempool(await fetchMempool()) } catch {}
    try { setOrderBook(await fetchOrderBook()) } catch {}
    try { setKeyLevels(await fetchKeyLevels(price?.price || 77000)) } catch {}
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
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@ticker')
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data)
      setPrice(prev => ({ ...prev, price: parseFloat(d.c), change_24h_pct: parseFloat(d.P), volume_24h: parseFloat(d.q) }))
    }
    ws.onerror = () => ws.close()
    return () => ws.close()
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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', paddingBottom: 64 }}>

      <div style={{position:'fixed',top:0,left:'-2px',width:'2px',height:'100vh',zIndex:999,pointerEvents:'none',background:`linear-gradient(180deg,transparent,#f59e0b,transparent)`,boxShadow:'0 0 8px #f59e0b',animation:'introScan 1.2s linear 1 forwards'}} />
      <div style={{position:'fixed',top:'-2px',left:0,width:'100vw',height:'2px',zIndex:999,pointerEvents:'none',background:`linear-gradient(90deg,transparent,#f59e0b,transparent)`,boxShadow:'0 0 8px #f59e0b',animation:'introScanH 1.2s linear 1 forwards',animationDelay:'0.3s'}} />

      {/* ── HEADER ── */}
      <header className="header-inner" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 32px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* logo */}
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <img src="/logotrans.png" alt="DeepVortex" style={{height:'40px',objectFit:'contain'}} />
          <span style={{fontFamily:'"Orbitron",sans-serif',fontSize:12,letterSpacing:'0.15em',color:'#f59e0b',opacity:0.9}}>DEEPVORTEX AI</span>
        </div>

        {/* live ticker */}
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {lastAt && (
            <div className="hide-mobile" style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.text, letterSpacing: '0.2em', textAlign: 'right' }}>
              <div>REFRESHES IN {countdown}s</div>
              <div style={{ opacity: 0.5 }}>{lastAt.toLocaleTimeString()}</div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: G.green, boxShadow: `0 0 8px ${G.green}`,
              animation: 'blink 0.5s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.3em', color: G.green }}>LIVE</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 26, ...goldText, letterSpacing: 1 }}>
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

      <div style={{padding:'10px 16px',borderBottom:'1px solid #1a1a1a',textAlign:'center',background:'#0a0a0a'}}>
        <span className="ai-title ai-banner" style={{fontFamily:'"Share Tech Mono",monospace',fontSize:16,letterSpacing:'0.3em',color:'#f59e0b',opacity:0.8,animation:'textPulse 2.5s ease-in-out infinite'}}>AI PREDICTING FUTURE</span>
        <div className="ai-sub" style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,color:'#6b7280',letterSpacing:'0.15em',opacity:0.6,marginTop:3}}>Predictions may be inaccurate · Not financial advice · For educational purposes only</div>
      </div>
      <div style={{textAlign:'center',padding:'12px 0'}}>
        <button onClick={runDeepAnalysis} style={{fontFamily:'"Orbitron",sans-serif',fontSize:13,letterSpacing:'0.2em',background:'#f59e0b',color:'#000',border:'none',borderRadius:8,padding:'14px 40px',cursor:'pointer',fontWeight:'bold',boxShadow:'0 0 20px #f59e0b66'}}>
          🧠 DEEP ANALYSIS
        </button>
      </div>

      <div style={{textAlign:'center',padding:'12px 0',borderBottom:'1px solid #1a1a1a'}}>
        <span style={{fontFamily:'"Orbitron",sans-serif',fontSize:22,letterSpacing:'0.2em',color:'#f59e0b',fontWeight:'bold'}}>₿ BITCOIN</span>
      </div>

      {/* ── BODY ── */}
      <main className="main-pad" style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px' }}>

        {/* row 1 — market overview */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Market Overview</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard label={<>BTC Price<Tooltip text="Live Bitcoin price in USD updated every 60s from Binance"/></>}   value={fmtPrice(price?.price)}          sub="USD · Last updated live" icon="₿" />
            <StatCard label={<>24h Change<Tooltip text="Price change last 24h. Green=bullish momentum Red=bearish"/></>}  value={fmtPct(change)}                  sub={isUp ? 'Bullish momentum' : 'Bearish momentum'} valueColor={chgColor} icon={isUp ? '▲' : '▼'} />
            <StatCard label={<>24h Volume<Tooltip text="Total USD traded on Binance in the last 24 hours"/></>}  value={fmtLarge(price?.volume_24h)}     sub="Spot + derivatives" />
            <StatCard label={<>Market Cap<Tooltip text="Total market value of all 19.7M Bitcoin in circulation"/></>}  value={fmtLarge(price?.market_cap || null)} sub="USD market cap" />
          </div>
        </div>

        {/* row 2 — AI predictions */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>AI Price Predictions</div>
          <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 16 }}>
            <PredCard key="4h"     horizonKey="4h"     horizon={<>4H<Tooltip text="AI prediction 4 hours ahead using SMA7 vs SMA14 momentum"/></>}     data={preds['4h']}     loading={loading} />
            <PredCard key="8h"     horizonKey="8h"     horizon={<>8H<Tooltip text="AI prediction 8 hours ahead based on short-term trend"/></>}          data={preds['8h']}     loading={loading} />
            <PredCard key="12h"    horizonKey="12h"    horizon={<>12H<Tooltip text="AI prediction 12 hours using moving average divergence"/></>}         data={preds['12h']}    loading={loading} />
            <PredCard key="24h"    horizonKey="24h"    horizon={<>24H<Tooltip text="AI prediction 24 hours ahead. Most reliable forecast"/></>}           data={preds['24h']}    loading={loading} />
            <PredCard key="1week"  horizonKey="1week"  horizon={<>1WEEK<Tooltip text="AI prediction 7 days ahead. Medium-term trend projection"/></>}      data={preds['1week']}  loading={loading} />
            <PredCard key="1month" horizonKey="1month" horizon={<>1MONTH<Tooltip text="30 day projection. Long-term trend higher uncertainty"/></>}       data={preds['1month']} loading={loading} />
          </div>
        </div>

        {/* row 3 — indicators + sentiment */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Technical Indicators</div>
          <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 5fr', gap: 16, alignItems: 'start' }}>
            <SentimentMeter value={sentiment?.value} label={sentiment?.classification} />
            <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 14 }}>
              <IndCard
                label={<>RSI (14)<Tooltip text="Above 70=overbought likely drop. Below 30=oversold likely rise. 30-70=neutral"/></>}
                value={rsi != null ? fmtNum(rsi, 1) : '—'}
                sub={rsi == null ? '' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
                barName="rsi" barRaw={rsi}
              />
              <IndCard
                label={<>MACD<Tooltip text="Positive histogram=bullish momentum. Negative=bearish pressure"/></>}
                value={macd ? fmtNum(macd.macd, 1) : '—'}
                sub={macd ? (macd.macd > 0 ? 'Bullish' : 'Bearish') : ''}
                barName="macd" barRaw={macd?.macd}
              />
              <IndCard
                label={<>MACD Signal<Tooltip text="Signal line crossover. MACD above signal=bullish, below=bearish"/></>}
                value={macd ? fmtNum(macd.signal, 1) : '—'}
                sub={macd ? `Hist: ${fmtNum(macd.histogram, 1)}` : ''}
                barName="macdSig" barRaw={macd?.histogram}
              />
              <IndCard
                label={<>BB Upper<Tooltip text="Upper Bollinger Band. Price touching upper=overbought sell signal"/></>}
                value={bb ? fmtPrice(bb.upper) : '—'}
                sub="Bollinger Band"
                barName="bbUpper"
              />
              <IndCard
                label={<>BB Lower<Tooltip text="Lower Bollinger Band. Price touching lower=oversold buy signal"/></>}
                value={bb ? fmtPrice(bb.lower) : '—'}
                sub="Bollinger Band"
                barName="bbLower"
              />
              <IndCard
                label={<>EMA 50<Tooltip text="50-day exponential moving average. Short-term trend"/></>}
                value={ema50 ? fmtPrice(ema50) : '—'}
                sub={ema50 && curPrice ? (curPrice > ema50 ? 'Price above' : 'Price below') : ''}
                barName="macd" barRaw={ema50 && curPrice ? curPrice - ema50 : null}
              />
              <IndCard
                label={<>EMA 200<Tooltip text="200-day exponential moving average. Long-term trend"/></>}
                value={ema200 ? fmtPrice(ema200) : '—'}
                sub={ema200 && curPrice ? (curPrice > ema200 ? 'Price above' : 'Price below') : ''}
                barName="macd" barRaw={ema200 && curPrice ? curPrice - ema200 : null}
              />
            </div>
            {ema50 != null && ema200 != null && (
              <div style={{ marginTop: 12, fontFamily: '"Share Tech Mono", monospace', fontSize: 12, letterSpacing: '0.15em', color: ema50 > ema200 ? G.green : G.red }}>
                {ema50 > ema200 ? '🟢 GOLDEN CROSS — Bullish' : '🔴 DEATH CROSS — Bearish'}
              </div>
            )}
          </div>
        </div>

        {/* row 4 — onchain (optional) */}
        {onchain && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>On-Chain Data</div>
            <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {onchain.n_tx       != null && <IndCard label="Transactions"    value={Number(onchain.n_tx).toLocaleString()}       sub="Last 24h" />}
              {onchain.hash_rate  != null && <IndCard label={<>Hash Rate<Tooltip text="Total computing power mining Bitcoin. Higher=more secure"/></>}       value={`${(onchain.hash_rate / 1e9).toFixed(2)} EH/s`} sub="Network difficulty" barName="hashRate" />}
              {onchain.minutes_between_blocks != null && <IndCard label={<>Block Time<Tooltip text="Avg minutes between blocks. Target 10 min"/></>} value={`${Number(onchain.minutes_between_blocks).toFixed(1)} min`} sub="Avg block interval" barName="blockTime" barRaw={onchain.minutes_between_blocks} />}
              {onchain.total_fees_btc != null && <IndCard label={<>Total Fees<Tooltip text="Total BTC paid as fees to miners last 24h"/></>}  value={`${(Math.abs(Number(onchain.total_fees_btc)) / 100000000).toFixed(4)} BTC`} sub="Last 24h" barName="fees" />}
            </div>
          </div>
        )}

        {/* row 5 — futures market */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Futures Market</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <IndCard
              label="Funding Rate"
              value={fundingRate != null ? (fundingRate.rate.toFixed(4) + '%') : '—'}
              sub={fundingRate?.signal}
              barName="fundingRate"
              barRaw={fundingRate?.rate}
            />
            <IndCard
              label="Long/Short Ratio"
              value={longShort != null ? longShort.ratio.toFixed(2) : '—'}
              sub={longShort?.signal}
              barName="longShort"
              barRaw={longShort?.ratio}
            />
            <IndCard
              label="Open Interest"
              value={openInterest?.value && price?.price ? fmtLarge(openInterest.value * price.price) : '—'}
              sub="BTC futures open"
            />
            <IndCard
              label="Whale Activity"
              value={whales != null ? (whales.largeCount + ' trades') : '—'}
              sub={whales?.signal}
            />
            <IndCard
              label="Open Int. Change"
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
                <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.2em', color: G.text, textTransform: 'uppercase' }}>Pivot</span>
                <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 22, ...goldText, marginTop: 4 }}>{fmtPrice(keyLevels.pivot)}</div>
              </div>

              {/* Resistance / Support grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                {/* Support */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[['S1', keyLevels.s1], ['S2', keyLevels.s2], ['S3', keyLevels.s3]].map(([lbl, val]) => (
                    <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: `${G.green}11`, borderRadius: 6, padding: '8px 12px', border: `1px solid ${G.green}33` }}>
                      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.15em', color: G.green }}>{lbl}</span>
                      <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 14, color: G.green }}>{fmtPrice(val)}</span>
                    </div>
                  ))}
                </div>
                {/* Resistance */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, letterSpacing: '0.2em', color: G.text, textTransform: 'uppercase', marginBottom: 10 }}>Fibonacci Retracements</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {keyLevels.fib.map(f => (
                    <div key={f.level} style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, padding: '5px 10px', borderRadius: 5, background: G.goldDim, border: `1px solid ${G.gold}44`, color: G.gold, letterSpacing: '0.1em' }}>
                      {(f.level * 100).toFixed(1)}% · {fmtPrice(f.price)}
                    </div>
                  ))}
                </div>
                {keyLevels.nearLevel && (
                  <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 11, ...goldText, marginTop: 12, letterSpacing: '0.15em' }}>
                    ⚠️ Near Fibonacci level {(keyLevels.nearLevel.level * 100).toFixed(1)}% · {fmtPrice(keyLevels.nearLevel.price)}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* row 8 — mempool */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Mempool</div>
          <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <IndCard
              label="Pending Txns"
              value={mempool?.count != null ? mempool.count.toLocaleString() : '—'}
              sub={mempool?.signal}
            />
            <IndCard
              label="Fast Fee"
              value={mempool?.fastestFee != null ? (mempool.fastestFee + ' sat/vB') : '—'}
              sub="Next block"
            />
            <IndCard
              label="Hour Fee"
              value={mempool?.hourFee != null ? (mempool.hourFee + ' sat/vB') : '—'}
              sub="Within 1 hour"
            />
          </div>
        </div>

        {/* row 8 — news */}
        {news.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>Latest BTC News</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {news.map((n, i) => (
                <a key={i} href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                  <div style={{
                    ...cardStyle, padding: '12px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    cursor: 'pointer', transition: 'border-color 0.2s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = G.gold}
                    onMouseLeave={e => e.currentTarget.style.borderColor = G.border}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 12, color: '#e5e7eb', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title.length > 60 ? n.title.slice(0, 60) + '…' : n.title}
                      </div>
                      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: G.text, letterSpacing: '0.1em' }}>
                        {n.source} · {n.time}
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0,
                      fontFamily: '"Share Tech Mono", monospace', fontSize: 9, letterSpacing: '0.15em',
                      padding: '3px 8px', borderRadius: 4,
                      background: n.sentiment === 'bullish' ? `${G.green}22` : `${G.red}22`,
                      color: n.sentiment === 'bullish' ? G.green : G.red,
                      border: `1px solid ${n.sentiment === 'bullish' ? G.green : G.red}44`,
                      textTransform: 'uppercase',
                    }}>
                      {n.sentiment === 'bullish' ? '▲ Bullish' : '▼ Bearish'}
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* footer */}
        <div style={{
          borderTop: `1px solid ${G.border}`, paddingTop: 24, marginTop: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ fontFamily: '"Orbitron", sans-serif', fontSize: 13, letterSpacing: '0.12em', ...goldText }}>
            DEEPVORTEX AI
          </div>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: G.text, letterSpacing: '0.2em' }}>
            NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY
          </div>
        </div>
      </main>

      {/* ── deep analysis modal ── */}
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
            width: '90%', maxWidth: 680,
            maxHeight: '80vh',
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
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px 24px',
              fontFamily: '"Share Tech Mono",monospace', fontSize: 12, color: G.text,
            }}>
              {deepLogs.map((line, i) => (
                <div key={i} style={{ marginBottom: 7, color: i === deepLogs.length - 1 && deepRunning ? G.gold : G.text }}>
                  <span style={{ color: `${G.gold}66`, marginRight: 10 }}>[{String(i + 1).padStart(2, '0')}]</span>
                  {line}
                </div>
              ))}
              {deepRunning && <div style={{ color: G.gold, marginTop: 8, animation: 'blink 0.5s ease-in-out infinite' }}>▌</div>}

              {deepResult && <div style={{textAlign:'center',padding:20}}><div style={{fontSize:11,color:'#6b7280',marginBottom:8}}>PREDICTED IN {deepHorizon?.toUpperCase()}</div><div style={{fontFamily:'"Orbitron",sans-serif',fontSize:40,color:'#f59e0b',marginBottom:12}}>${preds[deepHorizon?.toLowerCase()]?.predicted_price?.toLocaleString()}</div><div style={{fontSize:18,color:deepResult.score>50?'#10b981':'#ef4444',marginBottom:8}}>{deepResult.direction} — {deepResult.recommendation}</div><div style={{fontFamily:'"Orbitron",sans-serif',fontSize:24,color:'#fff'}}>{deepResult.score}%</div></div>}
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
        @media (max-width: 768px) {
          .grid-4       { grid-template-columns: 1fr 1fr !important; }
          .grid-5       { grid-template-columns: 1fr 1fr !important; }
          .grid-2col      { grid-template-columns: 1fr !important; }
          .sentiment-card { width: 100% !important; min-width: 0 !important; }
          .grid-6       { grid-template-columns: 1fr 1fr !important; }
          .ind-card     { min-height: 90px !important; }
          .main-pad     { padding: 16px !important; }
          .header-inner { flex-direction: row !important; justify-content: space-between !important; align-items: center !important; padding: 10px 12px !important; flex-wrap: nowrap !important; }
          .header-right { position: static !important; }
          .hide-mobile  { display: none !important; }
          .ai-title     { font-size: 13px !important; }
          .ai-banner    { font-size: 12px !important; letter-spacing: 0.15em !important; }
          .ai-sub       { font-size: 7px !important; }
        }
        @keyframes introScan  { 0%{left:-2px;opacity:1} 100%{left:100vw;opacity:0} }
        @keyframes introScanH { 0%{top:-2px;opacity:1}  100%{top:100vh;opacity:0}  }
      `}</style>
    </div>
  )
}
