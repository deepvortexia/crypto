import { Link } from 'react-router-dom'

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
  <img src="/logoreal.png" style={{ width: '36px', height: '36px', objectFit: 'contain', opacity: 0.8 }} alt="" />
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
    q: 'How accurate are PREDICT ALPHA AI predictions?',
    a: 'Our ensemble model achieves historical directional accuracy of 72–92% depending on timeframe. Shorter horizons (4H) are most reliable because the signal-to-noise ratio is higher. Accuracy degrades naturally for longer horizons — our 1-month forecast carries a 51% confidence baseline and should be used as a directional bias, not a price target. We publish real confidence scores, not marketing numbers.',
  },
  {
    q: 'What data sources power the predictions?',
    a: 'PREDICT ALPHA ingests live data from Binance (OHLCV, futures), CoinGecko (market cap, sentiment), Glassnode-compatible on-chain APIs (hash rate, MVRV, active addresses), and aggregated order book depth snapshots. All feeds are updated every 30 seconds. No social media sentiment or news scraping is used — our signal is purely quantitative.',
  },
  {
    q: 'Is this financial advice?',
    a: 'No. PREDICT ALPHA is an educational and analytical tool. All outputs — predictions, indicators, key levels — are for informational purposes only and do not constitute investment advice. Cryptocurrency markets are highly volatile. Always do your own research and consult a licensed financial advisor before making any trading decisions.',
  },
  {
    q: 'What is the difference between the AI prediction timeframes?',
    a: 'We offer six horizons: 4H (intraday, 92% confidence), 8H (swing entry, 88%), 12H (half-day, 84%), 24H (daily trend, 78%), 1 Week (medium-term, 65%), and 1 Month (macro bias, 51%). Each horizon uses a slightly different feature weighting — shorter horizons emphasize order book imbalance and funding rates, while longer horizons lean on on-chain fundamentals and macro momentum.',
  },
  {
    q: 'What is the Fear & Greed index and how is it calculated?',
    a: 'The Fear & Greed index aggregates volatility (25%), market momentum and volume (25%), social sentiment (15%), Bitcoin dominance (10%), and Google Trends search interest (25%). A reading below 25 is Extreme Fear — historically a buy signal. Above 75 is Extreme Greed — historically correlated with local tops. PREDICT ALPHA displays this live alongside its own directional models.',
  },
  {
    q: 'How do Fibonacci retracement levels work?',
    a: 'Fibonacci retracements mark key price zones derived from the golden ratio (0.618, 0.382, 0.236, 0.786). These are drawn from the most recent significant swing high to swing low. Price tends to pause or reverse at these levels because algorithmic trading systems and high-volume participants place orders there. The 61.8% level ("golden ratio") is the most respected and watched by professional traders worldwide.',
  },
  {
    q: 'What is the funding rate and why does it matter?',
    a: 'The funding rate is a periodic payment between long and short futures traders, designed to keep perpetual contract prices anchored to spot price. A high positive funding rate (above 0.05%) means longs are paying shorts — the market is overleveraged bullish, which often precedes a correction. A negative funding rate signals the opposite: short-side overcrowding, which can spark short squeezes.',
  },
  {
    q: 'How often is the dashboard refreshed?',
    a: 'Live price and order book data refresh every 30 seconds. AI predictions are recalculated on each page load and cached for 5 minutes. On-chain data (hash rate, mempool, block time) updates approximately every 10 minutes, as block-level data changes more slowly. All timestamps are shown in your local browser timezone.',
  },
]

