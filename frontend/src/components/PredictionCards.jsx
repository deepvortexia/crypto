import { useState, useEffect, useCallback } from 'react'
import { fetchPrediction } from '../api/client'

const HORIZONS = [
  { key: '4h',     label: '4 Hours',  short: '4H' },
  { key: '8h',     label: '8 Hours',  short: '8H' },
  { key: '12h',    label: '12 Hours', short: '12H' },
  { key: '24h',    label: '24 Hours', short: '24H' },
  { key: '1month', label: '1 Month',  short: '1M' },
]

const RETRY_MS = 30_000

function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 11V3M7 3L3 7M7 3L11 7" stroke="#00ff88" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 3V11M7 11L3 7M7 11L11 7" stroke="#ff3355" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ConfidenceBar({ value }) {
  // value: 0–1
  const pct = Math.round((value ?? 0) * 100)
  const color =
    pct >= 70 ? '#00ff88' :
    pct >= 40 ? '#ffd600' :
    '#ff3355'

  return (
    <div className="mt-3">
      <div className="flex justify-between items-center mb-1">
        <span className="font-mono text-[10px] tracking-widest text-gray-500 uppercase">Confidence</span>
        <span className="font-mono text-xs tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1 w-full bg-surface-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
        />
      </div>
    </div>
  )
}

function ModelDots({ predictions }) {
  if (!predictions) return null
  const models = [
    { key: 'lstm',    label: 'LSTM' },
    { key: 'xgboost', label: 'XGB' },
    { key: 'prophet', label: 'PRO' },
  ]
  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-surface-border">
      {models.map(({ key, label }) => {
        const val = predictions[key]
        return (
          <div key={key} className="flex-1 text-center">
            <p className="font-mono text-[9px] text-gray-600 tracking-widest uppercase mb-0.5">{label}</p>
            <p className="font-mono text-[10px] text-gray-400 tabular-nums leading-none">
              {val != null ? '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
            </p>
          </div>
        )
      })}
    </div>
  )
}

// ── Training state placeholder ──────────────────────────────────────────────
function TrainingCard({ label, short }) {
  return (
    <div className="card flex flex-col items-center justify-center py-8 text-center min-h-[200px]">
      <span className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-4">
        {label}
      </span>
      <div className="relative w-10 h-10 mb-3">
        <svg viewBox="0 0 40 40" className="w-full h-full animate-spin" style={{ animationDuration: '2s' }}>
          <circle cx="20" cy="20" r="16" stroke="#1a1a2e" strokeWidth="3" fill="none" />
          <circle
            cx="20" cy="20" r="16"
            stroke="#00e5ff"
            strokeWidth="3"
            fill="none"
            strokeDasharray="30 70"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <p className="font-mono text-xs text-neon-cyan tracking-widest">AI TRAINING</p>
      <p className="font-mono text-[10px] text-gray-600 mt-1">Retry in 30s…</p>
    </div>
  )
}

// ── Single prediction card ──────────────────────────────────────────────────
function PredCard({ horizon }) {
  const [state, setState] = useState('idle')   // idle | loading | training | ready | error
  const [data, setData] = useState(null)
  const [errMsg, setErrMsg] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    try {
      const d = await fetchPrediction(horizon.key)
      setData(d)
      setState('ready')
    } catch (err) {
      if (err.status === 503) {
        setState('training')
      } else {
        setErrMsg(err.message ?? 'Unknown error')
        setState('error')
      }
    }
  }, [horizon.key])

  useEffect(() => {
    load()
  }, [load])

  // Auto-retry if training
  useEffect(() => {
    if (state !== 'training') return
    const t = setTimeout(load, RETRY_MS)
    return () => clearTimeout(t)
  }, [state, load])

  if (state === 'idle' || state === 'loading') {
    return (
      <div className="card animate-pulse min-h-[200px]">
        <div className="h-3 w-10 bg-surface-border rounded mb-3" />
        <div className="h-7 w-28 bg-surface-border rounded mb-2" />
        <div className="h-5 w-16 bg-surface-border rounded mb-4" />
        <div className="h-1 w-full bg-surface-border rounded-full" />
      </div>
    )
  }

  if (state === 'training') {
    return <TrainingCard label={horizon.label} short={horizon.short} />
  }

  if (state === 'error') {
    return (
      <div className="card border-glow-red min-h-[200px] flex flex-col items-center justify-center text-center">
        <span className="font-mono text-[10px] text-gray-500 tracking-widest uppercase mb-2">
          {horizon.label}
        </span>
        <span className="font-mono text-xs text-neon-red">Error</span>
        <span className="font-mono text-[10px] text-gray-600 mt-1 break-all">{errMsg}</span>
        <button
          onClick={load}
          className="mt-3 font-mono text-[10px] text-neon-cyan tracking-widest hover:text-glow-cyan transition-colors uppercase"
        >
          Retry
        </button>
      </div>
    )
  }

  // ready
  const isUp = data.direction === 'up'
  const changePct = data.change_pct ?? 0
  const borderClass = isUp ? 'border-glow-green' : 'border-glow-red'
  const priceColor  = isUp ? 'text-neon-green text-glow-green' : 'text-neon-red text-glow-red'

  return (
    <div className={`card ${borderClass} transition-all duration-300`}>
      {/* Horizon label */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] tracking-widest text-gray-500 uppercase">
          {horizon.label}
        </span>
        <span
          className="font-display text-xs font-bold tracking-widest"
          style={{ color: isUp ? '#00ff88' : '#ff3355' }}
        >
          {horizon.short}
        </span>
      </div>

      {/* Predicted price */}
      <p className={`font-mono text-xl sm:text-2xl tabular-nums leading-none mb-2 ${priceColor}`}>
        {fmtPrice(data.predicted_price)}
      </p>

      {/* Direction + % change */}
      <div className="flex items-center gap-1.5 mb-0.5">
        {isUp ? <ArrowUp /> : <ArrowDown />}
        <span className={`font-mono text-sm tabular-nums ${isUp ? 'text-neon-green' : 'text-neon-red'}`}>
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
        </span>
        <span className={isUp ? 'badge-up ml-auto' : 'badge-down ml-auto'}>
          {isUp ? 'UP' : 'DOWN'}
        </span>
      </div>

      {/* Current price reference */}
      <p className="font-mono text-[10px] text-gray-600 tabular-nums">
        from {fmtPrice(data.current_price)}
      </p>

      {/* Confidence bar */}
      <ConfidenceBar value={data.confidence} />

      {/* Per-model breakdown */}
      <ModelDots predictions={data.model_predictions} />
    </div>
  )
}

// ── Section ─────────────────────────────────────────────────────────────────
export default function PredictionCards() {
  return (
    <section aria-labelledby="predictions-heading">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <h2
          id="predictions-heading"
          className="font-display text-sm sm:text-base font-bold tracking-widest text-white uppercase"
        >
          AI Predictions
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
        <span className="font-mono text-[10px] tracking-widest text-gray-600 uppercase">
          LSTM · XGBoost · Prophet
        </span>
      </div>

      {/* Cards grid: 1 col → 2 col → 3 col → 5 col */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {HORIZONS.map(h => <PredCard key={h.key} horizon={h} />)}
      </div>
    </section>
  )
}
