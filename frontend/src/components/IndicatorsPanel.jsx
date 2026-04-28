import { useState, useEffect } from 'react'
import { fetchIndicators } from '../api/client'

function fmt(n, dec = 2) {
  return n == null ? '—' : Number(n).toFixed(dec)
}

function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// ── RSI semi-circle gauge ─────────────────────────────────────────────────────
// Value text is rendered outside the SVG for prominence and scalability
function RsiGauge({ value }) {
  const cx = 100, cy = 90, r = 76
  const v   = Math.max(0, Math.min(100, value ?? 0))
  const pct = v / 100

  const color =
    v < 30 ? '#FFC200' :
    v > 70 ? '#ff3355' :
    '#FFD700'

  // Arc endpoint (sweep-flag=0: draws upward semicircle)
  const angle = Math.PI * (1 - pct)
  const ex = (cx + r * Math.cos(angle)).toFixed(3)
  const ey = (cy - r * Math.sin(angle)).toFixed(3)

  // Zone ticks at 30 and 70
  const ticks = [0.3, 0.7].map(z => {
    const a = Math.PI * (1 - z)
    return {
      x1: (cx + (r - 9) * Math.cos(a)).toFixed(2),
      y1: (cy - (r - 9) * Math.sin(a)).toFixed(2),
      x2: (cx + (r + 9) * Math.cos(a)).toFixed(2),
      y2: (cy - (r + 9) * Math.sin(a)).toFixed(2),
    }
  })

  return (
    <svg viewBox="0 0 200 105" width="100%" style={{ maxWidth: 200 }}
      className="mx-auto block overflow-visible">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`}
        stroke="#1a1a2e" strokeWidth="10" fill="none" strokeLinecap="round"
      />
      {/* Zone ticks */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#2d2d4a" strokeWidth="2" />
      ))}
      {/* Fill arc */}
      {v > 0 && (
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${ex} ${ey}`}
          stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}66)`, transition: 'all 0.7s ease' }}
        />
      )}
      {/* Tip dot */}
      {v > 0 && (
        <circle cx={ex} cy={ey} r="5"
          fill={color} stroke="#0d0d1a" strokeWidth="2"
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      )}
      {/* Range labels */}
      <text x={cx - r - 5} y={cy + 16} textAnchor="middle" fontSize="9"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">0</text>
      <text x={cx + r + 5} y={cy + 16} textAnchor="middle" fontSize="9"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">100</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="8"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">50</text>
    </svg>
  )
}

function rsiStatus(v) {
  if (v == null) return { label: '—',               cls: 'badge-neutral' }
  if (v <= 20)   return { label: 'Deep Oversold',   cls: 'badge-up'      }
  if (v < 30)    return { label: 'Oversold',         cls: 'badge-up'      }
  if (v >= 80)   return { label: 'Deep Overbought', cls: 'badge-down'    }
  if (v > 70)    return { label: 'Overbought',       cls: 'badge-down'    }
  return               { label: 'Neutral',           cls: 'badge-neutral' }
}

// ── MACD display ──────────────────────────────────────────────────────────────
function MacdDisplay({ macd_line, signal_line, histogram }) {
  const h      = histogram ?? 0
  const isPos  = h >= 0
  const color  = isPos ? '#FFC200' : '#ff3355'
  const barW   = Math.min(100,
    macd_line != null && macd_line !== 0
      ? Math.abs(h / (Math.abs(macd_line) + 0.0001)) * 100
      : 50
  )

  return (
    <div className="space-y-4">
      {/* 3-value grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="stat-label mb-1">MACD</p>
          <p className={`font-mono text-lg tabular-nums font-semibold ${isPos ? 'text-neon-green' : 'text-neon-red'}`}>
            {fmt(macd_line)}
          </p>
        </div>
        <div>
          <p className="stat-label mb-1">Signal</p>
          <p className="font-mono text-lg tabular-nums text-gray-300">{fmt(signal_line)}</p>
        </div>
        <div>
          <p className="stat-label mb-1">Histogram</p>
          <p className="font-mono text-lg tabular-nums" style={{ color }}>
            {h >= 0 ? '+' : ''}{fmt(h)}
          </p>
        </div>
      </div>

      {/* Histogram bar */}
      <div>
        <div className="h-2 w-full bg-surface-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${barW}%`, background: color, boxShadow: `0 0 6px ${color}88` }}
          />
        </div>
        <p className="font-mono text-[11px] mt-2 text-center" style={{ color }}>
          {isPos ? '▲ Bullish momentum' : '▼ Bearish pressure'}
        </p>
      </div>
    </div>
  )
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
function BollingerDisplay({ upper, middle, lower, price }) {
  const u = upper ?? 0, m = middle ?? 0, l = lower ?? 0, p = price ?? m
  const range    = u - l
  const pricePct = range > 0 ? Math.max(2, Math.min(98, ((p - l) / range) * 100)) : 50
  const midPct   = range > 0 ? Math.max(0, Math.min(100, ((m - l) / range) * 100)) : 50

  const posColor =
    pricePct > 80 ? '#ff3355' :
    pricePct < 20 ? '#FFC200' :
    '#FFD700'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="stat-label">Upper Band</span>
        <span className="font-mono text-base tabular-nums text-gray-300">{fmtPrice(upper)}</span>
      </div>

      {/* Position bar */}
      <div className="relative h-3 bg-surface-border rounded-full">
        <div className="absolute top-0 bottom-0 w-px bg-gray-600" style={{ left: `${midPct}%` }} />
        <div
          className="absolute top-1/2 w-3.5 h-3.5 rounded-full border-2 border-surface-card transition-all duration-700"
          style={{
            left: `${pricePct}%`,
            transform: 'translate(-50%, -50%)',
            background: posColor,
            boxShadow: `0 0 8px ${posColor}`,
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="stat-label">Middle (SMA)</span>
        <span className="font-mono text-base tabular-nums text-white">{fmtPrice(middle)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="stat-label">Lower Band</span>
        <span className="font-mono text-base tabular-nums text-gray-300">{fmtPrice(lower)}</span>
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-surface-border">
        <span className="stat-label">Band Position</span>
        <span className="font-mono text-xl tabular-nums font-semibold" style={{ color: posColor }}>
          {range > 0 ? `${pricePct.toFixed(0)}%` : '—'}
        </span>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <p className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-4 pb-2 border-b border-surface-border">
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
            <div className="h-24 bg-surface-border rounded" />
            <div className="h-8 w-16 bg-surface-border rounded mx-auto" />
            <div className="h-3 w-24 bg-surface-border rounded" />
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
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">Indicators unavailable</p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  const rawMacd     = data?.macd
  const macd_line   = typeof rawMacd === 'object'
    ? (rawMacd?.macd_line ?? rawMacd?.macd ?? rawMacd?.value ?? null)
    : (rawMacd != null ? Number(rawMacd) : null)
  const signal_line = typeof rawMacd === 'object' ? (rawMacd?.signal_line ?? rawMacd?.signal ?? null) : null
  const histogram   = typeof rawMacd === 'object' ? (rawMacd?.histogram ?? null) : null

  const bb  = data?.bollinger_bands ?? {}
  const rsi = data?.rsi
  const rsiColor = rsi == null ? '#FFD700' : rsi < 30 ? '#FFC200' : rsi > 70 ? '#ff3355' : '#FFD700'
  const { label: rsiLabel, cls: rsiCls } = rsiStatus(rsi)

  return (
    <section className="card" aria-labelledby="indicators-heading">
      <div className="flex items-center gap-3 mb-5">
        <h2 id="indicators-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase">
          Technical Indicators
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
      </div>

      {/* Stack on mobile, 3-col on sm+ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 divide-y divide-surface-border sm:divide-y-0 sm:divide-x sm:divide-surface-border">

        {/* ── RSI ── */}
        <div className="pb-6 sm:pb-0 sm:pr-6">
          <SectionTitle>RSI (14)</SectionTitle>
          <RsiGauge value={rsi} />
          {/* Large value below gauge */}
          <div className="text-center mt-2">
            <p className="font-mono text-4xl tabular-nums font-bold" style={{ color: rsiColor }}>
              {rsi != null ? Math.round(rsi) : '—'}
            </p>
            <p className="stat-label mt-1">Relative Strength</p>
          </div>
          <div className="flex justify-center mt-3">
            <span className={rsiCls}>{rsiLabel}</span>
          </div>
        </div>

        {/* ── MACD ── */}
        <div className="py-6 sm:py-0 sm:px-6">
          <SectionTitle>MACD (12, 26, 9)</SectionTitle>
          <MacdDisplay
            macd_line={macd_line}
            signal_line={signal_line}
            histogram={histogram}
          />
        </div>

        {/* ── Bollinger ── */}
        <div className="pt-6 sm:pt-0 sm:pl-6">
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
