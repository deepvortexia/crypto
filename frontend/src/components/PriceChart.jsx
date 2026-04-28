import { useState, useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { fetchPriceHistory } from '../api/client'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

const C = {
  cyan:    '#00e5ff',
  grid:    'rgba(26, 26, 46, 0.9)',
  tick:    '#4b5563',
  tooltipBg: '#0d0d1a',
}

const TIMEFRAMES = [
  { label: '1D', days: 1 },
  { label: '3D', days: 3 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
]

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart'

async function fetchHistory(days) {
  const interval = days <= 1 ? 'minutely' : 'hourly'
  const url = `${COINGECKO_URL}?vs_currency=usd&days=${days}&interval=${interval}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const body = await res.json()
  return body.prices
}

const tooltipPlugin = {
  backgroundColor: C.tooltipBg,
  borderColor: 'rgba(0,229,255,0.4)',
  borderWidth: 1,
  padding: 10,
  titleColor: '#9ca3af',
  titleFont: { family: "'Share Tech Mono', monospace", size: 10 },
  bodyColor: '#ffffff',
  bodyFont: { family: "'Share Tech Mono', monospace", size: 13 },
  callbacks: {
    title(items) { return items[0]?.label ?? '' },
    label(item) {
      const v = item.parsed?.y
      if (v == null) return ''
      return `  $${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    },
  },
}

function fmtLabel(ms, days) {
  const d = new Date(ms)
  if (days <= 1) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (days <= 7) return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', hour12: false })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tickCount(days) {
  if (days <= 1) return 8
  if (days <= 3) return 9
  if (days <= 7) return 7
  return 8
}

export default function PriceChart() {
  const [tfIdx, setTfIdx]     = useState(1)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const chartRef              = useRef(null)

  const days = TIMEFRAMES[tfIdx].days

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchHistory(days)
      .then(data => { if (!cancelled) { setHistory(data); setLoading(false) } })
      .catch(e   => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  }, [days])

  const total = history.length
  const step = Math.max(1, Math.floor(total / tickCount(days)))
  const labels = history.map(([ms], i) => i % step === 0 ? fmtLabel(ms, days) : '')
  const prices = history.map(([, p]) => p)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'BTC/USD',
        data: prices,
        borderColor: C.cyan,
        borderWidth: 1.5,
        backgroundColor(ctx) {
          const { ctx: c, chartArea } = ctx.chart
          if (!chartArea) return 'rgba(0,229,255,0.06)'
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
          grad.addColorStop(0, 'rgba(0,229,255,0.12)')
          grad.addColorStop(1, 'rgba(0,229,255,0)')
          return grad
        },
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: C.cyan,
        pointHoverBorderColor: '#000',
        pointHoverBorderWidth: 1.5,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: tooltipPlugin,
    },
    scales: {
      x: {
        grid:  { color: C.grid, drawTicks: false },
        ticks: {
          color: C.tick,
          font: { family: "'Share Tech Mono', monospace", size: 10 },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 8,
        },
        border: { color: C.grid },
      },
      y: {
        position: 'right',
        grid:  { color: C.grid, drawTicks: false },
        ticks: {
          color: C.tick,
          font: { family: "'Share Tech Mono', monospace", size: 10 },
          callback: v => '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }),
          maxTicksLimit: 6,
        },
        border: { color: C.grid },
      },
    },
  }

  return (
    <section className="card" aria-labelledby="chart-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h2
          id="chart-heading"
          className="font-display text-sm font-bold tracking-widest text-white uppercase"
        >
          Price Chart
        </h2>

        <div className="flex items-center gap-1 bg-surface-muted rounded p-0.5">
          {TIMEFRAMES.map((tf, i) => (
            <button
              key={tf.label}
              onClick={() => setTfIdx(i)}
              className={[
                'font-mono text-xs px-3 py-1.5 rounded transition-all duration-150',
                tfIdx === i
                  ? 'text-neon-cyan border-glow-cyan bg-surface-card'
                  : 'text-gray-500 hover:text-gray-300',
              ].join(' ')}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ height: 'clamp(220px, 35vw, 380px)' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <svg viewBox="0 0 40 40" className="w-8 h-8 animate-spin" style={{ animationDuration: '1.5s' }}>
                <circle cx="20" cy="20" r="16" stroke="#1a1a2e" strokeWidth="3" fill="none" />
                <circle cx="20" cy="20" r="16" stroke="#00e5ff" strokeWidth="3" fill="none"
                  strokeDasharray="28 72" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-xs text-gray-500 tracking-widest">LOADING CHART</span>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="font-mono text-xs text-neon-red">Chart data unavailable</p>
              <p className="font-mono text-[10px] text-gray-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <Line ref={chartRef} data={chartData} options={options} />
        )}
      </div>

      <div className="flex items-center gap-5 mt-3 pt-3 border-t border-surface-border">
        <div className="flex items-center gap-1.5">
          <svg width="20" height="8" viewBox="0 0 20 8" aria-hidden="true">
            <line x1="0" y1="4" x2="20" y2="4" stroke={C.cyan} strokeWidth="2" />
          </svg>
          <span className="font-mono text-[10px] text-gray-500 tracking-widest uppercase">Historical</span>
        </div>
        <span className="ml-auto font-mono text-[10px] text-gray-600">
          {total > 0 ? `${total.toLocaleString()} data points` : ''}
        </span>
      </div>
    </section>
  )
}
