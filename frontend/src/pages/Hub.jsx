import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

// ── tokens ────────────────────────────────────────────────────────────────────
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

const MONO    = '"Share Tech Mono", monospace'
const DISPLAY = '"Orbitron", sans-serif'

const PRICES_URL = 'https://crypto-production-f7c5.up.railway.app/api/hub/prices'

const fmtUsd = n =>
  n == null ? '···' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

const TAGLINE = 'AI · 6 TIMEFRAMES · LIVE DATA'

// ── icons ─────────────────────────────────────────────────────────────────────
function EthDiamond() {
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" fill="none"
      style={{ filter: `drop-shadow(0 0 16px ${G.goldGlow})` }}>
      <polygon points="30,2 4,38 30,50" fill={G.gold} />
      <polygon points="30,2 56,38 30,50" fill={G.gold} opacity="0.6" />
      <polygon points="4,38 30,50 30,78" fill={G.gold} opacity="0.6" />
      <polygon points="56,38 30,50 30,78" fill={G.gold} />
    </svg>
  )
}

function GoldBar() {
  return (
    <img src="/goldbar.webp" alt="Gold bar"
      style={{ width: 90, height: 65, objectFit: 'contain', filter: 'drop-shadow(0 4px 16px rgba(245,158,11,0.6))' }} />
  )
}

function Symbol({ char }) {
  return (
    <span style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 700, color: G.gold, lineHeight: 1, textShadow: `0 0 18px ${G.goldGlow}` }}>
      {char}
    </span>
  )
}

// ── shared card style (all 3 equally premium) ─────────────────────────────────
const premiumCard = {
  background: G.card,
  borderRadius: 12,
  padding: '34px 26px',
  width: 'min(280px, 90vw)',
  minWidth: 0,
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  textAlign: 'center',
  border: '1px solid rgba(245,166,35,0.5)',
  boxShadow: 'inset 0 0 20px rgba(245,166,35,0.07), 0 4px 32px rgba(0,0,0,0.6)',
  transition: 'all 0.3s ease',
}

// ── text / badge styles ───────────────────────────────────────────────────────
const assetName = {
  fontFamily: DISPLAY,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '0.28em',
  color: G.bright,
  textTransform: 'uppercase',
}

const taglineStyle = {
  fontFamily: MONO,
  fontSize: 9,
  letterSpacing: '0.18em',
  color: G.text,
}

const enterBtn = {
  fontFamily: MONO,
  fontSize: 12,
  letterSpacing: '0.14em',
  color: '#000',
  background: `linear-gradient(135deg, ${G.gold}, #d97706)`,
  border: '1px solid #f59e0b',
  borderRadius: 6,
  padding: '11px 26px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontWeight: 'bold',
  textDecoration: 'none',
  boxShadow: `0 0 12px ${G.goldGlow}`,
  marginTop: 4,
}

const liveBadge = {
  fontFamily: MONO,
  fontSize: 9,
  letterSpacing: '0.3em',
  color: G.green,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: `1px solid ${G.green}55`,
  background: 'rgba(16,185,129,0.12)',
  borderRadius: 4,
  padding: '3px 9px',
  textTransform: 'uppercase',
}

const comingSoonTag = {
  fontFamily: MONO,
  fontSize: 10,
  letterSpacing: '0.22em',
  color: G.gold,
  background: 'rgba(245,158,11,0.1)',
  border: '1px solid rgba(245,158,11,0.35)',
  borderRadius: 20,
  padding: '6px 16px',
  textTransform: 'uppercase',
  textShadow: '0 0 10px rgba(245,158,11,0.6)',
  boxShadow: '0 0 12px rgba(245,158,11,0.1)',
  marginTop: 4,
}

const priceText = {
  fontFamily: MONO,
  fontSize: 22,
  color: G.gold,
  textShadow: `0 0 10px ${G.goldGlow}`,
}

