import { useState, useEffect, useCallback } from 'react'
import {
  fetchLivePrice,
  fetchSentiment,
  fetchPrediction,
  fetchIndicators,
  fetchPriceHistory,
  fetchOnchain,
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

function PredCard({ horizon, data, loading }) {
  const gold = G.gold
  const up = data?.direction === 'up'
  const dirColor = up ? G.green : G.red
  const conf = data ? Math.round(data.confidence) : 0

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

function IndCard({ label, value, sub }) {
  return (
    <div style={{ ...cardStyle, padding: '14px 18px' }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 17, ...goldText }}>{value}</div>
      {sub && <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: G.text, marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function SentimentMeter({ value, label }) {
  const color = value >= 75 ? G.green : value >= 55 ? '#84cc16' : value >= 45 ? G.gold : value >= 25 ? '#f97316' : G.red
  return (
    <div style={cardStyle}>
      <div style={labelStyle}>Fear & Greed Index</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: `3px solid ${color}`,
          boxShadow: `0 0 16px ${color}66`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 20, color, fontWeight: 'bold' }}>{value ?? '—'}</span>
        </div>
        <div>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 15, color, marginBottom: 4 }}>{label ?? '—'}</div>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 10, color: G.text, letterSpacing: '0.2em' }}>ALTERNATIVE.ME</div>
          {value != null && (
            <div style={{ background: '#1a1a1a', borderRadius: 3, height: 4, width: 120, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ height: '100%', width: `${value}%`, background: `linear-gradient(90deg, ${G.red}, ${G.gold}, ${G.green})`, borderRadius: 3 }} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
const PRED_HORIZONS = ['4h', '8h', '12h', '24h', '1month']
const REFRESH_MS    = 60_000

export default function App() {
  const [price,    setPrice]    = useState(null)
  const [sentiment,setSentiment]= useState(null)
  const [preds,    setPreds]    = useState({})
  const [indics,   setIndics]   = useState(null)
  const [onchain,  setOnchain]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [lastAt,   setLastAt]   = useState(null)
  const [countdown,setCountdown]= useState(REFRESH_MS / 1000)

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

  const change  = price?.change_24h_pct ?? null
  const isUp    = change != null && change >= 0
  const chgColor = change == null ? G.gold : isUp ? G.green : G.red
  const rsi     = indics?.rsi
  const macd    = indics?.macd
  const bb      = indics?.bollinger_bands

  return (
    <div style={{ minHeight: '100vh', background: G.bg, paddingBottom: 64 }}>

      {/* scanline */}
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '2px', zIndex: 99, pointerEvents: 'none',
        background: `linear-gradient(90deg, transparent, ${G.goldDim}, ${G.gold}, ${G.goldDim}, transparent)`,
        opacity: 0.5, animation: 'scan 8s linear infinite',
      }} />

      {/* ── HEADER ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 32px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* logo */}
        <div>
          <div style={{
            fontFamily: '"Orbitron", sans-serif',
            fontSize: 22, fontWeight: 700, letterSpacing: '0.14em',
            color: G.gold,
            textShadow: `0 0 18px ${G.goldGlow}, 0 0 40px ${G.goldGlow}`,
          }}>
            DEEPVORTEX AI
          </div>
          <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, letterSpacing: '0.35em', color: G.text, textTransform: 'uppercase', marginTop: 2 }}>
            BTC Prediction Engine · deepvortexai.com
          </div>
        </div>

        {/* live ticker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {lastAt && (
            <div style={{ fontFamily: '"Share Tech Mono", monospace', fontSize: 9, color: G.text, letterSpacing: '0.2em', textAlign: 'right' }}>
              <div>REFRESHES IN {countdown}s</div>
              <div style={{ opacity: 0.5 }}>{lastAt.toLocaleTimeString()}</div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
              background: G.green, boxShadow: `0 0 8px ${G.green}`,
              animation: 'blink 1.5s ease-in-out infinite',
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

      {/* ── BODY ── */}
      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 32px' }}>

        {/* row 1 — market overview */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Market Overview</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <StatCard label="BTC Price"   value={fmtPrice(price?.price)}          sub="USD · Last updated live" icon="₿" />
            <StatCard label="24h Change"  value={fmtPct(change)}                  sub={isUp ? 'Bullish momentum' : 'Bearish momentum'} valueColor={chgColor} icon={isUp ? '▲' : '▼'} />
            <StatCard label="24h Volume"  value={fmtLarge(price?.volume_24h)}     sub="Spot + derivatives" />
            <StatCard label="Market Cap"  value={fmtLarge(price?.market_cap || null)} sub="USD market cap" />
          </div>
        </div>

        {/* row 2 — AI predictions */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>AI Price Predictions</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {PRED_HORIZONS.map(h => (
              <PredCard key={h} horizon={h.toUpperCase()} data={preds[h]} loading={loading} />
            ))}
          </div>
        </div>

        {/* row 3 — indicators + sentiment */}
        <div style={{ marginBottom: 40 }}>
          <div style={sectionLabel}>Technical Indicators</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 5fr', gap: 16, alignItems: 'start' }}>
            <SentimentMeter value={sentiment?.value} label={sentiment?.classification} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
              <IndCard
                label="RSI (14)"
                value={rsi != null ? fmtNum(rsi, 1) : '—'}
                sub={rsi == null ? '' : rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
              />
              <IndCard
                label="MACD"
                value={macd ? fmtNum(macd.macd, 1) : '—'}
                sub={macd ? (macd.macd > 0 ? 'Bullish' : 'Bearish') : ''}
              />
              <IndCard
                label="MACD Signal"
                value={macd ? fmtNum(macd.signal, 1) : '—'}
                sub={macd ? `Hist: ${fmtNum(macd.histogram, 1)}` : ''}
              />
              <IndCard
                label="BB Upper"
                value={bb ? fmtPrice(bb.upper) : '—'}
                sub="Bollinger Band"
              />
              <IndCard
                label="BB Lower"
                value={bb ? fmtPrice(bb.lower) : '—'}
                sub="Bollinger Band"
              />
            </div>
          </div>
        </div>

        {/* row 4 — onchain (optional) */}
        {onchain && (
          <div style={{ marginBottom: 40 }}>
            <div style={sectionLabel}>On-Chain Data</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {onchain.n_tx       != null && <IndCard label="Transactions"    value={Number(onchain.n_tx).toLocaleString()}       sub="Last 24h" />}
              {onchain.hash_rate  != null && <IndCard label="Hash Rate"       value={`${(onchain.hash_rate / 1e18).toFixed(2)} EH/s`} sub="Network difficulty" />}
              {onchain.minutes_between_blocks != null && <IndCard label="Block Time" value={`${Number(onchain.minutes_between_blocks).toFixed(1)} min`} sub="Avg block interval" />}
              {onchain.total_fees_btc != null && <IndCard label="Total Fees"  value={`${Math.abs(Number(onchain.total_fees_btc)).toFixed(4)} BTC`} sub="Last 24h" />}
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

      <style>{`
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes scan   { 0%{top:-2px} 100%{top:100vh} }
      `}</style>
    </div>
  )
}
