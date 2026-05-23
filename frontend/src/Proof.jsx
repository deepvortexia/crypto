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

const MODELS = [
  { key: 'lstm',    label: 'LSTM',     desc: 'Neural Network',      idx: 0 },
  { key: 'xgboost', label: 'XGBoost', desc: 'Gradient Boosting',   idx: 1 },
  { key: 'prophet', label: 'Prophet', desc: 'Time-Series Forecast', idx: 2 },
]

function avgWeight(weights, idx) {
  if (!weights) return null
  const vals = Object.values(weights).map(w => w[idx]).filter(v => v != null)
  if (!vals.length) return null
  return (vals.reduce((a, b) => a + b, 0) / vals.length * 100).toFixed(1)
}

export default function Proof() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [now,     setNow]     = useState(new Date())

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

  const hasData     = data && data.total_predictions > 0
  const predictions = data?.predictions ?? []

  return (
    <div style={{ minHeight: '100vh', background: G.bg, paddingBottom: 80 }}>
      <Helmet>
        <title>Proof of Work — PredictAlpha</title>
        <meta name="description" content="PredictAlpha's full prediction track record. Every AI prediction logged, every result verified." />
        <meta property="og:title" content="Proof of Work — PredictAlpha" />
        <meta property="og:url" content="https://predictalpha.app/proof" />
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logoegyptfinal.webp" alt="PredictAlpha" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: orb, letterSpacing: '0.05em' }}>
            <span style={{ color: G.gold, fontWeight: 400 }}>PREDICT</span>
            <span style={{ color: G.gold, fontWeight: 700, textShadow: `0 0 8px ${G.goldGlow}` }}> ALPHA</span>
          </span>
        </Link>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link to="/about" style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>LEARN</Link>
          <Link to="/"     style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>DASHBOARD</Link>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>

        {/* ── SECTION 1: HEADER ── */}
        <section style={{ textAlign: 'center', marginBottom: 72 }}>
          <img src="/logoegyptfinal.webp" alt="Eye of Horus" style={{ height: 64, marginBottom: 24, opacity: 0.9 }} />
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

          {!loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
              {MODELS.map(({ key, label, desc, idx }) => {
                const w = avgWeight(data?.current_weights, idx)
                const dirAcc = hasData ? data.overall_direction_accuracy : null
                const mape   = hasData ? data.overall_mape : null
                const count  = hasData ? data.total_predictions : null

                return (
                  <div key={key} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div>
                        <div style={{ fontFamily: orb, fontSize: 14, letterSpacing: '0.15em', ...goldText, marginBottom: 4 }}>
                          {label}
                        </div>
                        <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: G.text, textTransform: 'uppercase' }}>
                          {desc}
                        </div>
                      </div>
                      {w != null && (
                        <div style={{ fontFamily: mono, fontSize: 11, color: G.text, background: G.goldDim, border: `1px solid ${G.gold}33`, borderRadius: 4, padding: '4px 8px', letterSpacing: '0.1em' }}>
                          {w}% weight
                        </div>
                      )}
                    </div>

                    {!hasData ? (
                      <div style={{ fontFamily: mono, fontSize: 12, color: G.text, opacity: 0.6 }}>
                        Accumulating data…
                      </div>
                    ) : (
                      <>
                        <div style={{ marginBottom: 12 }}>
                          <div style={labelStyle}>Direction Accuracy</div>
                          <div style={{ fontFamily: mono, fontSize: 26, color: dirAcc >= 55 ? G.green : dirAcc >= 45 ? G.gold : G.red }}>
                            {dirAcc != null ? `${dirAcc.toFixed(1)}%` : '—'}
                          </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <div style={labelStyle}>Mean Error</div>
                            <div style={{ fontFamily: mono, fontSize: 16, color: G.bright }}>
                              {mape != null ? `${mape.toFixed(2)}%` : '—'}
                            </div>
                          </div>
                          <div>
                            <div style={labelStyle}>Predictions</div>
                            <div style={{ fontFamily: mono, fontSize: 16, color: G.bright }}>
                              {count ?? '—'}
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p style={{ fontFamily: mono, fontSize: 11, color: G.gold, opacity: 0.5, textAlign: 'center', letterSpacing: '0.08em', margin: '16px 0 0' }}>
            Industry benchmark: 50% (random) · Top quant funds: 55–60% · PredictAlpha target: 57–60%
          </p>

          {/* by-horizon breakdown */}
          {hasData && data.by_horizon && Object.keys(data.by_horizon).length > 0 && (
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
                        <td style={{ padding: '8px 12px', color: s.direction_accuracy >= 55 ? G.green : s.direction_accuracy >= 45 ? G.gold : G.red }}>
                          {s.direction_accuracy != null ? `${s.direction_accuracy.toFixed(1)}%` : '—'}
                        </td>
                        <td style={{ padding: '8px 12px', color: G.bright }}>{s.mape != null ? `${s.mape.toFixed(2)}%` : '—'}</td>
                        <td style={{ padding: '8px 12px', color: G.text }}>{s.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ── SECTION 3: PAST PREDICTIONS TABLE ── */}
        <section style={{ marginBottom: 60 }}>
          <div style={sectionLabel}>Past Predictions</div>
          <div style={cardStyle}>
            {predictions.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: 13, color: G.text, opacity: 0.7, textAlign: 'center', padding: '32px 0' }}>
                No resolved predictions yet — check back soon.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
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
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}
