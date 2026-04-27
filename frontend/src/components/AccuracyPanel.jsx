import { useState, useEffect } from 'react'
import { fetchAccuracy } from '../api/client'

const HORIZONS = ['4h', '8h', '12h', '24h', '1month']
const H_LABEL  = { '4h': '4H', '8h': '8H', '12h': '12H', '24h': '24H', '1month': '1M' }

// API values: direction_accuracy is 0–1 (fraction), mape is a percentage value
function fmtAcc(v) {
  if (v == null) return '—'
  return `${(Number(v) * 100).toFixed(1)}%`
}

function fmtMape(v) {
  if (v == null) return '—'
  return `${Number(v).toFixed(2)}%`
}

function accColor(v) {
  if (v == null) return '#4b5563'
  if (v >= 0.70) return '#00ff88'
  if (v >= 0.55) return '#ffd600'
  return '#ff3355'
}

// ── Mini horizontal bar ───────────────────────────────────────────────────────
function AccBar({ value, color }) {
  const w = Math.max(0, Math.min(100, (value ?? 0) * 100))
  return (
    <div className="h-1 w-full bg-surface-border rounded-full overflow-hidden mt-1.5">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${w}%`, background: color, boxShadow: `0 0 4px ${color}66` }}
      />
    </div>
  )
}

// ── Per-horizon card ──────────────────────────────────────────────────────────
function HorizonCard({ horizon, stat }) {
  const acc = stat?.direction_accuracy ?? null
  const color = accColor(acc)

  return (
    <div className="card text-center min-h-[44px]">
      <p className="font-display text-xs font-bold tracking-widest text-neon-cyan mb-3">
        {H_LABEL[horizon]}
      </p>

      {stat == null ? (
        <p className="font-mono text-xs text-gray-600 py-4">No data</p>
      ) : (
        <>
          {/* Direction accuracy */}
          <div className="mb-3">
            <p className="font-mono text-xl tabular-nums leading-none" style={{ color }}>
              {fmtAcc(acc)}
            </p>
            <p className="stat-label mt-1">Direction</p>
            <AccBar value={acc} color={color} />
          </div>

          {/* MAPE */}
          <div className="pt-2.5 border-t border-surface-border">
            <p className="font-mono text-sm tabular-nums text-gray-400 leading-none">
              {fmtMape(stat.mape)}
            </p>
            <p className="stat-label mt-1">MAPE</p>
          </div>

          {/* Sample count */}
          {stat.count != null && (
            <p className="font-mono text-[10px] text-gray-600 mt-2">n={stat.count}</p>
          )}
        </>
      )}
    </div>
  )
}

// ── Ensemble weight bars ──────────────────────────────────────────────────────
const MODEL_COLORS = { lstm: '#00e5ff', xgboost: '#ffd600', prophet: '#00ff88' }
const MODEL_SHORT  = { lstm: 'LSTM', xgboost: 'XGB', prophet: 'PRO' }

function WeightBars({ weights }) {
  const entries = Object.entries(weights)
  if (entries.length === 0) return null
  return (
    <div className="space-y-2">
      {entries.map(([model, w]) => {
        const wPct = Math.round((w ?? 0) * 100)
        const color = MODEL_COLORS[model] ?? '#9ca3af'
        return (
          <div key={model} className="flex items-center gap-2 min-h-[44px]">
            <span
              className="font-mono text-[10px] tracking-widest w-10 shrink-0"
              style={{ color }}
            >
              {MODEL_SHORT[model] ?? model.toUpperCase()}
            </span>
            <div className="flex-1 h-1.5 bg-surface-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${wPct}%`, background: color, boxShadow: `0 0 4px ${color}66` }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-gray-400 w-8 text-right shrink-0">
              {wPct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-4 w-40 bg-surface-border rounded" />
        <div className="flex-1 h-px bg-surface-border" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="card h-20 bg-surface-border rounded" />
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card space-y-2">
            <div className="h-3 w-8 bg-surface-border rounded mx-auto" />
            <div className="h-7 w-14 bg-surface-border rounded mx-auto" />
            <div className="h-1 bg-surface-border rounded-full" />
            <div className="h-4 w-10 bg-surface-border rounded mx-auto mt-2" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AccuracyPanel() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchAccuracy()
      .then(d  => { if (!cancelled) { setData(d);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="card border-glow-red py-6 text-center">
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">
          Accuracy data unavailable
        </p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  const byHorizon   = data?.by_horizon       ?? {}
  const overallAcc  = data?.overall_direction_accuracy ?? null
  const overallMape = data?.overall_mape      ?? null
  const total       = data?.total_predictions ?? null
  const weights     = data?.current_weights   ?? {}
  const hasWeights  = Object.keys(weights).length > 0

  const oColor = accColor(overallAcc)

  return (
    <section aria-labelledby="accuracy-heading">
      <div className="flex items-center gap-3 mb-5">
        <h2
          id="accuracy-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase"
        >
          Model Accuracy
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
        {total != null && (
          <span className="font-mono text-[10px] text-gray-600 tracking-widest">
            {total.toLocaleString()} predictions
          </span>
        )}
      </div>

      {/* Overall + weights row */}
      <div className={`grid gap-3 mb-5 ${hasWeights ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
        <div className="card text-center">
          <p className="stat-label mb-2">Overall Accuracy</p>
          <p className="font-mono text-2xl tabular-nums" style={{ color: oColor }}>
            {fmtAcc(overallAcc)}
          </p>
          <AccBar value={overallAcc} color={oColor} />
        </div>

        <div className="card text-center">
          <p className="stat-label mb-2">Overall MAPE</p>
          <p className="font-mono text-2xl tabular-nums text-white">
            {fmtMape(overallMape)}
          </p>
        </div>

        {hasWeights && (
          <div className="card col-span-2 sm:col-span-2">
            <p className="stat-label mb-3">Ensemble Weights</p>
            <WeightBars weights={weights} />
          </div>
        )}
      </div>

      {/* Per-horizon cards: 2-col on mobile, 5-col on xl */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {HORIZONS.map(h => (
          <HorizonCard key={h} horizon={h} stat={byHorizon[h] ?? null} />
        ))}
      </div>
    </section>
  )
}
