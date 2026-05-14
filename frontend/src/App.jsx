import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
const About = lazy(() => import('./pages/About'))
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Lock } from 'lucide-react'
import { fetchMarketTensions, pingHealth } from './api/client'
import {
  fetchSentiment,
  fetchNewsSentiment,
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
  fetchSubscriptionStatus,
  fetchDeepAnalysisRemaining,
  consumeDeepAnalysisCredit,
  createCheckoutSession,
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

function NewsSentimentWidget({ data }) {
  if (!data) return (
    <div style={{ ...cardStyle, width: '100%', marginTop: 16 }}>
      <div style={labelStyle}>Media Sentiment<Tooltip text="AI-scored crypto headlines from CoinTelegraph, CoinDesk, Decrypt — last 24h"/></div>
      <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 12, color: G.text, opacity: 0.5 }}>Loading…</div>
    </div>
  )

  const score = data.score ?? 0
  const label = data.label ?? 'Neutral'
  const headlines = data.headlines ?? []

  const labelColor = label === 'Bullish' ? G.green : label === 'Bearish' ? G.red : G.gold
  const scoreColor = score > 0.15 ? G.green : score < -0.15 ? G.red : G.gold

  // Map score -1..+1 to 0..100% for the bar
  const barPct = Math.round(((score + 1) / 2) * 100)
  // Bar fill starts from center (50%) and goes left or right
  const fillLeft  = score < 0 ? `${50 + score * 50}%` : '50%'
  const fillWidth = `${Math.abs(score) * 50}%`

  const scoreLabel = (s) => {
    if (s > 0.15) return { color: G.green, symbol: '▲' }
    if (s < -0.15) return { color: G.red,   symbol: '▼' }
    return { color: G.gold, symbol: '—' }
  }

  return (
    <div style={{ ...cardStyle, width: '100%', marginTop: 16 }}>
      <div style={labelStyle}>Media Sentiment<Tooltip text="AI-scored crypto headlines from CoinTelegraph, CoinDesk, Decrypt — updated every 30 min"/></div>

      {/* Score bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 28, color: scoreColor, fontWeight: 'bold', minWidth: 60 }}>
          {score >= 0 ? '+' : ''}{score.toFixed(2)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 13, color: labelColor, marginBottom: 6, letterSpacing: '0.1em' }}>
            {label.toUpperCase()}
          </div>
          {/* Track */}
          <div style={{ position: 'relative', height: 6, borderRadius: 3, background: '#1a1a1a', overflow: 'hidden' }}>
            {/* Center marker */}
            <div style={{ position: 'absolute', left: '50%', top: 0, width: 1, height: '100%', background: '#444' }} />
            {/* Fill */}
            <div style={{
              position: 'absolute', top: 0, height: '100%',
              left: fillLeft, width: fillWidth,
              background: scoreColor,
              boxShadow: `0 0 6px ${scoreColor}`,
              borderRadius: 3,
              transition: 'all 0.8s ease',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: '"Share Tech Mono",monospace', fontSize: 8, color: G.text, marginTop: 3 }}>
            <span style={{ color: G.red }}>BEARISH −1.0</span>
            <span>NEUTRAL</span>
            <span style={{ color: G.green }}>BULLISH +1.0</span>
          </div>
        </div>
      </div>

      {/* Separator */}
      {headlines.length > 0 && <div style={{ height: 1, background: G.border, marginBottom: 12 }} />}

      {/* Headlines */}
      {headlines.slice(0, 5).map((h, i) => {
        const { color: hColor, symbol } = scoreLabel(h.score)
        return (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            padding: '7px 0',
            borderBottom: i < 4 ? `1px solid ${G.border}33` : 'none',
          }}>
            <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 12, color: hColor, flexShrink: 0, minWidth: 14 }}>{symbol}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, color: G.bright, lineHeight: 1.5, marginBottom: 2 }}>
                {h.title}
              </div>
              <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 8, color: G.text, letterSpacing: '0.1em' }}>
                {h.source} &nbsp;·&nbsp;
                <span style={{ color: hColor }}>{h.score >= 0 ? '+' : ''}{h.score.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SentimentMeter({ value, label, history }) {
  const color = value == null ? G.text : value >= 75 ? G.green : value >= 55 ? '#84cc16' : value >= 45 ? G.gold : value >= 25 ? '#f97316' : G.red
  const gradAngle = value != null ? Math.round((value / 100) * 360) : 180
  const ticks = Array.from({ length: 10 }, (_, i) => i * 36)


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

// ── Market Tensions ──────────────────────────────────────────────────────────
const TENSION_CONFIG = {
  bullish: { color: '#22c55e', Icon: TrendingUp },
  bearish: { color: '#ef4444', Icon: TrendingDown },
  warning: { color: '#f59e0b', Icon: AlertTriangle },
  squeeze: { color: '#a855f7', Icon: Zap },
}
const CONF_COLOR = { high: '#22c55e', medium: '#f59e0b', low: '#6b7280' }

function TensionCard({ setup }) {
  const cfg = TENSION_CONFIG[setup.type] || TENSION_CONFIG.warning
  const { color, Icon: TIcon } = cfg
  const confColor = CONF_COLOR[setup.confidence] || CONF_COLOR.low
  return (
    <div style={{ ...cardStyle, borderLeft: `4px solid ${color}`, position: 'relative', paddingBottom: 38 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <TIcon size={24} color={color} strokeWidth={1.5} style={{ flexShrink: 0 }} />
        <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 12, letterSpacing: '0.1em', color, textTransform: 'uppercase', lineHeight: 1.3 }}>
          {setup.title}
        </span>
      </div>
      <p style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.text, lineHeight: 1.7, margin: 0, paddingRight: 8 }}>
        {setup.description}
      </p>
      <span style={{
        position: 'absolute', bottom: 12, right: 14,
        fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em',
        color: confColor, background: `${confColor}22`, border: `1px solid ${confColor}55`,
        borderRadius: 4, padding: '3px 8px', textTransform: 'uppercase', fontWeight: 700,
      }}>
        {setup.confidence}
      </span>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
const ANALYSIS_MSGS = [
  "AI ANALYSING...",
  "Analysing mempool...",
  "Calibrating LSTM models...",
  "Reading on-chain signals...",
  "Synchronising model data...",
  "Loading OKX market data...",
  "Computing indicators...",
  "Fetching whale activity...",
  "Evaluating key levels...",
  "Processing sentiment data...",
  "Running ensemble forecast...",
]

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

function Skel({ h = 80 }) {
  return <div style={{ height: h, borderRadius: 10, background: 'linear-gradient(90deg, #1a1a2e 25%, #2a2a3e 50%, #1a1a2e 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
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
  const [newsSentiment, setNewsSentiment] = useState(null)
const [deepOpen,      setDeepOpen]      = useState(false)
  const [deepLogs,      setDeepLogs]      = useState([])
  const [deepResult,    setDeepResult]    = useState(null)
  const [deepRunning,   setDeepRunning]   = useState(false)
  const [deepHorizon,   setDeepHorizon]   = useState(null)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [authOpen,    setAuthOpen]    = useState(false)
  const [authTab,     setAuthTab]     = useState('signup') // 'signup' | 'login'
  const [authEmail,   setAuthEmail]   = useState('')
  const [authPass,    setAuthPass]    = useState('')
  const [authBusy,    setAuthBusy]    = useState(false)
  const [authError,   setAuthError]   = useState('')
  const [authSuccess, setAuthSuccess] = useState(false)
  const [user,        setUser]        = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isPro,       setIsPro]       = useState(false)
  const [credits,     setCredits]     = useState(2)
  const [pricingOpen, setPricingOpen] = useState(false)
  const [lastAt,      setLastAt]      = useState(null)
  const [liveCountdown, setLiveCountdown] = useState(60)
  const [msgIdx,        setMsgIdx]        = useState(0)
  const [resetIn,     setResetIn]     = useState('')
  const [tensions,    setTensions]    = useState(null)
  const [priceLoaded, setPriceLoaded] = useState(false)
  const [slowLoaded,  setSlowLoaded]  = useState(false)
  const [loadingBar,  setLoadingBar]  = useState(0)

  useEffect(() => { window.scrollTo(0, 0) }, [])

  // Handle Stripe redirect — strip ?success=true so the app loads cleanly
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      window.history.replaceState({}, '', '/')
    }
  }, [])

  // Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadAll = useCallback(async () => {
    setLoadingBar(10)
    // Phase 1: price + 1h prediction — unblocks hero stats and 1h card immediately
    const [p, pred1h] = await Promise.allSettled([
      fetch('https://crypto-production-f7c5.up.railway.app/api/price/live').then(r => r.json()),
      fetchPrediction('1h'),
    ])
    if (p.status      === 'fulfilled') setPrice(p.value)
    if (pred1h.status === 'fulfilled') setPreds(prev => ({ ...prev, '1h': pred1h.value }))
    setPriceLoaded(true)
    setLoadingBar(50)

    // Phase 2: all secondary data fired simultaneously
    const otherHorizons = PRED_HORIZONS.filter(h => h !== '1h')
    const currentPrice = p.status === 'fulfilled' ? p.value?.price : null
    const predPromises = otherHorizons.map(h => fetchPrediction(h))

    const [s, ind, oc, fr, ls, oi, wh, mp, ob, kl, liq, ns, mt] = await Promise.allSettled([
      fetchSentiment(),
      fetchIndicators(),
      fetchOnchain(),
      fetchFundingRate(),
      fetchLongShortRatio(),
      fetchOpenInterest(),
      fetchWhales(),
      fetchMempool(),
      fetchOrderBook(),
      currentPrice ? fetchKeyLevels(currentPrice) : Promise.resolve(null),
      fetchLiquidations(),
      fetchNewsSentiment(),
      fetchMarketTensions(),
    ])
    if (s.status   === 'fulfilled' && s.value)   setSentiment(s.value)
    if (ind.status === 'fulfilled' && ind.value)  setIndics(ind.value)
    if (oc.status  === 'fulfilled' && oc.value)   setOnchain(oc.value)
    if (fr.status  === 'fulfilled' && fr.value)   setFundingRate(fr.value)
    if (ls.status  === 'fulfilled' && ls.value)   setLongShort(ls.value)
    if (oi.status  === 'fulfilled' && oi.value)   setOpenInterest(oi.value)
    if (wh.status  === 'fulfilled' && wh.value)   setWhales(wh.value)
    if (mp.status  === 'fulfilled' && mp.value)   setMempool(mp.value)
    if (ob.status  === 'fulfilled' && ob.value)   setOrderBook(ob.value)
    if (kl.status  === 'fulfilled' && kl.value)   setKeyLevels(kl.value)
    if (liq.status === 'fulfilled' && liq.value)  setLiquidations(liq.value)
    if (ns.status  === 'fulfilled' && ns.value)   setNewsSentiment(ns.value)
    if (mt.status  === 'fulfilled' && mt.value)   setTensions(mt.value)

    const predResults = await Promise.allSettled(predPromises)
    setPreds(prev => {
      const map = { ...prev }
      predResults.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value) map[otherHorizons[i]] = r.value
      })
      return map
    })

    setSlowLoaded(true)
    setLoadingBar(90)
    setLoading(false)
    setLastAt(new Date())
    setLiveCountdown(60)
    setLoadingBar(100)
    setTimeout(() => setLoadingBar(0), 400)
  }, [])

  // Fetch subscription status when user changes; re-run loadAll on first login
  const prevUserRef = useRef(null)
  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus().then(sub => {
        setIsPro(sub.status === 'active')
      })
      fetchDeepAnalysisRemaining().then(c => {
        if (c !== null) setCredits(c.is_pro ? 999 : (c.remaining ?? 2))
      })
      if (!prevUserRef.current) loadAll()
    } else {
      setIsPro(false)
      setCredits(0)
    }
    prevUserRef.current = user
  }, [user, loadAll])

  useEffect(() => {
    // Wake the server with a lightweight ping before the heavy data fetch
    pingHealth().catch(() => {}).finally(() => loadAll())
  }, [loadAll])



  useEffect(() => {
    const calcResetIn = () => {
      const now = new Date()
      const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      const diffMs = midnight - now
      const h = Math.floor(diffMs / 3600000)
      const m = Math.floor((diffMs % 3600000) / 60000)
      setResetIn(`${h}h ${m}m`)
    }
    calcResetIn()
    const id = setInterval(calcResetIn, 60000)
    return () => clearInterval(id)
  }, [])

  // Live countdown tick — decrements every second, reset to 60 by Group 2
  useEffect(() => {
    const tick = setInterval(() => setLiveCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [])

  // Rotate analysis message every 2s while loading/running
  useEffect(() => {
    if (loading || deepRunning || refreshing) {
      const id = setInterval(() => setMsgIdx(i => (i + 1) % ANALYSIS_MSGS.length), 2000)
      return () => clearInterval(id)
    } else {
      setMsgIdx(0)
    }
  }, [loading, deepRunning, refreshing])

  // Group 2 — 60s: futures, order-book, mempool + countdown reset
  useEffect(() => {
    const id = setInterval(async () => {
      setRefreshing(true)
      setTimeout(() => setRefreshing(false), 1000)
      setLiveCountdown(60)
      const [fr, ls, oi, ob, liq, mp] = await Promise.allSettled([
        fetchFundingRate(), fetchLongShortRatio(), fetchOpenInterest(),
        fetchOrderBook(), fetchLiquidations(), fetchMempool(),
      ])
      if (fr.status  === 'fulfilled' && fr.value)  setFundingRate(fr.value)
      if (ls.status  === 'fulfilled' && ls.value)  setLongShort(ls.value)
      if (oi.status  === 'fulfilled' && oi.value)  setOpenInterest(oi.value)
      if (ob.status  === 'fulfilled' && ob.value)  setOrderBook(ob.value)
      if (liq.status === 'fulfilled' && liq.value) setLiquidations(liq.value)
      if (mp.status  === 'fulfilled' && mp.value)  setMempool(mp.value)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // Group 3 — 60s: indicators, key-levels, whales
  useEffect(() => {
    const id = setInterval(async () => {
      setRefreshing(true)
      setTimeout(() => setRefreshing(false), 1000)
      const [ind, wh, kl] = await Promise.allSettled([
        fetchIndicators(), fetchWhales(), fetchKeyLevels(),
      ])
      if (ind.status === 'fulfilled' && ind.value) setIndics(ind.value)
      if (wh.status  === 'fulfilled' && wh.value)  setWhales(wh.value)
      if (kl.status  === 'fulfilled' && kl.value)  setKeyLevels(kl.value)
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  // 1h prediction — 5 min (matches backend cache TTL)
  useEffect(() => {
    const id = setInterval(async () => {
      const [pred1h] = await Promise.allSettled([fetchPrediction('1h')])
      if (pred1h.status === 'fulfilled' && pred1h.value) setPreds(prev => ({ ...prev, '1h': pred1h.value }))
    }, 5 * 60_000)
    return () => clearInterval(id)
  }, [])

  // Group 4 — 15 min: sentiment, onchain, news, market-tensions, 4h+ predictions
  useEffect(() => {
    const id = setInterval(async () => {
      setRefreshing(true)
      setTimeout(() => setRefreshing(false), 1000)
      const longHorizons = PRED_HORIZONS.filter(h => h !== '1h')
      const [s, oc, ns, mt, ...predResults] = await Promise.allSettled([
        fetchSentiment(), fetchOnchain(), fetchNewsSentiment(), fetchMarketTensions(),
        ...longHorizons.map(h => fetchPrediction(h)),
      ])
      if (s.status  === 'fulfilled' && s.value)  setSentiment(s.value)
      if (oc.status === 'fulfilled' && oc.value)  setOnchain(oc.value)
      if (ns.status === 'fulfilled' && ns.value)  setNewsSentiment(ns.value)
      if (mt.status === 'fulfilled' && mt.value)  setTensions(mt.value)
      setPreds(prev => {
        const map = { ...prev }
        predResults.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value) map[longHorizons[i]] = r.value
        })
        return map
      })
    }, 15 * 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await fetch('https://crypto-production-f7c5.up.railway.app/api/price/live').then(r => r.json())
        setPrice(data)
      } catch (err) {
        console.error('[Price poll] Failed to fetch price:', err)
      }
    }, 30_000)

    return () => clearInterval(interval)
  }, [])

  async function runDeepAnalysis(horizon) {
    setDeepOpen(true); setDeepRunning(true); setDeepLogs([]); setDeepResult(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setDeepOpen(false); setDeepRunning(false)
      setAuthOpen(true)
      return
    }

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
      'News Sentiment: '+(newsSentiment?.label??'N/A')+' ('+((newsSentiment?.score??0).toFixed(2))+')',
      'Hash Rate: '+(onchain?.hash_rate??'N/A')+' EH/s',
      'Fees 24h: '+(onchain?.total_fees_btc??'N/A')+' BTC',
      'Key level: '+(keyLevels?.nearLevel?'Fib '+(keyLevels.nearLevel.level*100).toFixed(1)+'%':'None'),
      'OI Change: '+liquidations?.change+'%',
      'Market Tensions: '+(tensions?.length ? tensions[0].type+' signal detected' : 'scanning…'),
      'Bollinger squeeze: '+(indics?.bollinger_bands?.bandwidth < 0.05 ? 'Detected ⚠️' : 'Not detected'),
      'Whale activity: '+(whales?.signal ?? 'N/A'),
      'Horizon: '+horizon,
      'Calling AI model...','CONSENSUS REACHED',
    ]

    // Fire the API call concurrently with the log animation
    const apiPromise = fetch('https://crypto-production-f7c5.up.railway.app/api/deep-analysis/analyze', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        horizon,
        rsi: indics?.rsi,
        macd_histogram: indics?.macd?.histogram,
        ema50: indics?.ema50,
        ema200: indics?.ema200,
        funding_rate: fundingRate?.rate,
        long_short_ratio: longShort?.ratio,
      }),
    })

    for(const l of L){await new Promise(r=>setTimeout(r,500));setDeepLogs(p=>[...p,l])}

    try {
      const res = await apiPromise
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 429) {
          setDeepOpen(false); setDeepRunning(false); setDeepLogs([]); setDeepResult(null)
          setPricingOpen(true)
          return
        }
        throw new Error(data?.detail?.message || 'Analysis failed')
      }
      setCredits(data.remaining)
      setDeepResult({
        score: data.score,
        direction: data.direction,
        recommendation: data.recommendation,
        analysis: data.analysis,
        current_price: data.current_price,
      })
    } catch (err) {
      console.error('Deep analysis failed:', err)
      setDeepOpen(false); setDeepRunning(false); setDeepLogs([]); setDeepResult(null)
    }

    setDeepRunning(false)
  }

  const isLoggedIn = () => !!user
  const canAccessPremium = () => !!user && isPro
  const canDeepAnalysis = () => isPro || credits > 0

  const handleDeepClick = () => {
    if (!user) { setAuthOpen(true); return }
    if (!canDeepAnalysis()) { setPricingOpen(true); return }
    setDeepOpen(true)
  }

  const handleUpgrade = async () => {
    if (!user) { setAuthOpen(true); return }
    try {
      const { url } = await createCheckoutSession()
      window.location.href = url
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Failed to start checkout: ' + err.message)
    }
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
    const _authTimer = setTimeout(() => setAuthBusy(false), 10000)
    try {
      if (authTab === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPass })
        if (error) {
          const msg = error.message?.toLowerCase() || ''
          const code = error.code || ''
          if (
            msg.includes('already registered') || msg.includes('already in use') ||
            msg.includes('already exists') || msg.includes('user already') ||
            code === 'user_already_exists'
          ) {
            setAuthError('__already_exists__')
            return
          }
          throw error
        }
        // Supabase returns 200 with empty identities[] when email already exists (no error thrown)
        if (data?.user?.identities?.length === 0) {
          setAuthError('__already_exists__')
          return
        }
        setAuthSuccess(true) // show "Check your email" only for genuine new signups
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPass })
        if (error) {
          const msg = error.message?.toLowerCase() || ''
          if (msg.includes('invalid login') || msg.includes('invalid credentials') || msg.includes('wrong password') || msg.includes('email not confirmed')) {
            throw new Error('Invalid credentials. Please check your email and password.')
          }
          if (msg.includes('user not found') || msg.includes('no user')) {
            throw new Error('No account found. Please sign up first.')
          }
          throw new Error(error.message)
        }
        setAuthOpen(false)
        setAuthEmail('')
        setAuthPass('')
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed.')
    } finally {
      clearTimeout(_authTimer)
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleGoogleLogin = async () => {
    setAuthBusy(true)
    setAuthError('')
    const _authTimer = setTimeout(() => setAuthBusy(false), 10000)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'https://predictalpha.app'
        }
      })
      if (error) throw error
      // success → browser redirects, timer is gc'd naturally
    } catch (err) {
      clearTimeout(_authTimer)
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
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
      <Route path="/about" element={<Suspense fallback={null}><About /></Suspense>} />
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
          <div style={{display:'flex',flexDirection:'column',gap:3}}>
            <span className="navbar-brand" style={{fontFamily:'"Orbitron",sans-serif',letterSpacing:'0.05em',opacity:0.9,whiteSpace:'nowrap'}}>
              <span style={{color:'#f59e0b',fontWeight:400}}>PREDICT</span>{' '}<span style={{color:'#f59e0b',fontWeight:700,textShadow:'0 0 8px rgba(245,158,11,0.4)'}}>ALPHA</span>
            </span>
            <div style={{display:'flex',alignItems:'center',gap:5}}>
              <span style={{display:'inline-block',width:6,height:6,borderRadius:'50%',background:G.green,boxShadow:`0 0 8px ${G.green}`,animation:'blink 0.5s ease-in-out infinite'}} />
              <span style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,letterSpacing:'0.3em',color:G.green}}>LIVE</span>
              <span style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,color:G.green,marginLeft:6,opacity:0.8}}>{liveCountdown}s</span>
            </div>
          </div>
        </div>

        {/* learn link — desktop only */}
        <Link to="/about" className="hide-mobile" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>LEARN</Link>
        <a href="mailto:admin@predictalpha.app" className="hide-mobile" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '6px 14px', cursor: 'pointer', textTransform: 'uppercase', textDecoration: 'none' }}>CONTACT</a>

        {/* auth — desktop only */}
        {authLoading ? (
          <div className="hide-mobile" style={{ width: 88, height: 32, background: '#1a1a1a', borderRadius: 6, opacity: 0.5 }} />
        ) : user ? (
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
            {!isPro && (
              <button onClick={() => setPricingOpen(true)} style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.12em', color: '#000', background: `linear-gradient(135deg, ${G.gold}, #d97706)`, border: 'none', borderRadius: 6, padding: '8px 18px', cursor: 'pointer', textTransform: 'uppercase', fontWeight: 'bold', boxShadow: `0 0 12px ${G.goldGlow}` }}>⚡ UPGRADE</button>
            )}
            {isPro && (
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.12em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}`, borderRadius: 4, padding: '5px 10px' }}>PRO</span>
            )}
            <button onClick={handleLogout} style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.text, background: 'none', border: '1px solid #333', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', textTransform: 'uppercase' }}>LOGOUT</button>
          </div>
        ) : (
          <button className="hide-mobile" onClick={() => { setAuthTab('login'); setAuthOpen(true) }} style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '8px 16px', cursor: 'pointer', textTransform: 'uppercase' }}>LOGIN</button>
        )}

        {/* hamburger — mobile only */}
        <button className="show-mobile" onClick={() => setMenuOpen(o => !o)} style={{background:'none',border:'none',cursor:'pointer',color:'#f59e0b',fontSize:28,lineHeight:1,padding:'10px',minWidth:44,minHeight:44,display:'none'}}>☰</button>

        {/* mobile dropdown */}
        {menuOpen && (
          <div onClick={() => setMenuOpen(false)} style={{
            position: 'fixed', top: 68, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 998
          }} />
        )}
        {menuOpen && (
          <div style={{position:'absolute',top:68,left:0,right:0,background:'rgba(10,10,10,0.97)',borderBottom:`1px solid #2a1f00`,zIndex:999,padding:'12px 0'}}>
            {/* User section for mobile */}
            {authLoading ? null : user ? (
              <div style={{padding:'16px 20px',borderBottom:`1px solid #2a1f00`,marginBottom:8}}>
                {/* identity row */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                  {user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="User avatar" style={{width:34,height:34,borderRadius:'50%',border:`2px solid ${G.gold}`,flexShrink:0}} />
                  ) : (
                    <div style={{width:34,height:34,borderRadius:'50%',background:G.goldDim,border:`2px solid ${G.gold}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'"Share Tech Mono",monospace',fontSize:12,fontWeight:'bold',color:G.gold,flexShrink:0}}>
                      {user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:'"Share Tech Mono",monospace',fontSize:13,color:G.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'200px'}}>{user.email}</div>
                    {isPro && <div style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,color:G.gold,letterSpacing:'0.15em',marginTop:2}}>PRO MEMBER</div>}
                  </div>
                </div>
                {/* CTA */}
                {!isPro && (
                  <button onClick={() => { setPricingOpen(true); setMenuOpen(false) }} style={{width:'100%',fontFamily:'"Share Tech Mono",monospace',fontSize:14,letterSpacing:'0.15em',color:'#000',background:`linear-gradient(135deg, ${G.gold}, #d97706)`,border:'none',borderRadius:8,padding:'15px 20px',cursor:'pointer',textTransform:'uppercase',fontWeight:'bold',marginBottom:10,minHeight:52,boxShadow:`0 0 20px ${G.goldGlow}`}}>⚡ UPGRADE TO PRO</button>
                )}
                <button onClick={() => { handleLogout(); setMenuOpen(false) }} style={{width:'100%',fontFamily:'"Share Tech Mono",monospace',fontSize:10,letterSpacing:'0.15em',color:G.text,background:'none',border:'1px solid #333',borderRadius:6,padding:'11px 16px',cursor:'pointer',textTransform:'uppercase',minHeight:44}}>LOGOUT</button>
              </div>
            ) : (
              <div style={{padding:'12px 20px',borderBottom:`1px solid #2a1f00`,marginBottom:8}}>
                <button onClick={() => { setAuthTab('login'); setAuthOpen(true); setMenuOpen(false) }} style={{width:'100%',fontFamily:'"Share Tech Mono",monospace',fontSize:11,letterSpacing:'0.15em',color:G.gold,background:G.goldDim,border:`1px solid ${G.gold}44`,borderRadius:6,padding:'13px 16px',cursor:'pointer',textTransform:'uppercase',minHeight:48}}>LOGIN</button>
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

        {/* AI ANALYSING bar — pinned to bottom edge of sticky header */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          opacity:(loading||deepRunning||refreshing)?1:0,
          transition:'opacity 0.5s',
          pointerEvents:'none',
        }}>
          <div style={{width:'100%',height:3,background:'linear-gradient(90deg,transparent,#f59e0b,#fbbf24,#f59e0b,transparent)',backgroundSize:'200% 100%',animation:'analysisShimmer 1.5s linear infinite'}} />
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero-section" style={{display:'block',width:'100%'}}>
        <div style={{padding:'10px 16px',borderBottom:'1px solid #1a1a1a',textAlign:'center',background:'#0a0a0a'}}>
          <span className="ai-title ai-banner" style={{fontFamily:'"Share Tech Mono",monospace',fontSize:16,letterSpacing:'0.3em',color:'#f59e0b',opacity:0.8,animation:'textPulse 2.5s ease-in-out infinite'}}>AI PREDICTING FUTURE</span>
          <div className="ai-sub" style={{fontFamily:'"Share Tech Mono",monospace',fontSize:9,color:'#6b7280',letterSpacing:'0.15em',opacity:0.6,marginTop:3}}>Predictions may be inaccurate · Not financial advice · For educational purposes only</div>
        </div>
        {/* analysis loading bar */}
        <div style={{opacity:(loading||deepRunning||refreshing)?1:0,transition:'opacity 0.5s'}}>
          <div style={{width:'100%',height:3,background:'linear-gradient(90deg,transparent,#f59e0b,#fbbf24,#f59e0b,transparent)',backgroundSize:'200% 100%',animation:'analysisShimmer 1.5s linear infinite'}} />
          <div style={{fontFamily:'"Share Tech Mono",monospace',fontSize:11,letterSpacing:'0.3em',color:'#f59e0b',textAlign:'center',marginTop:6,animation:'textPulse 2s ease-in-out infinite'}}>{ANALYSIS_MSGS[msgIdx]}</div>
        </div>
        <div style={{textAlign:'center',padding:'16px 0'}}>
          <button className="deep-btn" onClick={handleDeepClick}
          style={{
            fontFamily:'"Orbitron",sans-serif',
            fontSize:10,
            letterSpacing:'0.35em',
            padding:'11px 28px',
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
            {!priceLoaded ? (
              [0,1,2,3].map(i => <Skel key={i} h={80} />)
            ) : (
              <>
                <StatCard label={<>BTC Price<Tooltip text="Live price updated every 30s via Binance WebSocket"/></>}   value={fmtPrice(price?.price)}          sub="USD · Last updated live" icon="₿" />
                <StatCard label={<>24h Change<Tooltip text="Price change last 24h — positive means bullish momentum"/></>}  value={fmtPct(change)}                  sub={isUp ? 'Bullish momentum' : 'Bearish momentum'} valueColor={chgColor} icon={isUp ? '▲' : '▼'} />
                <StatCard label={<>24h Volume<Tooltip text="Total trading volume spot + derivatives"/></>}  value={fmtLarge(price?.volume_24h)}     sub="Spot + derivatives" />
                <StatCard label={<>Market Cap<Tooltip text="Total market value = price × circulating supply"/></>}  value={fmtLarge(price?.market_cap || null)} sub="USD market cap" />
              </>
            )}
          </div>
        </div>

        {/* row 2 — AI predictions */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>AI Price Predictions</div>
          <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 16 }}>

            {/* 1H — always free */}
            <div style={{ position: 'relative' }}>
              {!priceLoaded ? <Skel h={120} /> : (
                <>
                  <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: '#10b981', color: '#000', fontFamily: '"Share Tech Mono",monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', padding: '2px 7px', borderRadius: 4 }}>FREE</div>
                  <PredCard key="1h" horizonKey="1h" horizon={<>1H<Tooltip text="Shortest horizon — highest confidence intraday signal"/></>} data={preds['1h']} loading={loading} />
                </>
              )}
            </div>

            {/* 4H–1MONTH — locked for non-Pro users */}
            {[
              { k: '4h',     label: '4H',     tip: '4-hour AI ensemble prediction' },
              { k: '8h',     label: '8H',     tip: '8-hour AI ensemble prediction' },
              { k: '12h',    label: '12H',    tip: '12-hour AI ensemble prediction' },
              { k: '24h',    label: '24H',    tip: '24-hour AI ensemble prediction' },
              { k: '1week',  label: '1WEEK',  tip: 'Weekly AI ensemble prediction' },
              { k: '1month', label: '1MONTH', tip: 'Monthly AI ensemble prediction' },
            ].map(({ k, label, tip }) => (
              <div key={k} style={{ position: 'relative' }}>
                {!slowLoaded ? <Skel h={120} /> : (
                <>
                {/* blurred card underneath */}
                <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none', userSelect: 'none' }}>
                  <PredCard horizonKey={k} horizon={<>{label}<Tooltip text={tip}/></>} data={preds[k]} loading={loading} />
                </div>
                {/* lock overlay */}
                {!isPro && (
                  <div onClick={() => setPricingOpen(true)} style={{
                    position: 'absolute', inset: 0, zIndex: 3,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(10,10,10,0.55)',
                    backdropFilter: 'blur(1px)',
                    border: `1px solid ${G.gold}33`,
                    gap: 6,
                  }}>
                    <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                    <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center', lineHeight: 1.5 }}>PRO<br/>$12.99/mo</span>
                  </div>
                )}
                </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* row 3 — sentiment (full-width) + indicators */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Market Sentiment & Technical Indicators</div>
          {!slowLoaded ? <Skel h={220} /> : <>
          {/* Fear & Greed: non-logged-in sees today only, logged-in sees history */}
          <SentimentMeter value={sentiment?.value} label={sentiment?.classification} history={user ? sentiment?.history : []} />
          {/* Media Sentiment: locked for non-logged-in */}
          <div style={{ position: 'relative' }}>
            <div style={{ filter: user ? 'none' : 'blur(5px)', pointerEvents: user ? 'auto' : 'none' }}>
              <NewsSentimentWidget data={newsSentiment} />
            </div>
            {!user && (
              <div onClick={() => setAuthOpen(true)} style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
                <span style={{ fontSize: 20 }}>🔒</span>
                <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>SIGN UP FREE</span>
              </div>
            )}
          </div>
          {/* RSI & MACD: locked for non-logged-in, visible for free */}
          <div style={{ position: 'relative', marginTop: 16 }}>
            <div style={{ filter: user ? 'none' : 'blur(5px)', pointerEvents: user ? 'auto' : 'none' }}>
              <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                <IndCard
                  label={<>RSI (14)<Tooltip text="Below 30 oversold buy signal — above 70 overbought sell signal"/></>}
                  value={rsi != null ? fmtNum(rsi, 1) : '—'}
                  sub={rsi == null ? '' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
                  barName="rsi" barRaw={rsi}
                />
                <IndCard
                  label={<>MACD<Tooltip text="MACD above signal line = bullish momentum"/></>}
                  value={macd ? fmtNum(macd.macd, 1) : '—'}
                  sub={macd ? (macd.histogram > 0 ? 'Bullish' : 'Bearish') : ''}
                  barName="macd" barRaw={macd?.macd}
                />
                <IndCard
                  label={<>MACD Signal<Tooltip text="MACD above signal line = bullish momentum"/></>}
                  value={macd ? fmtNum(macd.signal, 1) : '—'}
                  sub={macd ? `Hist: ${fmtNum(macd.histogram, 1)}` : ''}
                  barName="macdSig" barRaw={macd?.histogram}
                />
              </div>
            </div>
            {!user && (
              <div onClick={() => setAuthOpen(true)} style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
                <span style={{ fontSize: 20 }}>🔒</span>
                <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>SIGN UP FREE</span>
              </div>
            )}
          </div>
          {/* BB & EMA: Pro only */}
          <div style={{ position: 'relative', marginTop: 14 }}>
            <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none' }}>
              <div className="grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
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
            </div>
            {!isPro && (
              <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
                <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>PRO ONLY<br/>$12.99/mo</span>
              </div>
            )}
          </div>
          {isPro && ema50 != null && ema200 != null && ema50 > ema200 && (
            <div style={{ marginTop: 12, fontFamily: '"Share Tech Mono", monospace', fontSize: 12, letterSpacing: '0.15em', color: G.green }}>
              🟢 GOLDEN CROSS — Bullish
            </div>
          )}
          </>}
        </div>

        {/* row 4 — onchain (Pro only) */}
        {!slowLoaded && <div style={{ marginBottom: 40 }}><div style={sectionLabel}>On-Chain Data</div><Skel h={100} /></div>}
        {onchain && (
          <div style={{ marginBottom: 40, position: 'relative' }}>
            <div style={sectionLabel}>On-Chain Data {!isPro && <span style={{ color: G.gold, fontSize: 9 }}>👑 PRO</span>}</div>
            <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none' }}>
              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {onchain.n_tx       != null && <IndCard label="Transactions"    value={Number(onchain.n_tx).toLocaleString()}       sub="Last 24h" />}
                {onchain.hash_rate  != null && <IndCard label={<>Hash Rate<Tooltip text="Higher = more miners = stronger network security"/></>}       value={`${Number(onchain.hash_rate).toFixed(2)} EH/s`} sub="Network difficulty" barName="hashRate" />}
                {onchain.minutes_between_blocks != null && <IndCard label={<>Block Time<Tooltip text="Normal ~10 min — higher means network congestion"/></>} value={`${Number(onchain.minutes_between_blocks).toFixed(1)} min`} sub="Avg block interval" barName="blockTime" barRaw={onchain.minutes_between_blocks} />}
                {onchain.total_fees_btc != null && <IndCard label={<>Total Fees<Tooltip text="Total BTC paid as fees to miners last 24h"/></>}  value={`${Number(onchain.total_fees_btc).toFixed(4)} BTC`} sub="Last 24h" barName="fees" />}
              </div>
            </div>
            {!isPro && (
              <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
                <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>PRO ONLY<br/>$12.99/mo</span>
              </div>
            )}
          </div>
        )}

        {/* row 5 — futures market (Pro only) */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={sectionLabel}>Futures Market {!isPro && <span style={{ color: G.gold, fontSize: 9 }}>👑 PRO</span>}</div>
          <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none' }}>
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <IndCard
                label={<>Funding Rate<Tooltip text="Positive = longs pay shorts bullish market"/></>}
                value={fundingRate != null ? (fundingRate.rate.toFixed(4) + '%') : '—'}
                sub={fundingRate?.signal}
                barName="fundingRate"
                barRaw={fundingRate?.rate}
              />
              <IndCard
                label={<>Long/Short Ratio<Tooltip text="Ratio below 1.0 means more shorts than longs. Combined with whale buying, this could trigger a short squeeze — forcing shorts to buy back, causing a rapid price spike."/></>}
                value={longShort != null ? longShort.ratio.toFixed(2) : '—'}
                sub={longShort != null ? (longShort.ratio >= 1.05 ? 'More Longs' : longShort.ratio >= 0.95 ? 'Balanced' : longShort.ratio < 0.7 ? 'Short squeeze risk 🔥' : 'More Shorts') : ''}
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
          {!isPro && (
            <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
              <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>PRO ONLY<br/>$12.99/mo</span>
            </div>
          )}
        </div>

        {/* row 6 — order book (Pro only) */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={sectionLabel}>Order Book {!isPro && <span style={{ color: G.gold, fontSize: 9 }}>👑 PRO</span>}</div>
          <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none' }}>
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
          {!isPro && (
            <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
              <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>PRO ONLY<br/>$12.99/mo</span>
            </div>
          )}
        </div>

        {/* row 7 — key levels (Pro only) */}
        {keyLevels && (
          <div style={{ marginBottom: 40, position: 'relative' }}>
            <div style={sectionLabel}>Key Levels {!isPro && <span style={{ color: G.gold, fontSize: 9 }}>👑 PRO</span>}</div>
            <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none' }}>
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
            {!isPro && (
              <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
                <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>PRO ONLY<br/>$12.99/mo</span>
              </div>
            )}
          </div>
        )}

        {/* row 8 — mempool (Pro only) */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={sectionLabel}>Mempool {!isPro && <span style={{ color: G.gold, fontSize: 9 }}>👑 PRO</span>}</div>
          <div style={{ filter: isPro ? 'none' : 'blur(5px)', pointerEvents: isPro ? 'auto' : 'none' }}>
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
          {!isPro && (
            <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', top: 30, left: 0, right: 0, bottom: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
              <img src="/logoegyptfinal.webp" alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center' }}>PRO ONLY<br/>$12.99/mo</span>
            </div>
          )}
        </div>

        {/* row 9 — market tensions */}
        <div style={{ marginBottom: 40, position: 'relative' }}>
          <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Market Tensions &amp; Divergences</span>
            <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 8, letterSpacing: '0.12em', color: '#fff', background: '#a855f7', borderRadius: 3, padding: '2px 7px', fontWeight: 700, textTransform: 'uppercase' }}>AI</span>
            {!isPro && <span style={{ color: G.gold, fontSize: 9 }}>👑 PRO</span>}
          </div>

          {/* Not logged in — teaser only */}
          {!user && (
            <div onClick={() => setAuthOpen(true)} style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '28px 24px' }}>
              <span style={{ fontSize: 20 }}>🔒</span>
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 12, color: G.text, letterSpacing: '0.1em' }}>
                AI detected market setups —{' '}
                <span style={{ color: G.gold, textDecoration: 'underline' }}>Login to see</span>
              </span>
            </div>
          )}

          {/* Logged in — show cards */}
          {user && (
            <>
              {tensions && tensions.length > 0 ? (
                <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {tensions.map((t, i) => {
                    const locked = !isPro && i > 0
                    return (
                      <div key={i} style={{ position: 'relative' }}>
                        <div style={{ filter: locked ? 'blur(4px)' : 'none', pointerEvents: locked ? 'none' : 'auto', userSelect: locked ? 'none' : 'auto' }}>
                          <TensionCard setup={t} />
                        </div>
                        {locked && (
                          <div onClick={() => setPricingOpen(true)} style={{ position: 'absolute', inset: 0, zIndex: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,10,10,0.55)', borderRadius: 10, cursor: 'pointer', gap: 6 }}>
                            <Lock size={18} color={G.gold} />
                            <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, textAlign: 'center', lineHeight: 1.8 }}>PRO<br/>$12.99/mo</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid-2col" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {[0, 1].map(i => (
                    <div key={i} style={{ ...cardStyle, borderLeft: '4px solid #333', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.text, opacity: 0.4 }}>
                        {tensions === null ? 'Loading…' : 'No data'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* footer */}
        <div className="site-footer" style={{ borderTop: `1px solid ${G.border}`, paddingTop: 28, paddingBottom: 20, marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <div className="footer-row" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 13, letterSpacing: '0.12em', color: G.gold }}>PREDICT ALPHA</span>
            <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, color: '#6b7280', letterSpacing: '0.15em' }}>NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY</span>
            <a href="mailto:admin@predictalpha.app" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '5px 12px', textTransform: 'uppercase', textDecoration: 'none' }}>CONTACT US</a>
          </div>
          <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, color: '#4b5563', letterSpacing: '0.2em' }}>POWERED BY ANTHROPIC</div>
        </div>
      </main>

      {/* ── auth modal ── */}
      {authOpen && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)', overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'16px' }}>
          {authSuccess ? (
            /* success screen */
            <div style={{
              background:G.card, borderRadius:14, width:'100%', maxWidth:400, padding:'40px 24px', textAlign:'center',
              maxHeight:'calc(100vh - 32px)', overflowY:'auto',
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
            <div style={{ background:G.card, border:`1px solid ${G.gold}55`, borderRadius:14, boxShadow:`0 0 60px ${G.goldGlow}`, width:'100%', maxWidth:400, padding:'28px 24px', maxHeight:'calc(100vh - 32px)', overflowY:'auto' }}>
              {/* close */}
              <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
                <button onClick={() => { setAuthOpen(false); setAuthError('') }} style={{ background:'none', border:'none', color:G.text, cursor:'pointer', fontSize:20, padding:'8px 10px', minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>
              {/* tabs */}
              <div style={{ display:'flex', gap:0, marginBottom:24, borderBottom:`1px solid ${G.border}` }}>
                {['login', 'signup'].map(tab => (
                  <button key={tab} onClick={() => { setAuthTab(tab); setAuthError('') }} style={{
                    flex:1, fontFamily:'"Orbitron",sans-serif', fontSize:11, letterSpacing:'0.2em', textTransform:'uppercase',
                    padding:'12px 0', background:'none', border:'none', cursor:'pointer',
                    color: authTab === tab ? G.gold : G.text,
                    borderBottom: authTab === tab ? `2px solid ${G.gold}` : '2px solid transparent',
                    marginBottom: -1,
                  }}>{tab === 'signup' ? 'SIGN UP' : 'SIGN IN'}</button>
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
                    fontFamily:'"Share Tech Mono",monospace', fontSize:16,
                    background:'#0a0a0a', border:`1px solid ${authError ? G.red : G.border}`,
                    borderRadius:8, color:G.bright, padding:'12px 16px',
                    outline:'none', marginBottom:12, letterSpacing:'0.05em',
                    WebkitAppearance:'none',
                  }}
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authPass}
                  onChange={e => { setAuthPass(e.target.value); setAuthError('') }}
                  style={{
                    width:'100%', boxSizing:'border-box',
                    fontFamily:'"Share Tech Mono",monospace', fontSize:16,
                    background:'#0a0a0a', border:`1px solid ${authError ? G.red : G.border}`,
                    borderRadius:8, color:G.bright, padding:'12px 16px',
                    outline:'none', marginBottom: authError ? 8 : 20, letterSpacing:'0.05em',
                    WebkitAppearance:'none',
                  }}
                />
                {authError && (
                  <div style={{ fontFamily:'"Share Tech Mono",monospace', fontSize:11, color:G.red, marginBottom:12, letterSpacing:'0.05em', lineHeight:1.6 }}>
                    {authError === '__already_exists__' ? (
                      <>
                        You already have an account.{' '}
                        <span
                          onClick={() => { setAuthTab('login'); setAuthError('') }}
                          style={{ color:G.gold, cursor:'pointer', textDecoration:'underline' }}
                        >
                          Click here to Sign In
                        </span>
                      </>
                    ) : authError}
                  </div>
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
                  {authBusy ? 'PLEASE WAIT…' : (authTab === 'signup' ? 'CREATE ACCOUNT' : 'SIGN IN')}
                </button>
              </form>
              <div style={{ fontFamily:'"Share Tech Mono",monospace', fontSize:9, color:'#4b5563', letterSpacing:'0.15em', textAlign:'center', marginTop:16 }}>
                {authTab === 'signup'
                  ? 'FREE · UNLOCK ALL PREDICTIONS · CONFIRMATION EMAIL SENT'
                  : 'EXISTING USERS · NO EMAIL CONFIRMATION NEEDED'}
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
          <div className="deep-modal-box" style={{
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
                <div className="deep-horizon-grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
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
                    ${deepResult?.current_price?.toLocaleString()}
                  </div>
                  <div style={{fontSize:11,color:'#6b7280',letterSpacing:'0.2em',marginBottom:20}}>CURRENT BTC PRICE</div>
                  <div className="deep-result-badges" style={{display:'flex',gap:12,justifyContent:'center',marginBottom:12}}>
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

      {/* Pricing Modal */}
      {pricingOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)',
        }} onClick={() => setPricingOpen(false)}>
          <div onClick={e => e.stopPropagation()} className="pricing-modal-box" style={{
            background: G.card, borderRadius: 16, maxWidth: 420, width: '92%',
            border: `2px solid ${G.gold}`, boxShadow: `0 0 60px ${G.goldGlow}`,
            maxHeight: '90vh', overflowY: 'auto',
          }}>
            <div style={{ padding: '24px 28px', borderBottom: `1px solid ${G.border}`, textAlign: 'center' }}>
              <img src="/logoegyptfinal.webp" alt="Predict Alpha" style={{ width: 80, height: 80, objectFit: 'contain', marginBottom: 8 }} />
              <div style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 20, color: G.gold, letterSpacing: '0.15em', marginBottom: 8 }}>
                PREDICT ALPHA PRO
              </div>
              <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 12, color: G.text }}>
                Unlock the full power of AI predictions
              </div>
            </div>

            <div style={{ padding: '24px 28px' }}>
              <div style={{ fontFamily: '"Orbitron",sans-serif', fontSize: 36, color: G.bright, textAlign: 'center', marginBottom: 4 }}>
                $12.99<span style={{ fontSize: 14, color: G.text }}>/month</span>
              </div>
              <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.text, textAlign: 'center', marginBottom: 24 }}>
                Cancel anytime
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {[
                  'All prediction horizons (1H, 4H, 8H, 12H, 24H, 1 Month)',
                  'RSI, MACD, Bollinger Bands, EMA 50/200',
                  'Fear & Greed 7-day history',
                  'Media Sentiment Analysis (AI-powered)',
                  'On-Chain Data (Hash Rate, Fees, Block Time)',
                  'Futures Market (Funding Rate, Long/Short, Open Interest)',
                  'Order Book & Whale Activity',
                  'Key Levels, Pivot Points & Fibonacci',
                  'Mempool & Network Data',
                  'Market Tensions & Divergences (AI-powered)',
                  '4 AI trading setups updated every 5 min',
                  'Unlimited Deep Analysis (9-signal AI score)',
                  'Priority support',
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: G.green, fontSize: 12, marginTop: 1 }}>✓</span>
                    <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.bright, lineHeight: 1.4 }}>{f}</span>
                  </div>
                ))}
              </div>

              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.15em', color: G.gold, opacity: 0.8 }}>
                  ⚡ Powered by Claude Haiku · Anthropic AI
                </span>
              </div>

              <button onClick={handleUpgrade} style={{
                width: '100%', padding: '14px 20px',
                fontFamily: '"Orbitron",sans-serif', fontSize: 14, letterSpacing: '0.2em',
                background: `linear-gradient(135deg, ${G.gold}, #d97706)`,
                border: 'none', borderRadius: 8, color: '#000', cursor: 'pointer',
                fontWeight: 'bold', textTransform: 'uppercase',
                boxShadow: `0 0 30px ${G.goldGlow}`,
              }}>
                UPGRADE NOW
              </button>

              {!user && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.text }}>
                    Don't have an account?{' '}
                    <span onClick={() => { setPricingOpen(false); setAuthOpen(true) }} style={{ color: G.gold, cursor: 'pointer', textDecoration: 'underline' }}>
                      Sign up free
                    </span>
                  </span>
                </div>
              )}

              {user && !isPro && credits > 0 && (
                <div style={{ marginTop: 16, textAlign: 'center', fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.text }}>
                  <span style={{ color: G.gold }}>{credits}</span> {credits !== 1 ? 'analyses' : 'analyse'} remaining today
                </div>
              )}
              {user && !isPro && credits === 0 && (
                <div style={{ marginTop: 16, textAlign: 'center', fontFamily: '"Share Tech Mono",monospace', fontSize: 11, color: G.text }}>
                  <span style={{ color: G.red }}>0</span> analyses remaining today
                  <div style={{ marginTop: 4, fontSize: 10, color: '#6b7280' }}>Resets in {resetIn}</div>
                </div>
              )}
            </div>

            <div style={{ padding: '12px 28px 20px', textAlign: 'center' }}>
              <button onClick={() => setPricingOpen(false)} style={{
                fontFamily: '"Share Tech Mono",monospace', fontSize: 11, letterSpacing: '0.1em',
                background: 'none', border: `1px solid ${G.border}`, borderRadius: 6,
                color: G.text, cursor: 'pointer', padding: '8px 20px', textTransform: 'uppercase',
              }}>
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shimmer          { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes analysisShimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
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
        @keyframes introScan  { 0%{left:-2px;opacity:1} 100%{left:100vw;opacity:0} }
        @keyframes introScanH { 0%{top:-2px;opacity:1}  100%{top:100vh;opacity:0}  }

        /* ── Desktop base ── */
        * { box-sizing: border-box; }
        body { overflow-x: hidden; }
        .navbar-brand { font-size: 22px; }

        /* ── Tablet landscape: 1025px (desktop grid kicks in naturally) ── */

        /* ── Tablet portrait: 769px – 1024px ── */
        @media (min-width: 769px) and (max-width: 1024px) {
          .main-pad     { padding: 20px !important; }
          .header-inner { padding: 0 20px !important; }
          .grid-4       { grid-template-columns: 1fr 1fr !important; gap: 14px !important; }
          .grid-3       { grid-template-columns: 1fr 1fr !important; gap: 14px !important; }
          .grid-6       { grid-template-columns: repeat(3, 1fr) !important; gap: 12px !important; }
          .navbar-brand { font-size: 18px !important; }
        }

        /* ── Mobile + large phone: ≤768px ── */
        @media (max-width: 768px) {
          .site-footer  { padding-bottom: 20px !important; gap: 12px !important; }
          .footer-row   { flex-direction: column !important; align-items: center !important; gap: 12px !important; width: 100% !important; }
          .footer-row span, .footer-row a { width: 100% !important; text-align: center !important; font-size: 10px !important; }
          .grid-2col    { grid-template-columns: 1fr !important; gap: 10px !important; }
          .grid-3       { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .grid-4       { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .grid-5       { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .grid-6       { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .sentiment-card { width: 100% !important; min-width: 0 !important; }
          .ind-card     { min-height: 80px !important; padding: 10px 12px !important; }
          .main-pad     { padding: 14px !important; }
          .header-inner { flex-direction: row !important; justify-content: space-between !important;
                          align-items: center !important; padding: 0 12px !important; flex-wrap: nowrap !important; }
          .header-right { position: static !important; gap: 8px !important; }
          .header-price { font-size: 20px !important; }
          .hide-mobile  { display: none !important; }
          .show-mobile  { display: flex !important; align-items: center !important; }
          .navbar-brand { font-size: 14px !important; white-space: nowrap !important; }
          .ai-title     { font-size: 13px !important; }
          .ai-banner    { font-size: 11px !important; letter-spacing: 0.1em !important; }
          .ai-sub       { font-size: 7px !important; letter-spacing: 0.05em !important; }
          .deep-btn     { font-size: 13px !important; padding: 14px 28px !important;
                          min-height: 52px !important; max-width: 300px !important; }
          .pred-horizon   { font-size: 12px !important; font-weight: 700 !important; letter-spacing: 0.08em !important; }
          .pred-direction { font-size: 10px !important; }
          .pred-pct       { font-size: 11px !important; }
          .pred-conf      { font-size: 10px !important; }
          /* Deep Analysis modal: full-screen on mobile */
          .deep-modal-box { width: 100% !important; max-width: 100% !important;
                            height: 100% !important; max-height: 100% !important;
                            border-radius: 0 !important; }
          /* Horizon selector: 2 cols on mobile */
          .deep-horizon-grid { grid-template-columns: repeat(2, 1fr) !important; }
          /* Result badges: wrap if needed */
          .deep-result-badges { flex-wrap: wrap !important; justify-content: center !important; }
          /* Pricing modal: scrollable, fits screen */
          .pricing-modal-box { max-height: 90vh !important; max-width: 95vw !important; overflow-y: auto !important;
                               width: 95% !important; border-radius: 12px !important;
                               padding: 0 !important; }
          .pricing-modal-box button { min-height: 48px !important; font-size: 13px !important; }
          .pricing-modal-box > div { padding: 18px 18px !important; }
          /* Ensure all buttons are tappable */
          button { min-height: 44px; }
        }

        /* ── Small phones: ≤480px (iPhone SE 375px, Galaxy S series) ── */
        @media (max-width: 480px) {
          .grid-3       { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .grid-4       { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .grid-6       { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .main-pad     { padding: 10px !important; }
          .header-price { font-size: 18px !important; }
          .navbar-brand { font-size: 13px !important; letter-spacing: 0.03em !important; }
          .pred-horizon { font-size: 11px !important; }
          .deep-btn     { font-size: 12px !important; padding: 13px 22px !important; }
          .ind-card     { padding: 8px 10px !important; }
          .hide-mobile  { display: none !important; }
          .main-credit  { font-size: 9px !important; letter-spacing: 0.08em !important; padding-top: 12px !important; }
        }

        /* ── Very small: ≤360px (older Androids, iPhone SE 1st gen) ── */
        @media (max-width: 360px) {
          .grid-4       { grid-template-columns: 1fr !important; gap: 8px !important; }
          .header-price { font-size: 16px !important; }
          .navbar-brand { font-size: 11px !important; }
          .main-pad     { padding: 8px !important; }
        }
      `}</style>
    </div>
      } />
    </Routes>
    </>
  )
}
