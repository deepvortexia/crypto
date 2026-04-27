import { useState, useEffect } from 'react'
import { fetchLivePrice } from '../api/client'

function fmtPrice(n) {
  if (n == null) return '—'
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtLarge(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtChange(n) {
  if (n == null) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${Number(n).toFixed(2)}%`
}

function SkeletonCard() {
  return (
    <div className="card animate-pulse">
      <div className="h-3 w-20 bg-surface-border rounded mb-3" />
      <div className="h-8 w-32 bg-surface-border rounded mb-2" />
      <div className="h-3 w-16 bg-surface-border rounded" />
    </div>
  )
}

function StatCard({ label, value, sub, subColor, icon, highlight, glowClass }) {
  return (
    <div className={highlight ? 'card-active bracket-cyan' : 'card'}>
      {/* Label row */}
      <div className="flex items-center justify-between mb-3">
        <span className="stat-label">{label}</span>
        {icon && (
          <span className="text-lg select-none" aria-hidden="true">{icon}</span>
        )}
      </div>

      {/* Main value */}
      <p
        className={`font-mono text-2xl sm:text-3xl tabular-nums leading-none mb-2 ${glowClass ?? 'text-white'}`}
      >
        {value}
      </p>

      {/* Sub value */}
      {sub != null && (
        <p className={`font-mono text-xs tabular-nums ${subColor ?? 'text-gray-500'}`}>
          {sub}
        </p>
      )}
    </div>
  )
}

export default function HeroStats({ priceData: externalData }) {
  const [data, setData] = useState(externalData ?? null)
  const [loading, setLoading] = useState(!externalData)
  const [error, setError] = useState(null)

  // Only fetch internally if no external data is injected
  useEffect(() => {
    if (externalData) {
      setData(externalData)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchLivePrice()
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [externalData])

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="card border-glow-red text-center py-6">
        <p className="font-mono text-xs text-neon-red tracking-widest uppercase">
          Failed to load market data
        </p>
        <p className="font-mono text-xs text-gray-600 mt-1">{error}</p>
      </div>
    )
  }

  const change = data?.change_24h_pct ?? null
  const isUp = change != null && change >= 0

  const cards = [
    {
      label:     'BTC Price',
      value:     fmtPrice(data?.price),
      sub:       'Last updated live',
      subColor:  'text-gray-600',
      icon:      '₿',
      highlight: true,
      glowClass: 'text-neon-cyan text-glow-cyan',
    },
    {
      label:     '24h Change',
      value:     fmtChange(change),
      sub:       isUp ? 'Bullish momentum' : 'Bearish momentum',
      subColor:  isUp ? 'text-neon-green' : 'text-neon-red',
      icon:      isUp ? '▲' : '▼',
      highlight: false,
      glowClass: isUp ? 'text-neon-green text-glow-green' : 'text-neon-red text-glow-red',
    },
    {
      label:     'Market Cap',
      value:     fmtLarge(data?.market_cap),
      sub:       'USD market cap',
      subColor:  'text-gray-500',
      icon:      '◈',
      highlight: false,
      glowClass: 'text-white',
    },
    {
      label:     '24h Volume',
      value:     fmtLarge(data?.volume_24h),
      sub:       'Spot + derivatives',
      subColor:  'text-gray-500',
      icon:      '⟳',
      highlight: false,
      glowClass: 'text-white',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => <StatCard key={c.label} {...c} />)}
    </div>
  )
}
