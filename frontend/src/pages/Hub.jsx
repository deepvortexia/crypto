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
    <svg width="66" height="50" viewBox="0 0 80 56" fill="none">
      <polygon points="24,10 60,10 68,20 16,20" fill={G.gold} opacity="0.85" />
      <polygon points="16,20 68,20 74,44 10,44" fill={G.gold} opacity="0.5" />
      <text x="42" y="36" textAnchor="middle" fontFamily={MONO} fontSize="9" fontWeight="bold" fill={G.bg}>AU 999.9</text>
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

export default function Hub() {
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
          <div style={{ fontFamily: MONO, fontSize: 26, color: G.gold, textShadow: `0 0 10px ${G.goldGlow}` }}>$77,180</div>
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
          <span style={comingBadge}>Coming Soon</span>
          <span style={lockedBtn}><Lock size={13} /> Locked</span>
        </div>

        {/* ── ETHEREUM — coming soon ── */}
        <div style={lockedCard}>
          <EthDiamond />
          <div style={assetName}>Ethereum</div>
          <div style={tagline}>{TAGLINE}</div>
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
