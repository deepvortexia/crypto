import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const G = {
  bg:       '#0a0a0a',
  card:     '#141414',
  border:   '#2a1f00',
  gold:     '#f59e0b',
  goldDim:  'rgba(245,158,11,0.15)',
  goldGlow: 'rgba(245,158,11,0.4)',
  green:    '#10b981',
  red:      '#ef4444',
  text:     '#a8a29e',
  bright:   '#fef3c7',
}

const cardStyle = {
  background: G.card,
  border: `1px solid ${G.border}`,
  borderRadius: 10,
  padding: '22px 26px',
  boxShadow: `0 0 0 1px ${G.border}, 0 4px 32px rgba(0,0,0,0.6)`,
}

const goldText = {
  color: G.gold,
  textShadow: `0 0 8px ${G.goldGlow}`,
}

const mono = '"Share Tech Mono", monospace'
const orb  = '"Orbitron", sans-serif'

const LogoIcon = () => (
  <img src="/logoegyptfinal.webp" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.8 }} alt="" />
)

const sectionDivider = {
  borderBottom: `1px solid ${G.border}`,
  marginBottom: 40,
  paddingBottom: 10,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
}

const SectionTitle = ({ children }) => (
  <div style={sectionDivider}>
    <LogoIcon />
    <span style={{ fontFamily: orb, fontSize: 13, letterSpacing: '0.25em', color: G.gold, textShadow: `0 0 8px ${G.goldGlow}` }}>
      {children}
    </span>
  </div>
)

const FAQ_ITEMS = [
  {
    q: 'How accurate are the predictions?',
    a: '72–92% directional accuracy depending on timeframe. 4H is most reliable. 1-month is a macro bias — treat it as directional orientation, not a price target.',
  },
  {
    q: 'What assets does PredictAlpha cover?',
    a: 'Currently Bitcoin. Ethereum and Gold are coming soon.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. PredictAlpha is an educational and analytical tool. All outputs are for informational purposes only. Always do your own research.',
  },
  {
    q: 'How often does the dashboard update?',
    a: 'Price and order book every 30 seconds. Predictions cached 5 minutes. On-chain data every 10 minutes. Market Tensions regenerated every 5 minutes.',
  },
  {
    q: 'What makes PredictAlpha different?',
    a: 'Real confidence scores. Three-model ensemble with live accuracy weighting. MACD on 4H candles. AI trading setups every 5 minutes. A platform that shows uncertainty instead of hiding it.',
  },
]

