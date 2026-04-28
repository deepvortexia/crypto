import { useState, useEffect } from 'react'
import { fetchIndicators } from '../api/client'

function fmt(n, dec = 2) {
  return n == null ? '—' : Number(n).toFixed(dec)
}

function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ── RSI semi-circle gauge ────────────────────────────────────────────────────
function RsiGauge({ value }) {
  const cx = 60, cy = 56, r = 46
  const v = Math.max(0, Math.min(100, value ?? 0))
  const pct = v / 100
  const angle = Math.PI * (1 - pct)
  const ex = (cx + r * Math.cos(angle)).toFixed(3)
  const ey = (cy - r * Math.sin(angle)).toFixed(3)

  const color =
    v < 30 ? '#FFC200' :
    v > 70 ? '#ff3355' :
    '#FFD700'

  // Tick marks at 30 and 70
  const ticks = [0.3, 0.7].map(z => {
    const a = Math.PI * (1 - z)
    return {
      x1: (cx + (r - 7) * Math.cos(a)).toFixed(2),
      y1: (cy - (r - 7) * Math.sin(a)).toFixed(2),
      x2: (cx + (r + 7) * Math.cos(a)).toFixed(2),
      y2: (cy - (r + 7) * Math.sin(a)).toFixed(2),
    }
  })

  return (
    <svg width="120" height="74" viewBox="0 0 120 74" className="mx-auto block">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`}
        stroke="#1a1a2e" strokeWidth="8" fill="none" strokeLinecap="round"
      />
      {/* Zone ticks */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#2d2d4a" strokeWidth="1.5" />
      ))}
      {/* Fill */}
      {v > 0 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${ex} ${ey}`}
          stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 5px ${color}66)`, transition: 'all 0.7s ease' }}
        />
      )}
      {/* Needle dot */}
      {v > 0 && (
        <circle
          cx={ex} cy={ey} r="4"
          fill={color} stroke="#0d0d1a" strokeWidth="1.5"
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      )}
      {/* Value */}
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="18"
        fontFamily="'Share Tech Mono', monospace" fontWeight="600" fill={color}>
        {value != null ? Math.round(v) : '—'}
      </text>
      {/* Range labels */}
      <text x={cx - r - 4} y={cy + 14} textAnchor="middle" fontSize="8"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">0</text>
      <text x={cx + r + 4} y={cy + 14} textAnchor="middle" fontSize="8"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">100</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">50</text>
    </svg>
  )
}

function rsiStatus(v) {
  if (v == null)  return { label: '—',          cls: 'badge-neutral' }
  if (v <= 20)    return { label: 'Deep Oversold', cls: 'badge-up' }
  if (v < 30)     return { label: 'Oversold',    cls: 'badge-up' }
  if (v >= 80)    return { label: 'Deep Overbought', cls: 'badge-down' }
  if (v > 70)     return { label: 'Overbought',  cls: 'badge-down' }
  return              { label: 'Neutral',      cls: 'badge-neutral' }
}

// ── MACD display ─────────────────────────────────────────────────────────────
function MacdDisplay({ macd_line, signal_line, histogram }) {
  const h = histogram ?? 0
  const isPos = h >= 0
  const color = isPos ? '#FFC200' : '#ff3355'
  const barW = Math.min(100,
    macd_line != null && macd_line !== 0
      ? Math.abs(h / (Math.abs(macd_line) + 0.0001)) * 100
      : 50
  )

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between min-h-[44px]">
        <span className="stat-label">MACD Line</span>
        <span className={`font-mono text-sm tabular-nums ${isPos ? 'text-neon-green' : 'text-neon-red'}`}>
          {fmt(macd_line)}
        </span>
      </div>
      {signal_line != null && (
        <div className="flex items-center justify-between min-h-[44px]">
          <span className="stat-label">Signal</span>
          <span className="font-mono text-sm tabular-nums text-gray-400">{fmt(signal_line)}</span>
        </div>
      )}
      <div className="min-h-[44px] flex flex-col justify-center">
        <div className="flex items-center justify-between mb-1.5">
          <span className="stat-label">Histogram</span>
          <span className="font-mono text-xs tabular-nums" style={{ color }}>
            {h >= 0 ? '+' : ''}{fmt(h)}
          </span>
        </div>
        <div className="h-1.5 w-full bg-surface-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barW}%`, background: color, boxShadow: `0 0 4px ${color}88` }}
          />
        </div>
      </div>
      <p className="font-mono text-[10px] pt-1" style={{ color }}>
        {isPos ? '▲ Bullish momentum' : '▼ Bearish pressure'}
      </p>
    </div>
  )
}

