import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const BACKEND = 'https://crypto-production-f7c5.up.railway.app'

const G = {
  bg:       '#0a0a0a',
  card:     '#1a1500',
  border:   '#2a1f00',
  gold:     '#f59e0b',
  goldDim:  'rgba(245,158,11,0.15)',
  goldGlow: 'rgba(245,158,11,0.4)',
  green:    '#10b981',
  red:      '#ef4444',
  text:     '#a8a29e',
  bright:   '#fef3c7',
}

const orb  = '"Orbitron", sans-serif'
const mono = '"Share Tech Mono", monospace'

const cardStyle = {
  background: G.card,
  border: '1px solid rgba(245,158,11,0.6)',
  borderRadius: 10,
  padding: '22px 26px',
  boxShadow: '0 0 0 1px rgba(245,158,11,0.15), 0 4px 32px rgba(0,0,0,0.6)',
}

const labelStyle = {
  fontFamily: mono,
  fontSize: 10,
  letterSpacing: '0.25em',
  color: G.text,
  textTransform: 'uppercase',
  marginBottom: 8,
}

const goldText = { color: G.gold, textShadow: `0 0 8px ${G.goldGlow}` }

const sectionLabel = {
  fontFamily: mono,
  fontSize: 12,
  letterSpacing: '0.2em',
  color: '#f59e0bcc',
  textTransform: 'uppercase',
  marginBottom: 18,
  borderLeft: '3px solid #f59e0b',
  paddingLeft: 10,
}


