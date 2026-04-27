import { useState, useEffect } from 'react'
import { fetchOnchain } from '../api/client'

function fmtHashRate(th) {
  if (th == null) return '—'
  if (th >= 1e9)  return `${(th / 1e9).toFixed(2)} EH/s`
  if (th >= 1e6)  return `${(th / 1e6).toFixed(2)} PH/s`
  if (th >= 1e3)  return `${(th / 1e3).toFixed(2)} TH/s`
  return `${Number(th).toFixed(2)} GH/s`
}

function fmtBig(n, prefix = '$') {
  if (n == null) return '—'
  if (n >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `${prefix}${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `${prefix}${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3)  return `${prefix}${(n / 1e3).toFixed(1)}K`
  return `${prefix}${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtNum(n, dec = 0) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: dec })
}

// ── Single metric row ─────────────────────────────────────────────────────────
function MetricRow({ label, value, sub, color }) {
  return (
    <div className="flex items-center justify-between min-h-[44px] py-1 border-b border-surface-border last:border-0">
      <span className="stat-label pr-2">{label}</span>
      <div className="text-right shrink-0">
        <p className={`font-mono text-sm tabular-nums leading-tight ${color ?? 'text-white'}`}>
          {value}
        </p>
        {sub && (
          <p className="font-mono text-[10px] text-gray-600 leading-tight">{sub}</p>
        )}
      </div>
    </div>
  )
}

// ── Card with a title + metric rows ──────────────────────────────────────────
function MetricCard({ title, metrics }) {
  return (
    <div className="card">
      <p className="font-mono text-[10px] tracking-widest text-gray-500 uppercase mb-1 pb-2 border-b border-surface-border">
        {title}
      </p>
      {metrics.map(m => <MetricRow key={m.label} {...m} />)}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="card space-y-3">
            <div className="h-3 w-20 bg-surface-border rounded" />
            {[0, 1, 2].map(j => (
              <div key={j} className="flex justify-between items-center min-h-[44px]">
                <div className="h-2.5 w-24 bg-surface-border rounded" />
                <div className="h-2.5 w-16 bg-surface-border rounded" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnchainPanel() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchOnchain()
      .then(d  => { if (!cancelled) { setData(d);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  if (loading) return <Skeleton />

  if (error) {
    return (
      <div className="card border-glow-red py-6 text-center">
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">
          On-chain data unavailable
        </p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  const memHigh = data?.mempool_size != null && data.mempool_size > 50_000

  const networkMetrics = [
    {
      label: 'Hash Rate',
      value: fmtHashRate(data?.hash_rate_th),
      sub:   'Network security',
      color: 'text-neon-cyan',
    },
    {
      label: 'Difficulty',
      value: data?.difficulty != null
        ? `${(Number(data.difficulty) / 1e12).toFixed(2)}T`
        : '—',
      sub:   'Mining difficulty',
      color: 'text-white',
    },
    {
      label: 'Block Time',
      value: data?.minutes_between_blocks != null
        ? `${Number(data.minutes_between_blocks).toFixed(1)} min`
        : '—',
      sub:   'Target: 10.0 min',
      color: 'text-white',
    },
  ]

  const activityMetrics = [
    {
      label: 'Blocks Today',
      value: fmtNum(data?.blocks_mined_today),
      sub:   'Target: 144/day',
      color: 'text-white',
    },
    {
      label: 'Mempool',
      value: data?.mempool_size != null
        ? `${fmtNum(data.mempool_size)} tx`
        : '—',
      sub:   'Unconfirmed txns',
      color: memHigh ? 'text-neon-red' : 'text-white',
    },
    {
      label: 'Total Fees',
      value: data?.total_fees_btc != null
        ? `${Number(data.total_fees_btc).toFixed(4)} ₿`
        : '—',
      sub:   '24h fees paid',
      color: 'text-neon-gold',
    },
  ]

  // Build flows metrics, only include fields the backend actually returned
  const flowsRaw = [
    {
      label: 'Trade Volume',
      value: fmtBig(data?.trade_volume_usd, '$'),
      sub:   '24h on-chain',
      color: 'text-neon-cyan',
      show:  data?.trade_volume_usd != null,
    },
    {
      label: 'Active Addresses',
      value: fmtNum(data?.active_addresses),
      sub:   'Unique wallets',
      color: 'text-white',
      show:  data?.active_addresses != null,
    },
    {
      label: 'Exchange Inflow',
      value: fmtBig(data?.exchange_inflow, '$'),
      sub:   '24h inflow',
      color: data?.exchange_inflow > (data?.exchange_outflow ?? 0) ? 'text-neon-red' : 'text-neon-green',
      show:  data?.exchange_inflow != null,
    },
    {
      label: 'Exchange Outflow',
      value: fmtBig(data?.exchange_outflow, '$'),
      sub:   '24h outflow',
      color: 'text-white',
      show:  data?.exchange_outflow != null,
    },
  ]
  const flowMetrics = flowsRaw.filter(m => m.show)

  // Pad flows card if too few entries
  while (flowMetrics.length < 3) {
    flowMetrics.push({ label: '—', value: '—', color: 'text-gray-600' })
  }

  return (
    <section aria-labelledby="onchain-heading">
      <div className="flex items-center gap-3 mb-5">
        <h2
          id="onchain-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase"
        >
          On-Chain Metrics
        </h2>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, #1a1a2e, transparent)' }} />
        <span className="font-mono text-[10px] text-gray-600 tracking-widest uppercase">
          Blockchain.com
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Network"  metrics={networkMetrics}  />
        <MetricCard title="Activity" metrics={activityMetrics} />
        <MetricCard title="Flows"    metrics={flowMetrics}     />
      </div>
    </section>
  )
}
