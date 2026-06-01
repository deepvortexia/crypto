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
  margin: '0 0 18px',
  borderLeft: '3px solid #f59e0b',
  paddingLeft: 10,
  fontWeight: 'normal',
}


export default function Proof() {
  const [data,        setData]        = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [now,         setNow]         = useState(new Date())
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [logs,        setLogs]        = useState([])

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
      fetch(`${BACKEND}/api/logs/public`)
        .then(r => r.json())
        .then(d => setLogs(d.logs ?? []))
        .catch(() => {})
    fetchLogs()
    const id = setInterval(fetchLogs, 30000)
    return () => clearInterval(id)
  }, [])


const hasData     = data && data.total_predictions > 0
  const predictions = data?.predictions ?? []

  return (
    <div style={{ minHeight: '100vh', background: G.bg, paddingBottom: 80 }}>
      <Helmet>
        <title>PredictAlpha Proof of Work — AI Prediction Track Record</title>
        <meta name="description" content="Bitcoin, Ethereum and Gold AI prediction accuracy, crypto signal track record, ML model performance — every prediction logged and verified on PredictAlpha." />
        <meta property="og:title" content="PredictAlpha Proof of Work — AI Prediction Track Record" />
        <meta property="og:description" content="Bitcoin, Ethereum and Gold AI prediction accuracy, crypto signal track record, ML model performance — every prediction logged and verified on PredictAlpha." />
        <meta property="og:url" content="https://predictalpha.app/proof" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://predictalpha.app/og-image.webp" />
        <link rel="canonical" href="https://predictalpha.app/proof" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PredictAlpha Proof of Work — AI Prediction Track Record" />
        <meta name="twitter:description" content="Bitcoin, Ethereum and Gold AI prediction accuracy, crypto signal track record, ML model performance — every prediction logged and verified on PredictAlpha." />
        <meta name="twitter:image" content="https://predictalpha.app/og-image.webp" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "PredictAlpha Proof of Work — AI Prediction Track Record",
          "description": "Bitcoin, Ethereum and Gold AI prediction accuracy, crypto signal track record, LSTM XGBoost Prophet model performance — every prediction logged and verified.",
          "url": "https://predictalpha.app/proof",
          "image": "https://predictalpha.app/og-image.webp",
          "author": { "@type": "Organization", "name": "PredictAlpha", "url": "https://predictalpha.app" },
          "publisher": { "@type": "Organization", "name": "PredictAlpha", "url": "https://predictalpha.app", "logo": { "@type": "ImageObject", "url": "https://predictalpha.app/logoegyptfinal.webp" } },
          "about": [
            { "@type": "Thing", "name": "Bitcoin price prediction" },
            { "@type": "Thing", "name": "Ethereum price prediction" },
            { "@type": "Thing", "name": "Gold price prediction" },
            { "@type": "Thing", "name": "Machine learning model accuracy" }
          ]
        })}</script>
      </Helmet>

      {/* ── HEADER ── */}
      <header className="header-inner" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 32px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logoegyptfinal.webp" alt="PREDICT ALPHA" width="40" height="40" style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="navbar-brand" style={{ fontFamily: '"Orbitron",sans-serif', letterSpacing: '0.05em', opacity: 0.9, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#f59e0b', fontWeight: 400 }}>PREDICT</span>{' '}<span style={{ color: '#f59e0b', fontWeight: 700, textShadow: '0 0 8px rgba(245,158,11,0.4)' }}>ALPHA</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}`, animation: 'hub-blink 0.9s ease-in-out infinite' }} />
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.3em', color: G.green }}>LIVE</span>
            </div>
          </div>
        </div>

        {/* nav — desktop only */}
        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/about" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>LEARN</Link>
          <Link to="/proof" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>PROOF</Link>
          <Link to="/" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 4, padding: '6px 14px', textTransform: 'uppercase', textDecoration: 'none', whiteSpace: 'nowrap' }}>← HUB</Link>
          <a href="mailto:admin@predictalpha.app" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '6px 14px', textTransform: 'uppercase', textDecoration: 'none' }}>CONTACT</a>
        </nav>

        {/* hamburger — mobile only */}
        <button className="show-mobile" onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: 34, lineHeight: 1, padding: '10px', minWidth: 48, minHeight: 48 }}>☰</button>

        {/* mobile backdrop */}
        {menuOpen && (
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', top: 68, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 998 }} />
        )}
        {/* mobile dropdown */}
        {menuOpen && (
          <div style={{ position: 'absolute', top: 68, left: 0, right: 0, background: 'rgba(10,10,10,0.97)', borderBottom: '1px solid #2a1f00', zIndex: 999 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
              <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 28, cursor: 'pointer', padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0 20px' }}>
              <Link to="/about" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase' }}>LEARN</Link>
              <Link to="/proof" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase' }}>PROOF</Link>
              <Link to="/" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: '#f59e0b', textDecoration: 'none', textTransform: 'uppercase' }}>← HUB</Link>
              <a href="mailto:admin@predictalpha.app" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase' }}>CONTACT</a>
            </div>
          </div>
        )}
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
          <h2 style={sectionLabel}>Model Accuracy</h2>

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
          <h2 style={sectionLabel}>Past Predictions</h2>
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


        {/* ── SECTION 4: LIVE SYSTEM LOGS ── */}
        <section style={{ marginBottom: 60 }}>
          <h2 style={sectionLabel}>Live System Logs</h2>
          <div style={{
            background: '#0d0d0d',
            border: '1px solid rgba(245,158,11,0.4)',
            borderRadius: 8,
            padding: '16px 0 0',
            boxShadow: '0 0 0 1px rgba(245,158,11,0.08), 0 4px 32px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}>
            {/* terminal title bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 12px', borderBottom: '1px solid #1a1500' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(245,158,11,0.4)', marginLeft: 8, textTransform: 'uppercase' }}>predictalpha@system ~ logs/public</span>
            </div>
            {/* log lines */}
            <div style={{ height: 280, overflowY: 'auto', padding: '12px 16px', scrollbarWidth: 'thin', scrollbarColor: '#2a1f00 transparent' }}>
              {logs.length === 0 ? (
                <span style={{ fontFamily: mono, fontSize: 12, color: 'rgba(245,158,11,0.3)', letterSpacing: '0.15em' }}>
                  waiting for log stream…
                </span>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 5, lineHeight: 1.5 }}>
                    <span style={{ fontFamily: mono, fontSize: 11, color: 'rgba(245,158,11,0.45)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {entry.time}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: '#10b981', letterSpacing: '0.02em', wordBreak: 'break-word' }}>
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
              {/* blinking cursor */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: mono, fontSize: 11, color: 'rgba(245,158,11,0.45)' }}>$</span>
                <span style={{ display: 'inline-block', width: 7, height: 13, background: G.gold, animation: 'log-cursor 1.1s step-end infinite' }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION 5: DATA SOURCES FOOTER ── */}
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
        <div style={{ borderTop: '1px solid #2a1f00', marginTop: 32, paddingTop: 20, paddingBottom: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
          <Link to="/" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: '#f59e0b', opacity: 0.7, textDecoration: 'none', textTransform: 'uppercase' }}>← HUB</Link>
          <a href="https://x.com/PredictAlphapp" target="_blank" rel="noopener noreferrer" style={{display:'inline-flex', alignItems:'center', gap:6, textDecoration:'none', opacity:0.75}}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="#f59e0b" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.254 5.622L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            <span style={{fontFamily:'"Share Tech Mono",monospace', fontSize:10, color:'#f59e0b', letterSpacing:'0.1em'}}>X / Twitter</span>
          </a>
        </div>

      </main>

      <style>{`
        @keyframes hub-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes log-cursor { 0%,100%{opacity:1} 50%{opacity:0} }
        .show-mobile { display: none; }
        @media (max-width: 768px) {
          .header-inner { padding: 0 12px !important; }
          .navbar-brand  { font-size: 14px !important; white-space: nowrap !important; }
          .hide-mobile   { display: none !important; }
          .show-mobile   { display: flex !important; align-items: center !important; }
        }
      `}</style>
    </div>
  )
}
