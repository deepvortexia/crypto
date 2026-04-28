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

// ── Semicircle gauge ──────────────────────────────────────────────────────────
// viewBox 300×170; pivot at cx=150, cy=140 (center-bottom of the arc)
function GaugeArc({ value }) {
  const cx = 150, cy = 140, r = 118
  const v  = Math.max(0, Math.min(100, value ?? 0))
  const zone = zoneOf(v)

  // Arc endpoint for the active (filled) portion
  const arcAngle = Math.PI * (1 - v / 100)
  const ex = cx + r * Math.cos(arcAngle)
  const ey = cy - r * Math.sin(arcAngle)

  const activeArcD = v === 0
    ? null
    : v === 100
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`
      : `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${ex.toFixed(3)} ${ey.toFixed(3)}`

  // Needle: CSS rotation around pivot (0,0 in translated group = cx,cy in SVG)
  const cssAngle = -90 + (v / 100) * 180
  const nr = r * 0.86

  return (
    <svg
      viewBox="0 0 300 170"
      width="100%"
      style={{ maxWidth: 420 }}
      className="block mx-auto overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sg-grad" x1={cx - r} y1="0" x2={cx + r} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ff3355" />
          <stop offset="45%"  stopColor="#ffd600" />
          <stop offset="100%" stopColor="#FFC200" />
        </linearGradient>
        <filter id="sg-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Gray track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke="#1a1a2e" strokeWidth="16" fill="none" strokeLinecap="round"
      />

      {/* Active gradient arc */}
      {activeArcD && (
        <path
          d={activeArcD}
          stroke="url(#sg-grad)" strokeWidth="16" fill="none" strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 8px ${zone.color}66)`,
            transition: 'all 0.9s cubic-bezier(0.25,0.8,0.25,1)',
          }}
        />
      )}

      {/* Needle — CSS rotate around pivot so mobile browsers animate correctly */}
      <g transform={`translate(${cx} ${cy})`}>
        <line
          x1="0" y1="0" x2="0" y2={-nr}
          stroke="rgba(255,255,255,0.92)" strokeWidth="3" strokeLinecap="round"
          filter="url(#sg-glow)"
          style={{
            transformOrigin: '0px 0px',
            transform: `rotate(${cssAngle}deg)`,
            transition: 'transform 1s cubic-bezier(0.25,0.8,0.25,1)',
          }}
        />
      </g>

      {/* Pivot dot */}
      <circle cx={cx} cy={cy} r="7"
        fill="#0d0d1a" stroke={zone.color} strokeWidth="2.5"
        style={{ filter: `drop-shadow(0 0 6px ${zone.color})`, transition: 'stroke 0.9s' }}
      />

      {/* Range labels */}
      <text x={cx - r - 4} y={cy + 18} textAnchor="middle" fontSize="11"
        fontFamily="'Share Tech Mono', monospace" fill="#4b5563">0</text>
      <text x={cx + r + 4} y={cy + 18} textAnchor="middle" fontSize="11"
        fontFamily="'Share Tech Mono', monospace" fill="#4b5563">100</text>
    </svg>
  )
}

// ── 14-day history mini-bars ──────────────────────────────────────────────────
function HistoryBars({ history }) {
  if (!Array.isArray(history) || history.length === 0) return null
  const items = history.slice(-14)
  const maxV  = Math.max(...items.map(h => (typeof h === 'object' ? h.value : h) ?? 0))
  return (
    <div className="w-full">
      <p className="font-mono text-[10px] text-gray-600 tracking-widest uppercase mb-1.5 text-center">
        14-day history
      </p>
      <div className="flex items-end gap-0.5 h-8">
        {items.map((h, i) => {
          const v   = (typeof h === 'object' ? h.value : h) ?? 0
          const z   = zoneOf(v)
          const pct = maxV > 0 ? Math.max(12, (v / maxV) * 100) : 50
          return (
            <div key={i} className="flex-1 rounded-sm"
              style={{ height: `${pct}%`, background: z.color, opacity: 0.55 }} />
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
      <div className="w-full h-40 bg-surface-border rounded mb-4" />
      <div className="h-10 w-24 bg-surface-border rounded mx-auto mb-2" />
      <div className="h-3 w-28 bg-surface-border rounded mx-auto" />
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
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">Sentiment unavailable</p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  const value          = Math.max(0, Math.min(100, data?.value ?? 0))
  const zone           = zoneOf(value)
  const classification = data?.classification ?? zone.label

  return (
    <section className="card" aria-labelledby="sentiment-heading">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <h2 id="sentiment-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase">
          Fear &amp; Greed Index
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
        <span className="font-mono text-[10px] text-gray-600 tracking-widest uppercase">Alternative.me</span>
      </div>

      {/* Always-stacked layout: gauge → number → history */}
      <div className="flex flex-col items-center gap-3">
        {/* Gauge — full width, responsive */}
        <GaugeArc value={value} />

        {/* Big glowing number + classification directly below arc */}
        <div className="text-center -mt-4">
          <p
            className={`font-display text-6xl sm:text-7xl font-bold tabular-nums leading-none ${zone.textCls}`}
            style={{ textShadow: `0 0 24px ${zone.color}88, 0 0 48px ${zone.color}44` }}
          >
            {value}
          </p>
          <p className="font-mono text-sm tracking-widest uppercase mt-2" style={{ color: zone.color }}>
            {classification}
          </p>
        </div>

        <HistoryBars history={data?.history} />
      </div>
    </section>
  )
}