export default function About() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div style={{ background: G.bg, minHeight: '100vh', color: G.bright, fontFamily: mono, position: 'relative', zIndex: 1 }}>
      <Helmet>
        <title>How PredictAlpha Works — AI Crypto Prediction Engine</title>
        <meta name="description" content="Learn how PredictAlpha uses a 3-model AI ensemble (LSTM + XGBoost + Prophet) to generate real-time Bitcoin, Ethereum and Gold price predictions across 6 time horizons." />
        <meta property="og:title" content="How PredictAlpha Works — AI Crypto Prediction Engine" />
        <meta property="og:description" content="Learn how PredictAlpha uses a 3-model AI ensemble (LSTM + XGBoost + Prophet) to generate real-time Bitcoin, Ethereum and Gold price predictions across 6 time horizons." />
        <meta property="og:url" content="https://predictalpha.app/about" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://predictalpha.app/og-image.webp" />
        <link rel="canonical" href="https://predictalpha.app/about" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="How PredictAlpha Works — AI Crypto Prediction Engine" />
        <meta name="twitter:description" content="Learn how PredictAlpha uses a 3-model AI ensemble (LSTM + XGBoost + Prophet) to generate real-time Bitcoin, Ethereum and Gold price predictions across 6 time horizons." />
        <meta name="twitter:image" content="https://predictalpha.app/og-image.webp" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "How accurate are PredictAlpha AI predictions?",
              "acceptedAnswer": { "@type": "Answer", "text": "PredictAlpha achieves 72–92% directional accuracy depending on timeframe. The 4H horizon is the most reliable for short-term trading signals. The 1-month prediction is a directional bias indicator only and should not be used for precise entry/exit timing." }
            },
            {
              "@type": "Question",
              "name": "What assets does PredictAlpha cover?",
              "acceptedAnswer": { "@type": "Answer", "text": "PredictAlpha currently covers Bitcoin (BTC). Ethereum and Gold predictions are coming soon." }
            },
            {
              "@type": "Question",
              "name": "What data sources power the predictions?",
              "acceptedAnswer": { "@type": "Answer", "text": "Live price data is sourced from CoinMarketCap, order book data from OKX, on-chain metrics from Blockchain.info and Mempool.space, and the Fear & Greed Index from alternative.me." }
            },
            {
              "@type": "Question",
              "name": "Is this financial advice?",
              "acceptedAnswer": { "@type": "Answer", "text": "No. PredictAlpha is an educational and analytical tool only. Nothing on this platform constitutes financial advice. Always do your own research before making any investment decisions." }
            },
            {
              "@type": "Question",
              "name": "How often does the dashboard update?",
              "acceptedAnswer": { "@type": "Answer", "text": "Price updates every 30 seconds, AI predictions are cached for 5 minutes, and on-chain data refreshes every 10 minutes." }
            }
          ]
        })}</script>
      </Helmet>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, overflow: 'visible',
        background: 'rgba(10,10,10,0.9)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 24px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logoegyptfinal.webp" alt="PREDICT ALPHA" width="46" height="46" style={{ height: 46, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: orb, fontSize: 18, letterSpacing: '0.15em', color: G.gold, opacity: 0.9 }}>PREDICT ALPHA</span>
        </Link>
        {/* desktop nav links */}
        <nav className="about-nav" style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', color: G.text, textDecoration: 'none', textTransform: 'uppercase' }}>Dashboard</Link>
          <Link to="/about" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', textShadow: `0 0 8px ${G.goldGlow}` }}>Learn</Link>
        </nav>
        {/* burger — tablet and mobile */}
        <button className="about-burger" onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b', fontSize: 34, lineHeight: 1, padding: '10px', minWidth: 48, minHeight: 48, display: 'none' }}>☰</button>
        {/* backdrop */}
        {menuOpen && (
          <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', top: 68, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 998 }} />
        )}
        {/* dropdown */}
        {menuOpen && (
          <div className="about-dropdown" style={{ position: 'absolute', top: 68, left: 'auto', right: 0, background: 'rgba(10,10,10,0.97)', borderBottom: `1px solid #2a1f00`, borderLeft: `1px solid #2a1f00`, borderBottomLeftRadius: 8, zIndex: 999, padding: '8px 0 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 8px 0' }}>
              <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', color: '#f59e0b', fontSize: 28, lineHeight: 1, cursor: 'pointer', padding: '8px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <Link to="/" onClick={() => setMenuOpen(false)} style={{ display: 'block', fontFamily: mono, fontSize: 13, letterSpacing: '0.2em', color: G.text, textDecoration: 'none', padding: '12px 24px', textTransform: 'uppercase' }}>Dashboard</Link>
            <Link to="/about" onClick={() => setMenuOpen(false)} style={{ display: 'block', fontFamily: mono, fontSize: 13, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', padding: '12px 24px', textTransform: 'uppercase', textShadow: `0 0 8px ${G.goldGlow}` }}>Learn</Link>
          </div>
        )}
      </header>

      <main className="about-main" style={{ maxWidth: 960, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* ── SEO meta hint (visible heading for crawlers) ── */}
        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          PREDICT ALPHA — How It Works — AI Bitcoin Price Prediction Engine
        </h1>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HERO */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ textAlign: 'center', marginBottom: 80, paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <img src="/logoegyptfinal.webp" alt="PREDICT ALPHA" width="120" height="120" style={{ width: 120, height: 120, objectFit: 'contain', filter: `drop-shadow(0 0 18px ${G.goldGlow})` }} />
          </div>
          <h2 className="about-hero-title" style={{ fontFamily: orb, fontSize: 'clamp(20px,5vw,42px)', letterSpacing: '0.18em', ...goldText, marginBottom: 18, lineHeight: 1.2 }}>
            PREDICT ALPHA — HOW IT WORKS
          </h2>
          <p className="about-body" style={{ fontFamily: mono, fontSize: 14, color: G.text, maxWidth: 660, margin: '0 auto 28px', lineHeight: 1.9, letterSpacing: '0.05em' }}>
            We don't predict the future. We build the perception of it. PredictAlpha is a real-time market intelligence platform built for traders who need more than a price chart. Every prediction, every signal, every metric reflects the current state of the market — updated continuously, never cached beyond 5 minutes. Currently covering Bitcoin. Ethereum and Gold coming soon.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['AI Predictions', 'On-Chain', 'Futures Data', 'Key Levels', 'Live Feeds'].map(tag => (
              <span key={tag} style={{
                fontFamily: mono, fontSize: 10, letterSpacing: '0.2em',
                padding: '5px 14px', borderRadius: 4,
                background: G.goldDim, border: `1px solid ${G.gold}44`, color: G.gold,
              }}>{tag}</span>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* THE PREDICTION ENGINE */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>THE PREDICTION ENGINE</SectionTitle>

          <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, marginBottom: 32 }}>
            {[
              {
                title: 'LSTM Neural Network',
                body: 'A recurrent neural network trained on sequential price patterns. The LSTM captures temporal dependencies across hundreds of candles, learning how momentum builds and reverses over time.',
              },
              {
                title: 'XGBoost Gradient Boosting',
                body: 'A gradient-boosted model trained on 40+ engineered features across price action, on-chain flows, and derivatives data. Excels at non-linear relationships and feature interactions that single models miss.',
              },
              {
                title: 'Prophet Time-Series',
                body: 'A decomposable time-series model capturing cyclical and trend components specific to Bitcoin — weekly seasonality, macro momentum, and longer-term structural patterns.',
              },
              {
                title: 'Meta-Learner Ensemble',
                body: 'A meta-learner combines the three models, continuously re-weighting each based on recent accuracy. The result: a predicted price, a directional signal (UP or DOWN), and a model agreement score.',
              },
            ].map(({ title, body }) => (
              <div key={title} style={{ ...cardStyle, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.2em', color: G.gold }}>{title}</span>
                </div>
                <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: `${G.gold}33` }}>
            <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, letterSpacing: '0.04em' }}>
              Most tools run a single model and call it AI. PredictAlpha runs three independent models simultaneously and combines them through a meta-learner that weights each model's recent accuracy. No single model dominates — the meta-learner rebalances weights continuously based on recent performance. Low agreement means the three models disagree — we show that uncertainty instead of hiding it.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* SIX TIME HORIZONS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>SIX TIME HORIZONS</SectionTitle>

          <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 32, letterSpacing: '0.04em' }}>
            Shorter horizons are more reliable. We publish confidence scores honestly — not as marketing copy, but as calibrated estimates of model certainty. Each horizon uses a distinct feature weighting tuned to the dynamics of that timeframe.
          </p>

          <div className="horizon-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { h: '4H', conf: 92, desc: 'Order book + RSI divergence — Intraday momentum. Best for active traders entering or exiting within the same session.' },
              { h: '8H', conf: 88, desc: 'Funding rate + MACD 4H — Extended intraday. Useful for catching swing moves without overnight exposure.' },
              { h: '12H', conf: 84, desc: 'Technical momentum + on-chain flow — Half-day outlook. Ideal for traders who check the market twice a day.' },
              { h: '24H', conf: 78, desc: 'MACD + EMA alignment — Daily forecast. Most-watched horizon on the platform.' },
              { h: '1 WEEK', conf: 65, desc: 'MVRV + hash rate + exchange flow — Medium-term trend. Best paired with macro context.' },
              { h: '1 MONTH', conf: 51, desc: 'Macro on-chain bias — Directional lean only, not a price target. Shorter horizons are more reliable. We publish confidence scores honestly.' },
            ].map(({ h, conf, desc }) => (
              <div key={h} style={{ ...cardStyle, borderTop: `2px solid ${G.gold}66` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div className="indicator-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 14, ...goldText, letterSpacing: '0.1em' }}>{h}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: 10, color: G.text, letterSpacing: '0.15em' }}>{conf}% CONF.</span>
                </div>
                <div style={{ background: '#1a1a1a', borderRadius: 3, height: 3, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ height: '100%', width: `${conf}%`, background: `linear-gradient(90deg,${G.green},${G.gold})`, borderRadius: 3 }} />
                </div>
                <p className="about-body" style={{ fontFamily: mono, fontSize: 11, color: G.text, lineHeight: 1.85, letterSpacing: '0.03em' }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle }}>
            <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 2, letterSpacing: '0.03em' }}>
              Each prediction is recalculated on page load and cached server-side for 5 minutes, ensuring the model runs on the freshest available data. The Deep Analysis feature runs an extended multi-step reasoning chain that annotates each signal, explains its current reading in plain language, and synthesises a final directional conclusion — the why behind the number, not just the number.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* WHAT POWERS THE SIGNAL */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>WHAT POWERS THE SIGNAL</SectionTitle>

          <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            PredictAlpha ingests live data every 30 seconds across four distinct signal stacks. Each stack feeds both the prediction engine and the live dashboard simultaneously.
          </p>

          <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
            {[
              {
                name: 'Price & Market',
                body: 'Live BTC/USDT from CoinMarketCap, order book depth from OKX. Best bid, best ask, bid/ask ratio, and spread updated every 30 seconds.',
              },
              {
                name: 'On-Chain',
                body: 'Hash rate, block time, total fees from Blockchain.info and Mempool.space. Mempool congestion and fee rates updated with each block. Active addresses, exchange net flow, MVRV ratio.',
              },
              {
                name: 'Derivatives',
                body: 'Funding rate, open interest, long/short ratio, and taker volume from OKX perpetual futures. These signals reveal how leveraged the market is and which side is crowded.',
              },
              {
                name: 'Sentiment & Technical',
                body: 'Fear and Greed Index from alternative.me, whale activity, media sentiment scored across recent crypto news headlines. RSI 14-period, MACD on 4H candles, Bollinger Bands 20-period 2-sigma, EMA 50 and EMA 200.',
              },
            ].map(({ name, body }) => (
              <div key={name} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>{name}</span>
                </div>
                <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* WHY MACD ON 4H, NOT DAILY */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>WHY MACD ON 4H, NOT DAILY</SectionTitle>

          <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            Most platforms calculate MACD on daily candles. The problem: daily signal lines lag by weeks after a major trend reversal. PredictAlpha uses 4H candles for MACD — fast enough to catch real momentum shifts, stable enough to filter noise. The signal you see reflects the market today, not two weeks ago.
          </p>

          <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
            {[
              {
                name: 'The Daily MACD Problem',
                body: 'A daily MACD signal line is a 9-day EMA of the MACD line. After a sharp reversal, it can take 2–3 weeks for the signal to reflect the new trend direction. By then, the move is already over.',
              },
              {
                name: 'The 4H Advantage',
                body: 'At 4H resolution, MACD responds to trend changes within hours, not weeks. The signal line converges to current conditions roughly 6x faster than on daily candles.',
              },
              {
                name: 'Signal Freshness',
                body: 'PredictAlpha fetches 200 4H candles from OKX on every indicator refresh. The MACD, signal line, and histogram you see are never more than 4 hours stale.',
              },
              {
                name: 'EMA 12 / 26 / 9',
                body: 'Standard MACD parameters preserved: 12-period and 26-period exponential moving averages of 4H closes, with a 9-period signal line. Industry-standard settings, industry-leading freshness.',
              },
              {
                name: 'Histogram Interpretation',
                body: 'The histogram shows the distance between the MACD line and the signal line. Expanding histogram means momentum is accelerating. Contracting histogram means momentum is fading — often the first warning before a crossover.',
              },
              {
                name: 'Crossover Signals',
                body: 'A bullish crossover occurs when the MACD line crosses above the signal line. On 4H data, these crossovers are actionable intraday signals, not lagging confirmations of a move that already happened.',
              },
            ].map(({ name, body }) => (
              <div key={name} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="indicator-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>{name}</span>
                </div>
                <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* AI MARKET TENSIONS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>AI MARKET TENSIONS — LIVE TRADING SETUPS</SectionTitle>

          <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            Every 5 minutes, PredictAlpha scans all live signals simultaneously and generates 2–4 active trading setups. Not generic alerts — reasoned setups with context: what the signal is, why it matters right now, and what to watch for next.
          </p>

          <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18, marginBottom: 28 }}>
            {[
              {
                name: 'Bullish Divergences',
                body: 'When price makes a new low but momentum indicators do not follow. A classic early warning for reversals — the market is losing selling conviction before price confirms it.',
              },
              {
                name: 'Bearish Crossovers',
                body: 'MACD and RSI divergences confirming a downtrend. Flagged with context explaining which signals are aligning and what level to watch for confirmation or invalidation.',
              },
              {
                name: 'Bollinger Squeeze',
                body: 'Volatility compression identified before explosive moves. When Bollinger Bands contract to their narrowest range, a breakout is imminent — PredictAlpha flags the direction bias from other signals.',
              },
              {
                name: 'Extreme Positioning',
                body: 'Funding rate extremes, long/short ratio crowding, and whale positioning alerts when the market is dangerously one-sided. These are the conditions that precede sharp liquidation cascades.',
              },
            ].map(({ name, body }) => (
              <div key={name} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>{name}</span>
                </div>
                <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: `${G.gold}33` }}>
            <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 2, letterSpacing: '0.03em' }}>
              This is the feature that separates PredictAlpha from a dashboard that just shows numbers. It tells you what the numbers mean together. Each setup includes the signal, the context, and the key level to watch — generated fresh every 5 minutes from the full live signal stack.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TRANSPARENCY BY DESIGN */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>TRANSPARENCY BY DESIGN</SectionTitle>

          <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            PredictAlpha was built on one principle: show the work. Every confidence score is real. Every model agreement percentage reflects actual consensus between three independent models. When models disagree, you see a low agreement score — not a false confidence number engineered to look impressive.
          </p>

          <div className="levels-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className="indicator-icon"><LogoIcon /></div>
                <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.green }}>REAL CONFIDENCE SCORES</span>
              </div>
              <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>
                Every prediction confidence score reflects actual model consensus — not a marketing number. A 51% score on the 1-month forecast means exactly that: the three models marginally agree on direction. We publish the number as it is.
              </p>
            </div>
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className="indicator-icon"><LogoIcon /></div>
                <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.red }}>UNCERTAINTY ON DISPLAY</span>
              </div>
              <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>
                When models disagree, the agreement score drops visibly and the confidence bar shrinks. No hidden smoothing, no confidence floor, no false precision. Low agreement is a signal in itself — the market is in a regime the models find ambiguous.
              </p>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="about-card-icon"><LogoIcon /></div>
              <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>DEEP ANALYSIS REASONING CHAIN</span>
            </div>
            <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 2, letterSpacing: '0.03em' }}>
              The Deep Analysis feature runs a multi-step reasoning chain that annotates each signal, explains its current reading in plain language, and synthesises a final directional conclusion. Not just the number — the why behind the number. Each analysis step is shown sequentially so you can follow the logic, not just accept the output.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* COMING SOON */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>COMING SOON — ETHEREUM AND GOLD</SectionTitle>

          <div className="about-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, marginBottom: 32 }}>
            {[
              {
                title: 'Ethereum Predictions',
                body: 'The same ensemble architecture powering Bitcoin predictions is being extended to Ethereum. ETH will have its own dedicated signal stack, calibrated to Ethereum-specific dynamics: gas fees, staking yields, layer-2 activity, and the distinct volatility profile of ETH relative to BTC.',
              },
              {
                title: 'Gold Predictions',
                body: 'Gold requires a fundamentally different signal stack — macro interest rate expectations, USD strength, geopolitical risk, and inflation expectations replace on-chain data. The prediction engine will be retrained with Gold-specific features and evaluated independently.',
              },
              {
                title: 'Multi-Asset Intelligence',
                body: 'PredictAlpha is being built as a multi-asset intelligence platform, not a single-coin tool. The goal: one dashboard, three assets, six horizons each — with cross-asset correlation signals surfaced when Bitcoin, Ethereum, and Gold diverge or converge in unusual ways.',
              },
              {
                title: 'Same Transparency Standards',
                body: 'Every new asset will launch with the same real confidence scores, model agreement display, and Deep Analysis reasoning chain. No asset will be added until the ensemble achieves validated directional accuracy above 70% on the 4H horizon.',
              },
            ].map(({ title, body }) => (
              <div key={title} style={{ ...cardStyle, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.2em', color: G.gold }}>{title}</span>
                </div>
                <p className="about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: `${G.gold}33` }}>
            <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, letterSpacing: '0.04em' }}>
              The same ensemble architecture powering Bitcoin predictions is being extended to Ethereum and Gold. Each asset will have its own dedicated signal stack, calibrated to the specific dynamics of that market. PredictAlpha is being built as a multi-asset intelligence platform, not a single-coin tool.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FAQ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section" style={{ marginBottom: 72 }}>
          <SectionTitle>FREQUENTLY ASKED QUESTIONS</SectionTitle>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div key={i} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                  <div className="indicator-icon" style={{ flexShrink: 0, marginTop: 2 }}><LogoIcon /></div>
                  <span className="faq-q" style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.15em', color: G.gold, lineHeight: 1.6 }}>{q}</span>
                </div>
                <p className="faq-answer about-body" style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.95, letterSpacing: '0.03em', paddingLeft: 42 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CTA */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section className="about-section cta-section" style={{ textAlign: 'center', padding: '48px 24px', background: G.goldDim, border: `1px solid ${G.gold}33`, borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <img src="/logoegyptfinal.webp" style={{ width: 48, height: 48, objectFit: 'contain', filter: `drop-shadow(0 0 12px ${G.goldGlow})` }} alt="" />
          </div>
          <h2 style={{ fontFamily: orb, fontSize: 'clamp(16px,3vw,26px)', letterSpacing: '0.2em', ...goldText, marginBottom: 14 }}>
            READY TO SEE THE SIGNAL?
          </h2>
          <p className="about-body" style={{ fontFamily: mono, fontSize: 13, color: G.text, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.9 }}>
            Open the live dashboard and get instant access to AI predictions, on-chain data, and real-time derivatives intelligence — all in one screen.
          </p>
          <Link to="/" className="cta-btn" style={{
            display: 'inline-block',
            fontFamily: orb, fontSize: 13, letterSpacing: '0.25em',
            color: G.bg,
            background: `linear-gradient(135deg, ${G.gold}, #d97706)`,
            padding: '14px 36px',
            borderRadius: 8,
            textDecoration: 'none',
            boxShadow: `0 0 24px ${G.goldGlow}`,
            transition: 'box-shadow 0.2s',
          }}>
            OPEN DASHBOARD
          </Link>
          <div style={{ fontFamily: mono, fontSize: 10, color: G.text, letterSpacing: '0.2em', marginTop: 18 }}>
            NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: `1px solid ${G.border}`,
        padding: '20px 24px',
        textAlign: 'center',
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12,
        overflow: 'hidden',
      }}>
        <div style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.12em', color: G.gold }}>PREDICT ALPHA</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#6b7280', letterSpacing: '0.2em' }}>
          NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY
        </div>
        <div style={{ width: '100%', fontFamily: mono, fontSize: 9, color: '#374151', letterSpacing: '0.12em', textAlign: 'center' }}>
          AI predictions may be inaccurate · Past signals do not guarantee future results · Trade responsibly
        </div>
        <div className="about-credit" style={{ width: '100%', paddingTop: 12, color: '#6b7280', fontSize: '11px', letterSpacing: '0.15em', fontFamily: orb }}>
          CREATED BY YANNICK BOISCLAIR · POWERED BY PREDICT ALPHA
        </div>
      </footer>

      <style>{`
        /* burger visible below 1280px (tablet + mobile) */
        @media (max-width: 1279px) {
          .about-nav    { display: none !important; }
          .about-burger { display: flex !important; align-items: center !important; order: 3 !important; }
        }
        /* tablet: constrained dropdown */
        @media (min-width: 769px) and (max-width: 1279px) {
          .about-dropdown { width: 280px !important; }
        }
        /* ≤1024px: tighter main padding + cap all grids at 2 columns */
        @media (max-width: 1024px) {
          .about-main   { padding: 48px 20px !important; }
          .about-grid   { grid-template-columns: repeat(2, 1fr) !important; }
          .horizon-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .levels-grid  { grid-template-columns: repeat(2, 1fr) !important; }
        }
        /* mobile: full-width dropdown */
        @media (max-width: 768px) {
          .about-dropdown { width: 100% !important; left: 0 !important; right: 0 !important;
                            border-left: none !important; border-bottom-left-radius: 0 !important; }
        }
        @media (max-width: 768px) {
          .about-main {
            padding: 32px 16px 48px !important;
          }
          .about-section {
            margin-bottom: 40px !important;
          }
          .about-hero-title {
            font-size: clamp(20px, 6vw, 32px) !important;
            letter-spacing: 0.08em !important;
          }
          .about-grid {
            grid-template-columns: 1fr !important;
          }
          .horizon-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .levels-grid {
            grid-template-columns: 1fr !important;
          }
          .about-body {
            font-size: 12px !important;
            line-height: 1.85 !important;
          }
          .faq-q {
            font-size: 13px !important;
            letter-spacing: 0.08em !important;
          }
          .faq-answer {
            padding-left: 0 !important;
            margin-top: 8px !important;
          }
          .cta-btn {
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
            text-align: center !important;
          }
          .cta-section {
            padding: 32px 16px !important;
          }
        }
        @media (max-width: 480px) {
          .horizon-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .about-credit {
            font-size: 9px !important;
            padding: 20px 10px !important;
            letter-spacing: 0.08em !important;
          }
        }
        @media (max-width: 320px) {
          .about-main      { padding: 16px 12px !important; }
          header a span    { font-size: 14px !important; }
        }
      `}</style>

    </div>
  )
}
