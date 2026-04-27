import { useState, useEffect, useCallback } from 'react'
import { fetchLivePrice } from '../api/client'

const REFRESH_MS = 60_000

function fmt(n) {
  return n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function HexLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <polygon
        points="16,2 28,9 28,23 16,30 4,23 4,9"
        stroke="#00e5ff"
        strokeWidth="1.5"
        fill="rgba(0,229,255,0.06)"
      />
      <polygon
        points="16,8 23,12 23,20 16,24 9,20 9,12"
        fill="rgba(0,229,255,0.12)"
      />
      <text
        x="16" y="20"
        textAnchor="middle"
        fontSize="9"
        fontFamily="Orbitron, sans-serif"
        fontWeight="700"
        fill="#00e5ff"
      >
        DV
      </text>
    </svg>
  )
}

function Countdown({ seconds }) {
  const pct = ((REFRESH_MS / 1000 - seconds) / (REFRESH_MS / 1000)) * 100
  return (
    <div className="hidden sm:flex items-center gap-2 text-gray-600">
      <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
        <circle
          cx="7" cy="7" r="5.5"
          stroke="#00e5ff"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray={`${2 * Math.PI * 5.5}`}
          strokeDashoffset={`${2 * Math.PI * 5.5 * (1 - pct / 100)}`}
          strokeLinecap="round"
          transform="rotate(-90 7 7)"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <span className="font-mono text-xs tabular-nums">{seconds}s</span>
    </div>
  )
}

export default function Header() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000)

  const load = useCallback(async () => {
    try {
      const d = await fetchLivePrice()
      setData(d)
      setError(false)
    } catch {
      setError(true)
    }
    setCountdown(REFRESH_MS / 1000)
  }, [])

  // Initial fetch + 60s interval
  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load])

  // Countdown tick
  useEffect(() => {
    const tick = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => clearInterval(tick)
  }, [])

  const change = data?.change_24h_pct ?? null
  const isUp = change != null && change >= 0

  return (
    <header className="sticky top-0 z-50 w-full"
      style={{
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1a1a2e',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* ── Logo ── */}
        <div className="flex items-center gap-3 shrink-0">
          <HexLogo />
          <div className="flex flex-col leading-none">
            <span
              className="font-display text-base sm:text-lg font-bold tracking-widest text-neon-cyan text-glow-cyan"
              style={{ letterSpacing: '0.12em' }}
            >
              DEEPVORTEX
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-gray-500 uppercase">
              AI Predictor
            </span>
          </div>
        </div>

        {/* ── Ticker ── */}
        <div className="flex items-center gap-3 sm:gap-4">
          {error && (
            <span className="font-mono text-xs text-neon-red">API unavailable</span>
          )}

          {!error && !data && (
            <div className="flex items-center gap-2 animate-pulse">
              <div className="h-4 w-28 bg-surface-border rounded" />
              <div className="h-5 w-16 bg-surface-border rounded" />
            </div>
          )}

          {!error && data && (
            <>
              {/* Live dot + label */}
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="live-dot" />
                <span className="font-mono text-xs text-gray-500 tracking-widest">BTC/USD</span>
              </div>

              {/* Price */}
              <span
                className="font-mono text-lg sm:text-xl font-normal text-neon-cyan text-glow-cyan tabular-nums"
              >
                ${fmt(data.price)}
              </span>

              {/* 24h change badge */}
              <span className={isUp ? 'badge-up' : 'badge-down'}>
                <span aria-hidden="true">{isUp ? '▲' : '▼'}</span>
                {Math.abs(change).toFixed(2)}%
              </span>

              <Countdown seconds={countdown} />
            </>
          )}
        </div>
      </div>
    </header>
  )
}
