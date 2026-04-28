import { useState, useEffect } from 'react'
import { fetchSentiment } from '../api/client'

const ZONES = [
  { min: 0,  max: 25,  label: 'Extreme Fear',  color: '#ff3355', textCls: 'text-neon-red'   },
  { min: 25, max: 45,  label: 'Fear',           color: '#ff7043', textCls: 'text-orange-400' },
  { min: 45, max: 55,  label: 'Neutral',        color: '#ffd600', textCls: 'text-neon-gold'  },
  { min: 55, max: 75,  label: 'Greed',          color: '#69f080', textCls: 'text-green-400'  },
  { min: 75, max: 101, label: 'Extreme Greed',  color: '#FFC200', textCls: 'text-neon-green' },
]

function zoneOf(v) {
  return ZONES.find(z => v >= z.min && v < z.max) ?? ZONES[ZONES.length - 1]
}

// ── Redesigned semicircle gauge ───────────────────────────────────────────────
function GaugeArc({ value }) {
  const cx = 110, cy = 104, r = 82
  const v  = Math.max(0, Math.min(100, value ?? 0))
  const zone = zoneOf(v)

  // Map value → angle on the semicircle
  // v=0 → angle=π (left), v=100 → angle=0 (right)
  const angle = Math.PI * (1 - v / 100)
  const ex = cx + r * Math.cos(angle)
  const ey = cy - r * Math.sin(angle)

  // Needle tip sits at 88% of radius
  const nr = r * 0.88
  const nx = cx + nr * Math.cos(angle)
  const ny = cy - nr * Math.sin(angle)

  // Active arc spans from left endpoint to current value point
  // largeArc = 1 only when v > 50 (arc > 90°, but ≤ 180° total so always 0 for SVG)
  // Since total arc is exactly 180°, the swept sub-arc is always ≤ 180°, so largeArc = 0
  const activeArcD = v === 0
    ? null
    : v === 100
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
      : `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`

  return (
    <svg
      width="220" height="120"
      viewBox="0 0 220 120"
      className="block mx-auto overflow-visible"
      aria-hidden="true"
    >
      <defs>
        {/* Left-to-right gradient: red → amber → green */}
        <linearGradient id="gauge-grad" x1={cx - r} y1="0" x2={cx + r} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ff3355" />
          <stop offset="45%"  stopColor="#ffd600" />
          <stop offset="100%" stopColor="#FFC200" />
        </linearGradient>
        <filter id="needle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Gray track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="#1a1a2e"
        strokeWidth="14"
        fill="none"
        strokeLinecap="round"
      />

      {/* Gradient active arc */}
      {activeArcD && (
        <path
          d={activeArcD}
          stroke="url(#gauge-grad)"
          strokeWidth="14"
          fill="none"
          strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 8px ${zone.color}66)`,
            transition: 'all 0.9s cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
        />
      )}

      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={nx.toFixed(3)} y2={ny.toFixed(3)}
        stroke="rgba(255,255,255,0.92)"
        strokeWidth="2.5"
        strokeLinecap="round"
        filter="url(#needle-glow)"
        style={{ transition: 'x2 0.9s cubic-bezier(0.25,0.8,0.25,1), y2 0.9s cubic-bezier(0.25,0.8,0.25,1)' }}
      />
      {/* Needle pivot */}
      <circle cx={cx} cy={cy} r="5.5"
        fill="#0d0d1a"
        stroke={zone.color}
        strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 5px ${zone.color})`, transition: 'stroke 0.9s' }}
      />

      {/* Endpoint labels */}
      <text x={cx - r - 2} y={cy + 16} textAnchor="middle" fontSize="9"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">0</text>
      <text x={cx + r + 2} y={cy + 16} textAnchor="middle" fontSize="9"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">100</text>
    </svg>
  )
}

// ── 14-day history mini-bars ──────────────────────────────────────────────────
function HistoryBars({ history }) {
  if (!Array.isArray(history) || history.length === 0) return null
  const items = history.slice(-14)
  const maxV = Math.max(...items.map(h => (typeof h === 'object' ? h.value : h) ?? 0))

  return (
    <div>
      <p className="font-mono text-[10px] text-gray-600 tracking-widest uppercase mb-1.5">
        14-day history
      </p>
      <div className="flex items-end gap-0.5 h-8">
        {items.map((h, i) => {
          const v = (typeof h === 'object' ? h.value : h) ?? 0
          const z = zoneOf(v)
          const pct = maxV > 0 ? Math.max(12, (v / maxV) * 100) : 50
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{ height: `${pct}%`, background: z.color, opacity: 0.55 }}
            />
          )
        })}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="card animate-pulse">
      <div className="h-4 w-44 bg-surface-border rounded mb-5" />
      <div className="flex flex-col sm:flex-row gap-6 items-center">
        <div className="w-56 h-28 bg-surface-border rounded shrink-0" />
        <div className="flex-1 w-full space-y-3">
          <div className="h-12 w-20 bg-surface-border rounded" />
          <div className="h-3 w-28 bg-surface-border rounded" />
          <div className="h-8 bg-surface-border rounded" />
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SentimentGauge() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchSentiment()
      .then(d  => { if (!cancelled) { setData(d);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="card border-glow-red py-6 text-center">
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">
          Sentiment unavailable
        </p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  const value = Math.max(0, Math.min(100, data?.value ?? 0))
  const zone  = zoneOf(value)
  const classification = data?.classification ?? zone.label

  return (
    <section className="card" aria-labelledby="sentiment-heading">
      <div className="flex items-center gap-3 mb-5">
        <h2
          id="sentiment-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase"
        >
          Fear &amp; Greed Index
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
        <span className="font-mono text-[10px] text-gray-600 tracking-widest uppercase">
          Alternative.me
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
        {/* Gauge */}
        <div className="shrink-0 w-full sm:w-auto">
          <GaugeArc value={value} />
        </div>

        {/* Info panel */}
        <div className="flex-1 w-full text-center sm:text-left">
          {/* Big glowing number */}
          <p
            className={`font-display text-6xl sm:text-7xl font-bold tabular-nums leading-none mb-1 ${zone.textCls}`}
            style={{ textShadow: `0 0 24px ${zone.color}88, 0 0 48px ${zone.color}44` }}
          >
            {value}
          </p>

          {/* Classification */}
          <p
            className="font-mono text-sm tracking-widest uppercase mb-5"
            style={{ color: zone.color }}
          >
            {classification}
          </p>

          <HistoryBars history={data?.history} />
        </div>
      </div>
    </section>
  )
}