export default function Proof() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [now,     setNow]     = useState(new Date())
  const [logs,    setLogs]    = useState(null)

  useEffect(() => {
    fetch(`${BACKEND}/api/accuracy`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const fetchLogs = () =>
      fetch(`${BACKEND}/api/logs`)
        .then(r => r.json())
        .then(d => setLogs(d.logs ?? []))
        .catch(() => {})
    fetchLogs()
    const id = setInterval(fetchLogs, 8000)
    return () => clearInterval(id)
  }, [])

  const hasData     = data && data.total_predictions > 0
  const predictions = data?.predictions ?? []

  return (
    <div style={{ minHeight: '100vh', background: G.bg, paddingBottom: 80 }}>
      <Helmet>
        <title>Proof of Work — PredictAlpha</title>
        <meta name="description" content="PredictAlpha's full prediction track record. Every AI prediction logged, every result verified." />
        <meta property="og:title" content="Proof of Work — PredictAlpha" />
        <meta property="og:description" content="PredictAlpha's full prediction track record. Every AI prediction logged, every result verified." />
        <meta property="og:url" content="https://predictalpha.app/proof" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://predictalpha.app/og-image.webp" />
        <link rel="canonical" href="https://predictalpha.app/proof" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Proof of Work — PredictAlpha" />
        <meta name="twitter:description" content="PredictAlpha's full prediction track record. Every AI prediction logged, every result verified." />
        <meta name="twitter:image" content="https://predictalpha.app/og-image.webp" />
      </Helmet>

      {/* ── NAV ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.88)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 32px', height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ flex: 1 }} />
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logoegyptfinal.webp" alt="PredictAlpha" width="38" height="38" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: orb, letterSpacing: '0.05em' }}>
            <span style={{ color: G.gold, fontWeight: 400 }}>PREDICT</span>
            <span style={{ color: G.gold, fontWeight: 700, textShadow: `0 0 8px ${G.goldGlow}` }}> ALPHA</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <Link to="/about" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>LEARN</Link>
          <Link to="/"     style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>DASHBOARD</Link>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>

        {/* ── SECTION 1: HEADER ── */}
        <section style={{ textAlign: 'center', marginBottom: 72 }}>
          <img src="/logoegyptfinal.webp" alt="Eye of Horus" width="64" height="64" style={{ height: 64, marginBottom: 24, opacity: 0.9 }} />
          <h1 style={{ fontFamily: orb, fontSize: 'clamp(24px,5vw,48px)', letterSpacing: '0.2em', ...goldText, marginBottom: 16 }}>
            PROOF OF WORK
          </h1>
          <p style={{ fontFamily: mono, fontSize: 15, color: G.bright, letterSpacing: '0.06em', marginBottom: 12, maxWidth: 640, margin: '0 auto 12px' }}>
            We show our work. Every prediction logged. Every result verified.
          </p>
          <p style={{ fontFamily: mono, fontSize: 12, color: G.text, letterSpacing: '0.08em', maxWidth: 560, margin: '0 auto', lineHeight: 1.8 }}>
            No one can predict the future. But we built an ecosystem that creates perception.
          </p>
        </section>

        {/* ── SECTION 2: MODEL ACCURACY ── */}
        <section style={{ marginBottom: 60 }}>
          <div style={sectionLabel}>Model Accuracy</div>

          {loading && (
            <div style={{ fontFamily: mono, color: G.text, fontSize: 13, opacity: 0.6, paddingLeft: 4 }}>
              Loading accuracy data…
            </div>
          )}

          <p style={{ fontFamily: mono, fontSize: 11, color: G.gold, opacity: 0.5, textAlign: 'center', letterSpacing: '0.08em', margin: '0 0 16px' }}>
            Industry benchmark: 50% (random) · Top quant funds: 58–65% · PredictAlpha target: 57–68%
          </p>

          {/* by-horizon breakdown */}
          {hasData && data.by_horizon && Object.keys(data.by_horizon).length > 0 && (
            <>
              <div style={{ ...cardStyle, marginTop: 20 }}>
                <div style={{ ...labelStyle, marginBottom: 14 }}>Accuracy by Horizon</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
                    <thead>
                      <tr>
                        {['Horizon', 'Direction Accuracy', 'Mean Error', 'Count'].map(h => (
                          <th key={h} style={{ textAlign: 'left', color: G.text, letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: 10, padding: '6px 12px', borderBottom: `1px solid ${G.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(data.by_horizon).map(([horizon, s]) => (
                        <tr key={horizon} style={{ borderBottom: `1px solid ${G.border}22` }}>
                          <td style={{ padding: '8px 12px', color: G.gold, letterSpacing: '0.1em' }}>{horizon.toUpperCase()}</td>
                          <td style={{ padding: '8px 12px' }}>
                            {s.count < 50 ? (
                              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}55`, borderRadius: 4, padding: '2px 7px' }}>
                                calibrating
                              </span>
                            ) : (
                              <span style={{ color: s.direction_accuracy >= 55 ? G.green : s.direction_accuracy >= 45 ? G.gold : G.red }}>
                                {s.direction_accuracy != null ? `${s.direction_accuracy.toFixed(1)}%` : '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: G.bright }}>{s.mape != null ? `${s.mape.toFixed(2)}%` : '—'}</td>
                          <td style={{ padding: '8px 12px', color: G.text }}>{s.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontFamily: mono, fontSize: 11, color: G.text, opacity: 0.55, marginTop: 12, paddingLeft: 2, letterSpacing: '0.04em' }}>
                Live predictions resolved against real price at expiration. Sample grows daily.
              </p>
            </>
          )}
        </section>

        {/* ── SECTION 3: PAST PREDICTIONS TABLE ── */}
        <section style={{ marginBottom: 60 }}>
          <div style={sectionLabel}>Past Predictions</div>
          <div style={cardStyle}>
            {predictions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <span style={{
                  fontFamily: mono,
                  fontSize: 12,
                  letterSpacing: '0.3em',
                  color: G.gold,
                  textTransform: 'uppercase',
                  animation: 'awaiting-pulse 2s ease-in-out infinite',
                }}>
                  𓂀&nbsp;&nbsp;AWAITING FIRST RESOLVED PREDICTION&nbsp;&nbsp;𓂀
                </span>
                <style>{`@keyframes awaiting-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
              </div>
            ) : (
              <div style={{ height: 400, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: mono, fontSize: 12 }}>
                  <thead>
                    <tr>
                      {['Date', 'Timeframe', 'Predicted Price', 'Real Price', 'Error %', 'Result'].map(h => (
                        <th key={h} style={{ textAlign: 'left', color: G.text, letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: 10, padding: '6px 12px', borderBottom: `1px solid ${G.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {predictions.slice(-20).reverse().map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${G.border}22` }}>
                        <td style={{ padding: '8px 12px', color: G.text }}>
                          {p.prediction_time ? new Date(p.prediction_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: G.gold, letterSpacing: '0.1em' }}>{(p.horizon ?? '—').toUpperCase()}</td>
                        <td style={{ padding: '8px 12px', color: G.bright }}>{p.predicted_price != null ? `$${Number(p.predicted_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                        <td style={{ padding: '8px 12px', color: G.bright }}>{p.actual_price != null ? `$${Number(p.actual_price).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</td>
                        <td style={{ padding: '8px 12px', color: p.pct_error != null && p.pct_error < 2 ? G.green : G.gold }}>
                          {p.pct_error != null ? `${p.pct_error.toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: 16 }}>
                          {p.direction_correct == null ? '—' : p.direction_correct ? '✅' : '❌'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION 5: LIVE RAILWAY LOGS ── */}
        <section style={{ marginBottom: 60 }}>
          <div style={{ ...sectionLabel, display: 'flex', alignItems: 'center', gap: 12 }}>
            Live System Logs
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: '#00ff88' }}>
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 6px #00ff88', animation: 'blink 1.2s ease-in-out infinite' }} />
              RAILWAY — LIVE
            </span>
          </div>
          <div style={{
            background: '#050505',
            border: `1px solid #00ff8833`,
            borderRadius: 10,
            padding: '14px 18px',
            height: 320,
            overflow: 'hidden',
            fontFamily: mono,
            fontSize: 11,
            lineHeight: 1.75,
          }}>
            {logs === null || logs.length === 0 ? (
              <span style={{ color: '#00ff8866' }}>Connecting to Railway...</span>
            ) : (
              logs.slice(0, 10).map((entry, i) => {
                const levelColor = entry.level === 'ERROR' ? '#ef4444'
                  : entry.level === 'WARNING' ? '#f59e0b'
                  : '#00ff88'
                return (
                  <div key={i} className="proof-log-line" style={{ color: levelColor, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ opacity: 0.5 }}>[{entry.time}]</span>
                    {' '}<span style={{ opacity: 0.8 }}>{entry.level}</span>
                    {' — '}{entry.message}
                  </div>
                )
              })
            )}
          </div>
          <style>{`@media (max-width: 480px) { .proof-log-line { font-size: 9px !important; } }`}</style>
        </section>

        {/* ── SECTION 4: DATA SOURCES FOOTER ── */}
        <section>
          <div style={{
            ...cardStyle,
            display: 'flex', flexWrap: 'wrap',
            alignItems: 'center', justifyContent: 'space-between',
            gap: 12, padding: '14px 22px',
            background: G.goldDim,
            border: `1px solid ${G.gold}33`,
          }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: G.text, textTransform: 'uppercase' }}>
              Data Sources:&nbsp;
              <span style={{ color: G.gold }}>OKX · CoinMarketCap · Mempool.space · Alternative.me</span>
            </div>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.15em', color: G.text }}>
              Last updated:&nbsp;<span style={{ color: G.green }}>LIVE · {now.toLocaleTimeString()}</span>
              &nbsp;·&nbsp;Powered by Claude Haiku · Anthropic · PredictAlpha
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <div style={{ borderTop: '1px solid #2a1f00', marginTop: 32, paddingTop: 20, paddingBottom: 20, display: 'flex', justifyContent: 'center' }}>
          <Link to="/" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: '#f59e0b', opacity: 0.7, textDecoration: 'none', textTransform: 'uppercase' }}>← HUB</Link>
        </div>

      </main>
    </div>
  )
}
