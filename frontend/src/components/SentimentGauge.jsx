import { useState, useEffect } from 'react'
import { fetchSentiment } from '../api/client'

// Zone boundaries and colours
const ZONES = [
  { min: 0,  max: 25,  label: 'Extreme Fear',  color: '#ff3355', textCls: 'text-neon-red'   },
  { min: 25, max: 45,  label: 'Fear',           color: '#ff7043', textCls: 'text-orange-400' },
  { min: 45, max: 55,  label: 'Neutral',        color: '#ffd600', textCls: 'text-neon-gold'  },
  { min: 55, max: 75,  label: 'Greed',          color: '#69f080', textCls: 'text-green-400'  },
  { min: 75, max: 101, label: 'Extreme Greed',  color: '#00ff88', textCls: 'text-neon-green' },
]

function zoneOf(v) {
  return ZONES.find(z => v >= z.min && v < z.max) ?? ZONES[ZONES.length - 1]
}

// Map value 0–100 → point on the top semicircle
// angle = π*(1 - v/100) in standard math (y-up), converted to SVG coords (y-down)
function gaugePoint(cx, cy, r, v) {
  const a = Math.PI * (1 - Math.max(0, Math.min(100, v)) / 100)
  return {
    x: cx + r * Math.cos(a),
    y: cy - r * Math.sin(a),  // minus because SVG y increases downward
  }
}

// ── SVG arc gauge ─────────────────────────────────────────────────────────────
function GaugeArc({ value }) {
  const cx = 120, cy = 106, r = 84
  const v  = Math.max(0, Math.min(100, value ?? 0))

  // Full track
  const trackD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy}`

  // Zone segment arcs (always largeArc=0 — each zone ≤ 45° of the 180° sweep)
  const zoneArcs = ZONES.map(z => {
    const s = gaugePoint(cx, cy, r, z.min)
    const e = gaugePoint(cx, cy, r, Math.min(z.max, 100))
    return { ...z, d: `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 0 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}` }
  })

  // Active fill arc (largeArc always 0 — max sweep is 180°, so short CCW arc is always ≤ 180°)
  const ep = gaugePoint(cx, cy, r, v)
  const fillD = `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${ep.x.toFixed(3)} ${ep.y.toFixed(3)}`

  // Needle
  const np = gaugePoint(cx, cy, r - 16, v)

  const zone = zoneOf(v)

  return (
    <svg width="240" height="124" viewBox="0 0 240 124" className="block overflow-visible">
      {/* Zone colour guides (faint) */}
      {zoneArcs.map(z => (
        <path key={z.label} d={z.d}
          stroke={z.color} strokeWidth="14" fill="none"
          strokeLinecap="butt" opacity="0.12"
        />
      ))}
      {/* Dark track overlay */}
      <path d={trackD} stroke="#080810" strokeWidth="14" fill="none" />
      {/* Zone guides (subtle) */}
      {zoneArcs.map(z => (
        <path key={`f-${z.label}`} d={z.d}
          stroke={z.color} strokeWidth="14" fill="none"
          strokeLinecap="butt" opacity="0.08"
        />
      ))}
      {/* Active fill */}
      {v > 0 && (
        <path d={fillD}
          stroke={zone.color} strokeWidth="14" fill="none" strokeLinecap="round"
          style={{
            filter: `drop-shadow(0 0 7px ${zone.color}99)`,
            transition: 'all 0.9s cubic-bezier(0.25,0.8,0.25,1)',
          }}
        />
      )}
      {/* Zone boundary ticks */}
      {[25, 45, 55, 75].map(pv => {
        const inner = gaugePoint(cx, cy, r - 10, pv)
        const outer = gaugePoint(cx, cy, r + 4, pv)
        return (
          <line key={pv}
            x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
            x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
            stroke="#1a1a2e" strokeWidth="2"
          />
        )
      })}
      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={np.x.toFixed(2)} y2={np.y.toFixed(2)}
        stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round"
        style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.5))', transition: 'all 0.9s cubic-bezier(0.25,0.8,0.25,1)' }}
      />
      <circle cx={cx} cy={cy} r="6"
        fill="#0d0d1a" stroke={zone.color} strokeWidth="2"
        style={{ filter: `drop-shadow(0 0 4px ${zone.color})`, transition: 'stroke 0.9s' }}
      />
      {/* Range labels */}
      <text x={cx - r - 6} y={cy + 14} textAnchor="middle" fontSize="9"
        fontFamily="'Share Tech Mono', monospace" fill="#374151">0</text>
      <text x={cx + r + 6} y={cy + 14} textAnchor="middle" fontSize="9"
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
        <div className="w-60 h-32 bg-surface-border rounded shrink-0" />
        <div className="flex-1 w-full space-y-3">
          <div className="h-10 w-20 bg-surface-border rounded" />
          <div className="h-3 w-28 bg-surface-border rounded" />
          <div className="h-4 bg-surface-border rounded" />
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

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Gauge */}
        <div className="shrink-0">
          <GaugeArc value={value} />
        </div>

        {/* Info panel */}
        <div className="flex-1 w-full text-center sm:text-left">
          {/* Big value */}
          <p
            className={`font-display text-5xl sm:text-6xl font-bold tabular-nums leading-none mb-1 ${zone.textCls}`}
            style={{ textShadow: `0 0 20px ${zone.color}66` }}
          >
            {value}
          </p>
          {/* Classification label */}
          <p
            className="font-mono text-sm tracking-widest uppercase mb-5"
            style={{ color: zone.color }}
          >
            {classification}
          </p>

          {/* Zone legend bar */}
          <div className="flex gap-1 mb-1">
            {ZONES.map(z => (
              <div
                key={z.label}
                className="flex-1 h-1.5 rounded-full transition-all duration-500"
                style={{
                  background: z.color,
                  opacity: zone.label === z.label ? 1 : 0.2,
                  boxShadow: zone.label === z.label ? `0 0 8px ${z.color}` : 'none',
                }}
              />
            ))}
          </div>
          <div className="flex mb-5">
            {ZONES.map(z => (
              <div key={z.label} className="flex-1 text-center">
                <p
                  className="font-mono text-[8px] leading-tight hidden sm:block"
                  style={{ color: zone.label === z.label ? z.color : '#374151' }}
                >
                  {z.label}
                </p>
              </div>
            ))}
          </div>

          <HistoryBars history={data?.history} />
        </div>
      </div>
    </section>
  )
}