// ── component ─────────────────────────────────────────────────────────────────
export default function Hub() {
  const [prices, setPrices]   = useState({ btc: null, eth: null, gold: null })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetch(PRICES_URL)
      .then(r => r.json())
      .then(data => {
        if (active) setPrices({ btc: data.btc ?? null, eth: data.eth ?? null, gold: data.gold ?? null })
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent' }}>
      <Helmet>
        <title>PredictAlpha — AI Bitcoin, Ethereum &amp; Gold Price Predictions</title>
        <meta name="description" content="AI-powered price predictions for Bitcoin, Ethereum, and Gold. LSTM, XGBoost and Prophet ensemble models. Real-time signals, deep analysis, and market intelligence." />
        <meta property="og:title" content="PredictAlpha — AI Bitcoin, Ethereum &amp; Gold Price Predictions" />
        <meta property="og:description" content="AI-powered price predictions for Bitcoin, Ethereum, and Gold. LSTM, XGBoost and Prophet ensemble models. Real-time signals, deep analysis, and market intelligence." />
        <meta property="og:url" content="https://predictalpha.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://predictalpha.app/og-image.webp" />
        <link rel="canonical" href="https://predictalpha.app/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PredictAlpha — AI Bitcoin, Ethereum &amp; Gold Price Predictions" />
        <meta name="twitter:description" content="AI-powered price predictions for Bitcoin, Ethereum, and Gold. LSTM, XGBoost and Prophet ensemble models. Real-time signals, deep analysis, and market intelligence." />
        <meta name="twitter:image" content="https://predictalpha.app/og-image.webp" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "PredictAlpha",
          "url": "https://predictalpha.app",
          "description": "AI-powered price predictions for Bitcoin, Ethereum, and Gold using LSTM, XGBoost and Prophet ensemble models.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": { "@type": "EntryPoint", "urlTemplate": "https://predictalpha.app/btc" },
            "query-input": "required name=search_term_string"
          }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/logoegyptfinal.webp" alt="PREDICT ALPHA" width="40" height="40"
            style={{ height: 40, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="navbar-brand" style={{ fontFamily: '"Orbitron",sans-serif', letterSpacing: '0.05em', opacity: 0.9, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#f59e0b', fontWeight: 400 }}>PREDICT</span>{' '}
              <span style={{ color: '#f59e0b', fontWeight: 700, textShadow: '0 0 8px rgba(245,158,11,0.4)' }}>ALPHA</span>
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}`, animation: 'hub-blink 0.9s ease-in-out infinite' }} />
              <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, letterSpacing: '0.3em', color: G.green }}>LIVE</span>
            </div>
          </div>
        </div>

        <nav className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/about" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>LEARN</Link>
          <Link to="/proof" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.25em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', opacity: 0.8 }}>PROOF</Link>
          <a href="mailto:admin@predictalpha.app" style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 10, letterSpacing: '0.2em', color: G.gold, background: G.goldDim, border: `1px solid ${G.gold}44`, borderRadius: 4, padding: '6px 14px', textTransform: 'uppercase', textDecoration: 'none' }}>CONTACT</a>
        </nav>

        <button className="show-mobile" onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: 34, lineHeight: 1, padding: '10px', minWidth: 48, minHeight: 48 }}>☰</button>

        {menuOpen && (
          <div onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', top: 68, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 998 }} />
        )}
        {menuOpen && (
          <div style={{ position: 'absolute', top: 68, left: 0, right: 0, background: 'rgba(10,10,10,0.97)', borderBottom: '1px solid #2a1f00', zIndex: 999 }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 8px 0' }}>
              <button onClick={() => setMenuOpen(false)}
                style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 28, cursor: 'pointer', padding: 8, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', padding: '8px 0 20px' }}>
              <Link to="/about" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase' }}>LEARN</Link>
              <Link to="/proof" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase' }}>PROOF</Link>
              <a href="mailto:admin@predictalpha.app" onClick={() => setMenuOpen(false)} style={{ padding: '14px 24px', fontFamily: '"Share Tech Mono",monospace', fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase' }}>CONTACT</a>
            </div>
          </div>
        )}
      </header>

      {/* ── AI BANNER ── */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a', textAlign: 'center', background: 'rgba(10,10,10,0.85)' }}>
        <span style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 16, letterSpacing: '0.3em', color: '#f59e0b', opacity: 0.8, animation: 'textPulse 2.5s ease-in-out infinite' }}>AI PREDICTING FUTURE</span>
        <div style={{ fontFamily: '"Share Tech Mono",monospace', fontSize: 9, color: '#6b7280', letterSpacing: '0.15em', opacity: 0.6, marginTop: 3 }}>Predictions may be inaccurate · Not financial advice · For educational purposes only</div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px 64px', textAlign: 'center' }}>
        <img src="/logoegyptfinal.webp" alt="PredictAlpha" fetchpriority="high" decoding="async"
          style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 22 }} />

        <h1 className="hub-h1" style={{
          fontFamily: DISPLAY,
          fontSize: 'clamp(20px, 5vw, 48px)',
          fontWeight: 700,
          letterSpacing: '0.2em',
          color: G.gold,
          textShadow: '0 0 20px #f59e0b, 0 0 60px rgba(245,158,11,0.4)',
          margin: 0,
          textTransform: 'uppercase',
          maxWidth: '90vw',
          wordBreak: 'break-word',
        }}>
          AI Price Predictions — Bitcoin, Ethereum &amp; Gold
        </h1>

        <p style={{
          fontFamily: MONO,
          fontSize: 'clamp(11px, 2vw, 16px)',
          letterSpacing: '0.4em',
          color: G.gold,
          marginTop: 14,
          textTransform: 'uppercase',
          animation: 'tagline-pulse 3s ease-in-out infinite',
        }}>
          Select a Market to Enter
        </p>

        <p style={{
          fontFamily: MONO,
          fontSize: 'clamp(10px, 1.5vw, 13px)',
          letterSpacing: '0.15em',
          color: 'rgba(245,158,11,0.5)',
          fontStyle: 'italic',
          marginTop: 10,
          marginBottom: 0,
        }}>
          We don't predict the future. We build the perception of it.
        </p>

        {/* ── CARDS ── */}
        <div className="hub-cards" style={{
          display: 'flex',
          gap: 24,
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginTop: 50,
          marginBottom: 40,
          width: '100%',
          maxWidth: 1000,
        }}>

          {/* BITCOIN — live */}
          <div className="hub-card" style={premiumCard}>
            <Symbol char="₿" />
            <h2 style={assetName}>Bitcoin</h2>
            <div style={taglineStyle}>{TAGLINE}</div>
            <div style={{ fontFamily: MONO, fontSize: 26, color: G.gold, textShadow: `0 0 10px ${G.goldGlow}` }}>{fmtUsd(prices.btc)}</div>
            <span style={liveBadge}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}`, animation: 'hub-blink 0.9s ease-in-out infinite' }} />
              Live
            </span>
            <Link to="/btc" style={enterBtn}>Enter →</Link>
          </div>

          {/* GOLD — coming soon */}
          <div className="hub-card" style={premiumCard}>
            <GoldBar />
            <h2 style={assetName}>Gold</h2>
            <div style={taglineStyle}>{TAGLINE}</div>
            <div style={priceText}>{fmtUsd(prices.gold)}</div>
            <span style={comingSoonTag}>✦ Coming Soon</span>
          </div>

          {/* ETHEREUM — coming soon */}
          <div className="hub-card" style={premiumCard}>
            <EthDiamond />
            <h2 style={assetName}>Ethereum</h2>
            <div style={taglineStyle}>{TAGLINE}</div>
            <div style={priceText}>{fmtUsd(prices.eth)}</div>
            <span style={comingSoonTag}>✦ Coming Soon</span>
          </div>

        </div>

        {/* ── SEO paragraph ── */}
        <p style={{
          fontFamily: MONO,
          fontSize: 'clamp(11px, 1.6vw, 13px)',
          color: 'rgba(168,162,158,0.6)',
          letterSpacing: '0.06em',
          lineHeight: 1.7,
          maxWidth: '90vw',
          width: 680,
          margin: '0 auto 8px',
          textAlign: 'center',
        }}>
          PredictAlpha uses machine learning to forecast BTC, ETH and Gold price movements across 6 timeframes — 1H, 4H, 1D, 3D, 1W, 1M.
        </p>

      </div>

      <style>{`
        @keyframes hub-blink    { 0%,100%{opacity:1}  50%{opacity:0.4} }
        @keyframes tagline-pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes textPulse    { 0%,100%{opacity:0.8} 50%{opacity:1}  }

        /* hamburger hidden on desktop */
        .show-mobile { display: none; }

        /* shimmer sweep placeholder — activates on hover below */
        .hub-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 60%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          pointer-events: none;
          z-index: 1;
        }

        /* hover: pointer devices only — no sticky touch */
        @media (hover: hover) {
          .hub-card:hover {
            transform: scale(1.03);
            border-color: rgba(245,166,35,0.8) !important;
            box-shadow:
              0 0 30px rgba(245,166,35,0.4),
              0 0 60px rgba(245,166,35,0.15),
              inset 0 0 40px rgba(245,166,35,0.08) !important;
          }
          .hub-card:hover::before {
            left: 150%;
            transition: left 0.6s ease;
          }
        }

        @media (max-width: 768px) {
          .header-inner { padding: 0 12px !important; }
          .navbar-brand  { font-size: 14px !important; white-space: nowrap !important; }
          .hide-mobile   { display: none !important; }
          .show-mobile   { display: flex !important; align-items: center !important; }
          .hub-cards     { flex-direction: column !important; align-items: center !important; gap: 16px !important; }
          .hub-h1        { letter-spacing: 0.08em !important; }
        }

        @media (max-width: 414px) {
          .hub-cards { gap: 14px !important; }
        }
      `}</style>
    </div>
  )
}