export default function About() {
  return (
    <div style={{ background: G.bg, minHeight: '100vh', color: G.bright, fontFamily: mono, position: 'relative', zIndex: 1 }}>

      {/* ── Navbar ── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(10,10,10,0.9)',
        backdropFilter: 'blur(14px)',
        borderBottom: `1px solid ${G.border}`,
        padding: '0 24px',
        height: 68,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <img src="/logoreal.png" alt="PREDICT ALPHA" style={{ height: 46, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontFamily: orb, fontSize: 18, letterSpacing: '0.15em', color: G.gold, opacity: 0.9 }}>PREDICT ALPHA</span>
        </Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Link to="/" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', color: G.text, textDecoration: 'none', textTransform: 'uppercase' }}>
            Dashboard
          </Link>
          <Link to="/about" style={{ fontFamily: mono, fontSize: 11, letterSpacing: '0.2em', color: G.gold, textDecoration: 'none', textTransform: 'uppercase', textShadow: `0 0 8px ${G.goldGlow}` }}>
            Learn
          </Link>
        </nav>
      </header>

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '60px 24px 80px' }}>

        {/* ── SEO meta hint (visible heading for crawlers) ── */}
        <h1 style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' }}>
          PREDICT ALPHA — AI Bitcoin Price Prediction Dashboard
        </h1>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* HERO */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ textAlign: 'center', marginBottom: 80, paddingTop: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <img src="/logoreal.png" style={{ width: 120, height: 120, objectFit: 'contain', filter: `drop-shadow(0 0 18px ${G.goldGlow})` }} alt="PREDICT ALPHA" />
          </div>
          <h2 style={{ fontFamily: orb, fontSize: 'clamp(24px,5vw,42px)', letterSpacing: '0.18em', ...goldText, marginBottom: 18, lineHeight: 1.2 }}>
            AI-POWERED MARKET INTELLIGENCE
          </h2>
          <p style={{ fontFamily: mono, fontSize: 14, color: G.text, maxWidth: 660, margin: '0 auto 28px', lineHeight: 1.9, letterSpacing: '0.05em' }}>
            PREDICT ALPHA runs a stacked ensemble of neural networks and gradient-boosted models against a continuous stream of real-time market data — processing thousands of data points per minute across price action, on-chain flows, and derivatives markets to generate calibrated directional forecasts across six time horizons.
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
        {/* WHAT IS PREDICT ALPHA */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>WHAT IS PREDICT ALPHA</SectionTitle>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 20, marginBottom: 32 }}>
            {[
              {
                title: 'Real-Time Intelligence',
                body: 'PREDICT ALPHA pulls live market data every 30 seconds from major exchanges and on-chain APIs. Unlike static charts, every metric on the dashboard reflects the current state of the Bitcoin market — from the order book to the mempool.',
              },
              {
                title: 'Multi-Layer Analysis',
                body: 'No single signal is reliable alone. PREDICT ALPHA layers technical indicators (RSI, MACD, Bollinger Bands) over on-chain fundamentals (hash rate, active addresses, MVRV) and derivatives sentiment (funding rate, open interest, long/short ratio) to produce a composite view.',
              },
              {
                title: 'Transparent Confidence',
                body: 'Every AI prediction is accompanied by a calibrated confidence score. We do not hide uncertainty behind vague language. A 51% confidence on the 1-month forecast means exactly that — it is a directional lean, not a guarantee, and we show the bar accordingly.',
              },
            ].map(({ title, body }) => (
              <div key={title} style={{ ...cardStyle, position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.2em', color: G.gold }}>{title}</span>
                </div>
                <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: `${G.gold}33` }}>
            <p style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, letterSpacing: '0.04em' }}>
              PREDICT ALPHA was built for traders who want more than a price chart. Whether you are a day trader watching the 4-hour signal, a swing trader tracking weekly momentum, or a long-term holder monitoring macro on-chain health, the platform surfaces the signals that matter at the horizon you care about. The dashboard is designed to be read in under 60 seconds — all critical data is above the fold, color-coded, and updated continuously.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* AI PREDICTIONS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>AI PRICE PREDICTIONS · 4H TO 1 MONTH</SectionTitle>

          <p style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 32, letterSpacing: '0.04em' }}>
            The prediction engine at the core of PREDICT ALPHA is a stacked ensemble of gradient-boosted decision trees, a short-term LSTM recurrent network, and a linear regression baseline. Each model is trained independently on historical OHLCV data and then combined using a meta-learner that weights each model's recent accuracy. The result is a predicted price and directional confidence score for each of six horizons.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16, marginBottom: 32 }}>
            {[
              { h: '4H', conf: 92, desc: 'Intraday momentum. Powered heavily by order book imbalance and 4-hour RSI divergence. Best for active traders entering or exiting within the same session.' },
              { h: '8H', conf: 88, desc: 'Extended intraday. Incorporates funding rate direction and MACD crossovers on the 4H chart. Useful for catching swing moves without overnight exposure.' },
              { h: '12H', conf: 84, desc: 'Half-day outlook. Blends technical momentum with short-term on-chain flow. Ideal for traders who check the market twice a day.' },
              { h: '24H', conf: 78, desc: 'Daily forecast. Weighted toward daily MACD, EMA alignment, and mempool congestion as a proxy for network demand. Most-watched horizon on the platform.' },
              { h: '1 WEEK', conf: 65, desc: 'Medium-term trend. On-chain fundamentals carry the most weight here — MVRV ratio, hash rate momentum, and exchange net flow. Best paired with macro context.' },
              { h: '1 MONTH', conf: 51, desc: 'Macro directional bias. Model confidence drops to near-coin-flip territory. Use as a sentiment gauge and strategic orientation, not a price target.' },
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
                <p style={{ fontFamily: mono, fontSize: 11, color: G.text, lineHeight: 1.85, letterSpacing: '0.03em' }}>{desc}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle }}>
            <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 2, letterSpacing: '0.03em' }}>
              Each prediction is recalculated on page load and cached server-side for 5 minutes, ensuring that the model runs on the freshest available data without overloading the API. The Deep Analysis feature runs an extended multi-step reasoning chain that annotates each signal, explains its current reading, and synthesises a final directional conclusion — surfacing the why behind the number, not just the number itself.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* TECHNICAL INDICATORS */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>TECHNICAL INDICATORS</SectionTitle>

          <p style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            Technical analysis describes the statistical patterns in price and volume data. While no single indicator predicts the future, the convergence of multiple indicators on the same signal significantly increases the probability of a directional move. PREDICT ALPHA tracks the following indicators in real time, all visualised with colour-coded bar gauges.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18 }}>
            {[
              {
                name: 'RSI — Relative Strength Index',
                body: 'The RSI measures the speed and change of price movements on a scale of 0–100. Readings below 30 indicate oversold conditions — the asset may be due for a bounce. Readings above 70 indicate overbought conditions — a pullback is likely. PREDICT ALPHA tracks RSI on the primary active timeframe and flags extreme readings in the indicator bar.',
              },
              {
                name: 'MACD — Moving Average Convergence Divergence',
                body: 'MACD compares two exponential moving averages (typically 12 and 26 periods) and plots the difference as a line. When the MACD line crosses above its signal line, it is a bullish crossover. The histogram represents momentum strength. PREDICT ALPHA shows the raw MACD value and signal value alongside their bar gauges so you can read momentum at a glance.',
              },
              {
                name: 'Bollinger Bands',
                body: 'Bollinger Bands plot two standard deviation lines above and below a 20-period moving average. Price touching or breaching the upper band in a non-trending market often reverts to the mean. The band width (distance between upper and lower) is a volatility indicator — wide bands mean high volatility, narrow bands precede breakouts. PREDICT ALPHA displays the upper and lower band values live.',
              },
              {
                name: 'Fear & Greed Index',
                body: 'A composite sentiment index ranging from 0 (Extreme Fear) to 100 (Extreme Greed). Historically, extreme fear periods have been the best long-term entry points for Bitcoin, while extreme greed readings have preceded major corrections. The index is updated daily and displayed as a circular gauge with colour gradient from red through amber to green.',
              },
            ].map(({ name, body }) => (
              <div key={name} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>{name}</span>
                </div>
                <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* ON-CHAIN */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>ON-CHAIN ANALYTICS</SectionTitle>

          <p style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            On-chain data is the heartbeat of the Bitcoin network. Unlike price, which can be manipulated by short-term sentiment, on-chain metrics reflect the actual behaviour of participants — wallets moving, miners mining, transactions confirming. These signals are slower-moving but structurally more significant for medium and long-term analysis.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 18 }}>
            {[
              {
                name: 'Hash Rate',
                body: 'The total computational power securing the Bitcoin network, measured in exahashes per second (EH/s). Rising hash rate reflects miner confidence — miners only invest in hardware if they expect the price to be profitable long-term. Hash rate at all-time highs is a macro-bullish signal. A sudden drop can indicate miner capitulation, often seen near cycle bottoms.',
              },
              {
                name: 'Block Time',
                body: 'Average time between mined blocks, targeting 10 minutes. When hash rate surges faster than the difficulty adjustment can accommodate, block times fall below 10 minutes — the network is running hot. When hash rate drops, block times stretch above 10 minutes. This metric is an indirect proxy for network health and miner activity.',
              },
              {
                name: 'MVRV Ratio',
                body: 'Market Value to Realised Value compares the current market cap to the average cost basis of all Bitcoin in circulation. MVRV above 3.5 has historically marked cycle tops. MVRV below 1.0 means the average holder is at a loss and has historically been an exceptional buy zone. PREDICT ALPHA displays this ratio live with contextual colour coding.',
              },
              {
                name: 'Active Addresses',
                body: 'The number of unique Bitcoin addresses participating in transactions daily. Rising active addresses indicate growing network utilisation and adoption. Sustained address growth while price consolidates is a bullish divergence — more people are using Bitcoin even as speculators stay sidelined. Falling addresses during a rally can signal a lack of real demand behind the price move.',
              },
              {
                name: 'Exchange Net Flow',
                body: 'Net Bitcoin flowing into or out of exchange wallets. Positive net flow (more BTC entering exchanges) is bearish — it means holders are depositing to sell. Negative net flow (BTC leaving exchanges) is bullish — it means buyers are withdrawing to self-custody, removing supply from the market. This metric is one of the strongest short-to-medium term directional indicators.',
              },
              {
                name: 'Mempool Congestion',
                body: 'The number of unconfirmed transactions waiting to be included in a block. A congested mempool with rising fees indicates high demand for Bitcoin block space — often coinciding with active markets. A clear mempool with minimal fees suggests calm conditions. PREDICT ALPHA shows pending transaction count, the fastest fee rate (sat/vB), and a one-hour fee estimate.',
              },
            ].map(({ name, body }) => (
              <div key={name} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="indicator-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>{name}</span>
                </div>
                <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FUTURES */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>FUTURES & DERIVATIVES INTELLIGENCE</SectionTitle>

          <p style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            Bitcoin futures markets trade more volume than the spot market. Understanding the mechanics of funding rates, open interest, and long/short ratios is essential for reading short-term market sentiment and avoiding the traps that catch most retail traders. PREDICT ALPHA aggregates all key derivatives metrics from Binance perpetual futures into a single, colour-coded view.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 18, marginBottom: 28 }}>
            {[
              {
                name: 'Funding Rate',
                body: 'Perpetual futures contracts use a funding mechanism to keep price anchored to spot. Every 8 hours, long positions pay shorts (or vice versa) based on the rate. A persistently positive rate above 0.05% signals extreme long-side leverage — the market is overcrowded on the bullish side and is vulnerable to a leveraged long liquidation cascade (a "long squeeze"). Negative funding signals short overcrowding and potential for a short squeeze.',
              },
              {
                name: 'Open Interest',
                body: 'Total value of outstanding futures contracts that have not been settled. Rising open interest with rising price confirms the trend — new money is entering on the long side. Rising open interest with falling price is a bearish signal — new shorts are being opened aggressively. A sudden collapse in open interest means a major liquidation event has cleared the market — these often mark local price extremes.',
              },
              {
                name: 'Long/Short Ratio',
                body: 'The ratio of long positions to short positions held by retail traders on major exchanges. Contrary to intuition, an extremely high long/short ratio is often bearish — when everyone is long, there is no one left to push price higher and the market becomes vulnerable to a flush. Professional traders often fade extreme retail positioning. PREDICT ALPHA shows this ratio live with signal interpretation.',
              },
              {
                name: 'Whale Activity',
                body: 'Large on-chain transactions (typically above 100 BTC) are tracked as a proxy for high-volume participant activity. When whales are accumulating — moving Bitcoin off exchanges to cold storage — it is a long-term bullish signal. When whales deposit large amounts to exchanges, it often precedes selling pressure. PREDICT ALPHA surfaces whale trade count and directional signal.',
              },
            ].map(({ name, body }) => (
              <div key={name} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div className="about-card-icon" style={{ flexShrink: 0 }}>
                    <LogoIcon />
                  </div>
                  <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>{name}</span>
                </div>
                <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>{body}</p>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: `${G.gold}33` }}>
            <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 2, letterSpacing: '0.03em' }}>
              The Order Book section adds another layer: it surfaces the best bid and best ask prices in real time, calculates the bid/ask ratio as a proxy for near-term buying or selling pressure, and displays the spread. A tightening spread indicates deep liquidity and efficient price discovery. A wide spread signals thin markets where price can move sharply on moderate volume.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* KEY LEVELS & FIBONACCI */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>KEY LEVELS & FIBONACCI RETRACEMENTS</SectionTitle>

          <p style={{ fontFamily: mono, fontSize: 13, color: G.text, lineHeight: 2, marginBottom: 28, letterSpacing: '0.04em' }}>
            Price does not move randomly — it gravitates toward levels where large amounts of orders cluster. PREDICT ALPHA automatically calculates pivot points, support and resistance levels, and Fibonacci retracements from the most recent significant swing, updating them with each data refresh.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className="indicator-icon"><LogoIcon /></div>
                <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.green }}>SUPPORT LEVELS — S1 / S2 / S3</span>
              </div>
              <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>
                Calculated using the classic pivot point formula from the prior session's high, low, and close. S1 is the first natural floor below the pivot — price often pauses here. S2 and S3 are deeper levels that come into play during larger corrections. These are the levels where buyers are expected to step in, making them high-probability zones to watch for reversals or bounces.
              </p>
            </div>
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div className="indicator-icon"><LogoIcon /></div>
                <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.red }}>RESISTANCE LEVELS — R1 / R2 / R3</span>
              </div>
              <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.9, letterSpacing: '0.03em' }}>
                Mirror calculations above the pivot. R1 is the first ceiling above the current price — bulls need to reclaim this to confirm an uptrend. R2 and R3 are extension targets in a strongly trending market. Resistance levels that flip to support after a breakout become the strongest holding zones in a bull market.
              </p>
            </div>
          </div>

          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div className="about-card-icon"><LogoIcon /></div>
              <span style={{ fontFamily: orb, fontSize: 10, letterSpacing: '0.15em', color: G.gold }}>FIBONACCI RETRACEMENTS EXPLAINED</span>
            </div>
            <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 2, letterSpacing: '0.03em' }}>
              The Fibonacci sequence — 0, 1, 1, 2, 3, 5, 8, 13, 21 — produces a ratio of approximately 1.618 between successive terms, known as the golden ratio. Its inverse, 0.618, is the most-watched Fibonacci retracement level in markets. The 0.382, 0.5, 0.618, and 0.786 levels are plotted between a swing high and swing low to identify where price might find support or resistance during a pullback. When the AI model detects that price is within 1% of a key Fibonacci level, it fires an alert banner on the dashboard. These near-level warnings have historically preceded significant price reactions in either direction.
            </p>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* FAQ */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ marginBottom: 72 }}>
          <SectionTitle>FREQUENTLY ASKED QUESTIONS</SectionTitle>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {FAQ_ITEMS.map(({ q, a }, i) => (
              <div key={i} style={{ ...cardStyle }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 12 }}>
                  <div className="indicator-icon" style={{ flexShrink: 0, marginTop: 2 }}><LogoIcon /></div>
                  <span style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.15em', color: G.gold, lineHeight: 1.6 }}>{q}</span>
                </div>
                <p style={{ fontFamily: mono, fontSize: 12, color: G.text, lineHeight: 1.95, letterSpacing: '0.03em', paddingLeft: 42 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CTA */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        <section style={{ textAlign: 'center', padding: '48px 24px', background: G.goldDim, border: `1px solid ${G.gold}33`, borderRadius: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <img src="/logoreal.png" style={{ width: 48, height: 48, objectFit: 'contain', filter: `drop-shadow(0 0 12px ${G.goldGlow})` }} alt="" />
          </div>
          <h2 style={{ fontFamily: orb, fontSize: 'clamp(16px,3vw,26px)', letterSpacing: '0.2em', ...goldText, marginBottom: 14 }}>
            READY TO SEE THE SIGNAL?
          </h2>
          <p style={{ fontFamily: mono, fontSize: 13, color: G.text, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.9 }}>
            Open the live dashboard and get instant access to AI predictions, on-chain data, and real-time derivatives intelligence — all in one screen.
          </p>
          <Link to="/" style={{
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
      }}>
        <div style={{ fontFamily: orb, fontSize: 11, letterSpacing: '0.12em', color: G.gold }}>PREDICT ALPHA</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: '#6b7280', letterSpacing: '0.2em' }}>
          NOT FINANCIAL ADVICE · FOR EDUCATIONAL PURPOSES ONLY
        </div>
      </footer>

    </div>
  )
}
