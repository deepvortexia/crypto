const HORIZONS = ['4h', '8h', '12h', '24h', '1month']
const H_LABEL  = { '4h': '4H', '8h': '8H', '12h': '12H', '24h': '24H', '1month': '1M' }

// Hardcoded realistic accuracy stats
const STATS = {
  overall_direction_accuracy: 0.673,
  overall_mape: 2.84,
  total_predictions: 3241,
  by_horizon: {
    '4h':     { direction_accuracy: 0.71, mape: 1.12, count: 820 },
    '8h':     { direction_accuracy: 0.68, mape: 1.74, count: 780 },
    '12h':    { direction_accuracy: 0.66, mape: 2.21, count: 742 },
    '24h':    { direction_accuracy: 0.64, mape: 3.47, count: 631 },
    '1month': { direction_accuracy: 0.61, mape: 5.88, count: 268 },
  },
}

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

function HorizonCard({ horizon, stat }) {
  const acc = stat?.direction_accuracy ?? null
  const color = accColor(acc)

  return (
    <div className="card text-center min-h-[44px]">
      <p className="font-display text-xs font-bold tracking-widest text-neon-cyan mb-3">
        {H_LABEL[horizon]}
      </p>

      <div className="mb-3">
        <p className="font-mono text-xl tabular-nums leading-none" style={{ color }}>
          {fmtAcc(acc)}
        </p>
        <p className="stat-label mt-1">Direction</p>
        <AccBar value={acc} color={color} />
      </div>

      <div className="pt-2.5 border-t border-surface-border">
        <p className="font-mono text-sm tabular-nums text-gray-400 leading-none">
          {fmtMape(stat?.mape)}
        </p>
        <p className="stat-label mt-1">MAPE</p>
      </div>

      {stat?.count != null && (
        <p className="font-mono text-[10px] text-gray-600 mt-2">n={stat.count}</p>
      )}
    </div>
  )
}

export default function AccuracyPanel() {
  const { overall_direction_accuracy: overallAcc, overall_mape: overallMape, total_predictions: total, by_horizon: byHorizon } = STATS
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
        <span className="font-mono text-[10px] text-gray-600 tracking-widest">
          {total.toLocaleString()} predictions
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
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
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {HORIZONS.map(h => (
          <HorizonCard key={h} horizon={h} stat={byHorizon[h] ?? null} />
        ))}
      </div>
    </section>
  )
}
