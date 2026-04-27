import { useState, useEffect, useRef, useCallback } from 'react'
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
import { fetchPrediction } from '../api/client'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend)

// ── Palette ──────────────────────────────────────────────────────────────────
const C = {
  cyan:       '#00e5ff',
  cyanFill:   'rgba(0, 229, 255, 0.06)',
  cyanMid:    'rgba(0, 229, 255, 0.0)',
  amber:      '#ffd600',
  amberFill:  'rgba(255, 214, 0, 0.07)',
  grid:       'rgba(26, 26, 46, 0.9)',
  tick:       '#4b5563',
  tooltipBg:  '#0d0d1a',
}

const TIMEFRAMES = [
  { label: '1D', days: 1 },
  { label: '3D', days: 3 },
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
]

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart'

// ── Fetch historical prices from CoinGecko directly ──────────────────────────
async function fetchHistory(days) {
  const interval = days <= 1 ? 'minutely' : 'hourly'
  const url = `${COINGECKO_URL}?vs_currency=usd&days=${days}&interval=${interval}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
  const body = await res.json()
  // [[timestamp_ms, price], ...]
  return body.prices
}

// ── Chart tooltip plugin ──────────────────────────────────────────────────────
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
    title(items) {
      return items[0]?.label ?? ''
    },
    label(item) {
      const v = item.parsed?.y
      if (v == null) return ''
      return `  $${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    },
  },
}

