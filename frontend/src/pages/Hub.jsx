import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

// ── tokens (identical values to BTCDashboard.jsx) ─────────────────────────────
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

function EthDiamond() {
  return (
    <svg width="60" height="80" viewBox="0 0 60 80" fill="none"
      style={{ filter: `drop-shadow(0 0 16px ${G.goldGlow})` }}>
      {/* upper-left facet */}
      <polygon points="30,2 4,38 30,50" fill={G.gold} />
      {/* upper-right facet (darker) */}
      <polygon points="30,2 56,38 30,50" fill={G.gold} opacity="0.6" />
      {/* lower-left facet (darker) */}
      <polygon points="4,38 30,50 30,78" fill={G.gold} opacity="0.6" />
      {/* lower-right facet */}
      <polygon points="56,38 30,50 30,78" fill={G.gold} />
    </svg>
  )
}

function GoldBar() {
  return (
    <svg width="80" height="60" viewBox="0 0 100 72" fill="none"
      style={{ filter: 'drop-shadow(0 4px 12px rgba(245,158,11,0.5)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>
      {/* right side face — darkest */}
      <polygon points="72,10 86,18 86,52 72,44" fill="#92400e" />
      {/* front face — medium gold */}
      <polygon points="14,18 72,10 72,44 14,52" fill="#d97706" />
      {/* top face — brightest gold, slight trapezoid perspective */}
      <polygon points="18,8 78,2 86,18 72,10 14,18" fill="#fbbf24" />
      {/* top face inner bevel edge (slightly darker strip at rear) */}
      <polygon points="18,8 78,2 72,6 14,12" fill="#f59e0b" opacity="0.6" />
      {/* shine streak 1 — diagonal highlight on top */}
      <polygon points="28,4 48,2 44,8 24,10" fill="white" opacity="0.18" />
      {/* shine streak 2 — narrower glint */}
      <polygon points="52,2 64,2 60,5 48,5" fill="white" opacity="0.12" />
      {/* engraved text on front face */}
      <text x="43" y="34" textAnchor="middle" fontFamily={MONO} fontSize="8" fontWeight="bold"
        fill="#92400e" opacity="0.9" letterSpacing="1">AU 999.9</text>
      {/* subtle text highlight (offset up-left for engraved look) */}
      <text x="42.5" y="33.5" textAnchor="middle" fontFamily={MONO} fontSize="8" fontWeight="bold"
        fill="#fbbf24" opacity="0.35" letterSpacing="1">AU 999.9</text>
    </svg>
  )
}

function Symbol({ char }) {
  return (
    <span style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 700, color: G.gold, lineHeight: 1, textShadow: `0 0 18px ${G.goldGlow}` }}>
      {char}
    </span>
  )
}

const cardBase = {
  background: G.card,
  borderRadius: 12,
  padding: '34px 26px',
  width: 280,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 14,
  textAlign: 'center',
}

const activeCard = {
  ...cardBase,
  border: '1px solid rgba(245,158,11,0.6)',
  boxShadow: '0 0 0 1px rgba(245,158,11,0.15), 0 4px 32px rgba(0,0,0,0.6)',
  animation: 'card-gold-pulse 2.5s ease-in-out infinite',
}

const lockedCard = {
  ...cardBase,
  border: `1px solid ${G.border}`,
  boxShadow: '0 4px 32px rgba(0,0,0,0.6)',
  opacity: 0.55,
}

const assetName = {
  fontFamily: DISPLAY,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '0.28em',
  color: G.bright,
  textTransform: 'uppercase',
}

const tagline = {
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
  border: 'none',
  borderRadius: 6,
  padding: '11px 26px',
  cursor: 'pointer',
  textTransform: 'uppercase',
  fontWeight: 'bold',
  textDecoration: 'none',
  boxShadow: `0 0 12px ${G.goldGlow}`,
  marginTop: 4,
}