// ── Bollinger Bands position bar ──────────────────────────────────────────────
function BollingerDisplay({ upper, middle, lower, price }) {
  const u = upper ?? 0, m = middle ?? 0, l = lower ?? 0, p = price ?? m
  const range = u - l
  const pricePct = range > 0 ? Math.max(2, Math.min(98, ((p - l) / range) * 100)) : 50
  const midPct   = range > 0 ? Math.max(0, Math.min(100, ((m - l) / range) * 100)) : 50

  const posColor =
    pricePct > 80 ? '#ff3355' :
    pricePct < 20 ? '#FFC200' :
    '#FFD700'

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between min-h-[44px]">
        <span className="stat-label">Upper Band</span>
        <span className="font-mono text-xs tabular-nums text-gray-400">{fmtPrice(upper)}</span>
      </div>

      {/* Range bar */}
      <div className="relative h-3 bg-surface-border rounded-full mx-1 my-2">
        {/* Middle band tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-gray-600"
          style={{ left: `${midPct}%` }}
        />
        {/* Price dot */}
        <div
          className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-surface-card transition-all duration-700"
          style={{
            left: `${pricePct}%`,
            transform: 'translate(-50%, -50%)',
            background: posColor,
            boxShadow: `0 0 6px ${posColor}`,
          }}
        />
      </div>

      <div className="flex items-center justify-between min-h-[44px]">
        <span className="stat-label">Lower Band</span>
        <span className="font-mono text-xs tabular-nums text-gray-400">{fmtPrice(lower)}</span>
      </div>
      <div className="flex items-center justify-between min-h-[44px]">
        <span className="stat-label">Band Position</span>
        <span className="font-mono text-sm tabular-nums" style={{ color: posColor }}>
          {range > 0 ? `${pricePct.toFixed(0)}%` : '—'}
        </span>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-3 pb-2 border-b border-surface-border">
      {children}
    </p>
  )
}

function Skeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 w-44 bg-surface-border rounded mb-5" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {[0, 1, 2].map(i => (
          <div key={i} className="space-y-3">
            <div className="h-3 w-20 bg-surface-border rounded" />
            <div className="h-20 bg-surface-border rounded" />
            <div className="h-3 w-24 bg-surface-border rounded" />
            <div className="h-3 w-16 bg-surface-border rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function IndicatorsPanel() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchIndicators()
      .then(d  => { if (!cancelled) { setData(d);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="card border-glow-red py-6 text-center">
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">
          Indicators unavailable
        </p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  // Normalise MACD — API may return an object or a raw number
  const rawMacd      = data?.macd
  const macd_line    = typeof rawMacd === 'object'
    ? (rawMacd?.macd_line ?? rawMacd?.macd ?? rawMacd?.value ?? null)
    : (rawMacd != null ? Number(rawMacd) : null)
  const signal_line  = typeof rawMacd === 'object' ? (rawMacd?.signal_line ?? rawMacd?.signal ?? null) : null
  const histogram    = typeof rawMacd === 'object' ? (rawMacd?.histogram ?? null) : null

  const bb = data?.bollinger_bands ?? {}
  const rsi = data?.rsi
  const { label: rsiLabel, cls: rsiCls } = rsiStatus(rsi)

  return (
    <section className="card" aria-labelledby="indicators-heading">
      <div className="flex items-center gap-3 mb-5">
        <h2
          id="indicators-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase"
        >
          Technical Indicators
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:divide-x sm:divide-surface-border">
        {/* ── RSI ── */}
        <div className="sm:pr-6">
          <SectionTitle>RSI (14)</SectionTitle>
          <RsiGauge value={rsi} />
          <div className="flex items-center justify-between mt-3">
            <span className="font-mono text-xs text-gray-500">Relative Strength</span>
            <span className={rsiCls}>{rsiLabel}</span>
          </div>
        </div>

        {/* ── MACD ── */}
        <div className="sm:px-6">
          <SectionTitle>MACD (12, 26, 9)</SectionTitle>
          <MacdDisplay
            macd_line={macd_line}
            signal_line={signal_line}
            histogram={histogram}
          />
        </div>

        {/* ── Bollinger ── */}
        <div className="sm:pl-6">
          <SectionTitle>Bollinger Bands (20)</SectionTitle>
          <BollingerDisplay
            upper={bb.upper}
            middle={bb.middle}
            lower={bb.lower}
            price={data?.price}
          />
        </div>
      </div>
    </section>
  )
}