// ── Format a timestamp for x-axis labels ─────────────────────────────────────
function fmtLabel(ms, days) {
  const d = new Date(ms)
  if (days <= 1) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  if (days <= 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Thin tick count for readability ──────────────────────────────────────────
function tickCount(days) {
  if (days <= 1)  return 8
  if (days <= 3)  return 9
  if (days <= 7)  return 7
  return 8
}

// ── Build Chart.js datasets ───────────────────────────────────────────────────
function buildChartData(history, predictions, days) {
  const total = history.length
  // Thin out labels to avoid crowding
  const step  = Math.max(1, Math.floor(total / tickCount(days)))
  const labels = history.map(([ms]) => fmtLabel(ms, days))

  // Thin displayed labels but keep underlying data intact
  const sparseLabels = labels.map((l, i) => (i % step === 0 ? l : ''))

  const histPrices = history.map(([, p]) => p)

  // Prediction overlay: null-pad history length, then append prediction points
  // Only show if we have predictions and the timeframe is appropriate
  let predDataset = null
  if (predictions.length > 0) {
    const now = Date.now()
    // Build a gap from current price to each prediction
    const lastPrice = histPrices[histPrices.length - 1]
    const predLabels = predictions.map(p => {
      const dt = new Date(p.target_time)
      return fmtLabel(dt.getTime(), days)
    })
    const predPrices = predictions.map(p => p.predicted_price)

    // Add null-extended array the same length as history, then add pred points
    const paddedPred = [...histPrices.map(() => null)]
    // The last history point bridges into predictions
    paddedPred[paddedPred.length - 1] = lastPrice

    const combinedLabels = [...sparseLabels, ...predLabels]
    const histFull       = [...histPrices, ...predictions.map(() => null)]
    const predFull       = [...paddedPred, ...predPrices]

    return {
      labels: combinedLabels,
      histFull,
      predFull,
      hasPred: true,
    }
  }

  return {
    labels: sparseLabels,
    histFull: histPrices,
    predFull: null,
    hasPred: false,
  }
}

// ── Legend item ───────────────────────────────────────────────────────────────
function LegendItem({ color, label, dashed }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="20" height="8" viewBox="0 0 20 8" aria-hidden="true">
        {dashed
          ? <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="1.5" strokeDasharray="4 2" />
          : <line x1="0" y1="4" x2="20" y2="4" stroke={color} strokeWidth="2" />
        }
      </svg>
      <span className="font-mono text-[10px] text-gray-500 tracking-widest uppercase">{label}</span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PriceChart() {
  const [tfIdx, setTfIdx]         = useState(1)    // default: 3D
  const [history, setHistory]     = useState([])
  const [predictions, setPreds]   = useState([])
  const [histLoading, setHL]      = useState(true)
  const [predLoading, setPL]      = useState(true)
  const [histError, setHE]        = useState(null)
  const chartRef                  = useRef(null)

  const days = TIMEFRAMES[tfIdx].days

  // Fetch historical data whenever timeframe changes
  useEffect(() => {
    let cancelled = false
    setHL(true)
    setHE(null)
    fetchHistory(days)
      .then(data => { if (!cancelled) { setHistory(data); setHL(false) } })
      .catch(e  => { if (!cancelled) { setHE(e.message); setHL(false) } })
    return () => { cancelled = true }
  }, [days])

  // Fetch predictions once (all horizons that fit the timeframe)
  useEffect(() => {
    let cancelled = false
    setPL(true)
    const horizons = days <= 1 ? ['4h', '8h', '12h', '24h'] :
                     days <= 7 ? ['4h', '8h', '12h', '24h'] :
                     ['4h', '8h', '12h', '24h', '1month']

    Promise.allSettled(horizons.map(h => fetchPrediction(h)))
      .then(results => {
        if (cancelled) return
        const ok = results
          .filter(r => r.status === 'fulfilled' && r.value?.predicted_price)
          .map(r => r.value)
        setPreds(ok)
        setPL(false)
      })
    return () => { cancelled = true }
  }, [days])

  // ── Build chart data ────────────────────────────────────────────────────────
  const { labels, histFull, predFull, hasPred } = history.length > 0
    ? buildChartData(history, predictions, days)
    : { labels: [], histFull: [], predFull: null, hasPred: false }

  const chartData = {
    labels,
    datasets: [
      {
        label: 'BTC/USD',
        data: histFull,
        borderColor: C.cyan,
        borderWidth: 1.5,
        backgroundColor(ctx) {
          const chart = ctx.chart
          const { ctx: c, chartArea } = chart
          if (!chartArea) return C.cyanFill
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
      ...(hasPred ? [{
        label: 'AI Forecast',
        data: predFull,
        borderColor: C.amber,
        borderWidth: 1.5,
        borderDash: [5, 3],
        backgroundColor: C.amberFill,
        fill: false,
        tension: 0.3,
        pointRadius(ctx) {
          const v = ctx.dataset.data[ctx.dataIndex]
          return (v != null && ctx.dataIndex > 0) ? 3 : 0
        },
        pointBackgroundColor: C.amber,
        pointBorderColor: '#000',
        pointBorderWidth: 1,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: C.amber,
      }] : []),
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
        grid:   { color: C.grid, drawTicks: false },
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
        grid:   { color: C.grid, drawTicks: false },
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

  const isLoading = histLoading

  return (
    <section className="card" aria-labelledby="chart-heading">
      {/* ── Header row ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <h2
            id="chart-heading"
            className="font-display text-sm font-bold tracking-widest text-white uppercase"
          >
            Price Chart
          </h2>
          {predLoading && !histLoading && (
            <span className="font-mono text-[10px] text-gray-600 tracking-widest">
              loading forecast…
            </span>
          )}
        </div>

        {/* Timeframe selector */}
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

      {/* ── Chart area ── */}
      <div
        className="relative w-full"
        style={{ height: 'clamp(220px, 35vw, 380px)' }}
      >
        {isLoading && (
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

        {histError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="font-mono text-xs text-neon-red">Chart data unavailable</p>
              <p className="font-mono text-[10px] text-gray-600 mt-1">{histError}</p>
            </div>
          </div>
        )}

        {!isLoading && !histError && (
          <Line ref={chartRef} data={chartData} options={options} />
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-5 mt-3 pt-3 border-t border-surface-border">
        <LegendItem color={C.cyan}  label="Historical" />
        {hasPred && <LegendItem color={C.amber} label="AI Forecast" dashed />}
        <span className="ml-auto font-mono text-[10px] text-gray-600">
          {history.length > 0
            ? `${history.length.toLocaleString()} data points`
            : ''}
        </span>
      </div>
    </section>
  )
}