const lockedBtn = {
  fontFamily: MONO,
  fontSize: 11,
  letterSpacing: '0.14em',
  color: G.gold,
  background: 'none',
  border: `1px solid ${G.gold}44`,
  borderRadius: 6,
  padding: '11px 22px',
  textTransform: 'uppercase',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  cursor: 'not-allowed',
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

const comingBadge = {
  fontFamily: MONO,
  fontSize: 9,
  letterSpacing: '0.25em',
  color: G.text,
  border: `1px solid ${G.border}`,
  borderRadius: 4,
  padding: '3px 9px',
  textTransform: 'uppercase',
}

const priceText = {
  fontFamily: MONO,
  fontSize: 22,
  color: G.gold,
  textShadow: `0 0 10px ${G.goldGlow}`,
}

export default function Hub() {
  const [prices, setPrices] = useState({ btc: null, eth: null, gold: null })

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
    <div style={{
      position: 'relative',
      zIndex: 1,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '64px 20px',
      textAlign: 'center',
    }}>
      <img src="/logoegyptfinal.webp" alt="PredictAlpha" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 22 }} />

      <h1 style={{
        fontFamily: DISPLAY,
        fontSize: 'clamp(26px, 5vw, 42px)',
        fontWeight: 700,
        letterSpacing: '0.34em',
        color: G.gold,
        textShadow: `0 0 8px ${G.gold}, 0 0 28px ${G.goldGlow}`,
        margin: 0,
        textTransform: 'uppercase',
      }}>
        Choose Your Asset
      </h1>

      <p style={{
        fontFamily: MONO,
        fontSize: 13,
        letterSpacing: '0.3em',
        color: 'rgba(245,158,11,0.55)',
        marginTop: 14,
        textTransform: 'uppercase',
      }}>
        Select a Market to Enter
      </p>

      <div className="hub-cards" style={{
        display: 'flex',
        gap: 24,
        flexWrap: 'wrap',
        justifyContent: 'center',
        marginTop: 50,
        marginBottom: 56,
        width: '100%',
        maxWidth: 1000,
      }}>
        {/* ── BITCOIN — active ── */}
        <div style={activeCard}>
          <Symbol char="₿" />
          <div style={assetName}>Bitcoin</div>
          <div style={tagline}>{TAGLINE}</div>
          <div style={{ fontFamily: MONO, fontSize: 26, color: G.gold, textShadow: `0 0 10px ${G.goldGlow}` }}>{fmtUsd(prices.btc)}</div>
          <span style={liveBadge}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: G.green, boxShadow: `0 0 8px ${G.green}`, animation: 'hub-blink 0.9s ease-in-out infinite' }} />
            Live
          </span>
          <Link to="/btc" style={enterBtn}>Enter →</Link>
        </div>

        {/* ── GOLD — coming soon ── */}
        <div style={lockedCard}>
          <GoldBar />
          <div style={assetName}>Gold</div>
          <div style={tagline}>{TAGLINE}</div>
          <div style={priceText}>{fmtUsd(prices.gold)}</div>
          <span style={comingBadge}>Coming Soon</span>
          <span style={lockedBtn}><Lock size={13} /> Locked</span>
        </div>

        {/* ── ETHEREUM — coming soon ── */}
        <div style={lockedCard}>
          <EthDiamond />
          <div style={assetName}>Ethereum</div>
          <div style={tagline}>{TAGLINE}</div>
          <div style={priceText}>{fmtUsd(prices.eth)}</div>
          <span style={comingBadge}>Coming Soon</span>
          <span style={lockedBtn}><Lock size={13} /> Locked</span>
        </div>
      </div>

      <div style={{
        fontFamily: MONO,
        fontSize: 12,
        letterSpacing: '0.12em',
        color: G.text,
        fontStyle: 'italic',
        opacity: 0.75,
        maxWidth: 480,
        lineHeight: 1.6,
      }}>
        "We don't predict the future. We build the perception of it."
      </div>

      <style>{`
        @keyframes hub-blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @media (max-width: 720px) {
          .hub-cards { flex-direction: column; align-items: center; }
        }
      `}</style>
    </div>
  )
}
