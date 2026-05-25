import { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'

export default function Pricing() {
  const navigate = useNavigate()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <>
      <Helmet>
        <title>Pricing — PredictAlpha</title>
        <meta name="description" content="PredictAlpha pricing plans. Free tier with 2 daily predictions, or go PRO at $12.99/month for unlimited timeframes, 20 deep analyses/day, and real-time signals." />
        <meta property="og:title" content="Pricing — PredictAlpha" />
        <meta property="og:description" content="Free vs PRO. Transparent pricing for AI-powered crypto predictions." />
        <meta property="og:url" content="https://predictalpha.app/pricing" />
        <link rel="canonical" href="https://predictalpha.app/pricing" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "PredictAlpha Pricing",
          "url": "https://predictalpha.app/pricing",
          "description": "Compare Free and PRO plans for PredictAlpha AI crypto prediction platform.",
          "offers": [
            {
              "@type": "Offer",
              "name": "Free",
              "price": "0",
              "priceCurrency": "USD",
              "description": "2 predictions per day, 1H timeframe only"
            },
            {
              "@type": "Offer",
              "name": "PRO",
              "price": "12.99",
              "priceCurrency": "USD",
              "billingIncrement": "P1M",
              "description": "20 deep analyses per day, all timeframes, priority signals"
            }
          ]
        })}</script>
      </Helmet>

      <style>{`
        .pricing-page {
          min-height: 100vh;
          background: #0a0a0a;
          color: #f0e6c8;
          font-family: "Share Tech Mono", monospace;
        }

        .pricing-nav {
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          background: rgba(10,10,10,0.92);
          border-bottom: 1px solid rgba(245,158,11,0.2);
          backdrop-filter: blur(12px);
        }

        .nav-logo {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          cursor: pointer;
          text-decoration: none;
        }

        .nav-logo-text {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f59e0b;
          letter-spacing: 0.05em;
        }

        .nav-links {
          display: flex;
          gap: 2rem;
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-links a {
          color: rgba(240,230,200,0.6);
          text-decoration: none;
          font-size: 0.9rem;
          letter-spacing: 0.03em;
          transition: color 0.2s;
        }

        .nav-links a:hover {
          color: #f59e0b;
        }

        .nav-cta {
          background: #f59e0b;
          color: #0a0a0a;
          border: none;
          padding: 0.5rem 1.2rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: 0.05em;
          transition: background 0.2s;
        }

        .nav-cta:hover {
          background: #e8c84a;
        }

        .pricing-hero {
          text-align: center;
          padding: 5rem 2rem 3rem;
          position: relative;
        }

        .pricing-hero::before {
          content: '';
          position: absolute;
          top: 0; left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 300px;
          background: radial-gradient(ellipse, rgba(245,158,11,0.08) 0%, transparent 70%);
          pointer-events: none;
        }

        .hero-eyebrow {
          font-size: 0.75rem;
          letter-spacing: 0.2em;
          color: #f59e0b;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .hero-title {
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 700;
          color: #f0e6c8;
          margin: 0 0 1rem;
          line-height: 1.15;
        }

        .hero-title span {
          color: #f59e0b;
        }

        .hero-sub {
          font-size: 1.05rem;
          color: rgba(240,230,200,0.6);
          max-width: 500px;
          margin: 0 auto 2.5rem;
          line-height: 1.7;
        }

        .pricing-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
          max-width: 820px;
          margin: 0 auto;
          padding: 0 1.5rem 4rem;
        }

        .plan-card {
          background: #111;
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 12px;
          padding: 2rem;
          position: relative;
          transition: border-color 0.3s;
        }

        .plan-card:hover {
          border-color: rgba(245,158,11,0.5);
        }

        .plan-card.featured {
          border: 1px solid rgba(245,158,11,0.6);
          background: linear-gradient(135deg, #111 0%, #141414 100%);
        }

        .plan-card.featured::before {
          content: 'MOST POPULAR';
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #f59e0b;
          color: #0a0a0a;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.15em;
          padding: 3px 14px;
          border-radius: 20px;
          white-space: nowrap;
        }

        .plan-name {
          font-size: 0.75rem;
          letter-spacing: 0.2em;
          color: rgba(240,230,200,0.5);
          text-transform: uppercase;
          margin-bottom: 0.5rem;
        }

        .plan-price {
          font-size: 3rem;
          font-weight: 700;
          color: #f0e6c8;
          line-height: 1;
          margin-bottom: 0.25rem;
        }

        .plan-price span {
          font-size: 1rem;
          font-weight: 400;
          color: rgba(240,230,200,0.4);
        }

        .plan-price .currency {
          font-size: 1.5rem;
          vertical-align: super;
          color: #f59e0b;
        }

        .plan-desc {
          font-size: 0.85rem;
          color: rgba(240,230,200,0.5);
          margin: 0.75rem 0 1.5rem;
          line-height: 1.5;
        }

        .plan-btn {
          width: 100%;
          padding: 0.75rem;
          border-radius: 6px;
          font-size: 0.9rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 1.75rem;
          border: none;
        }

        .plan-btn.free {
          background: transparent;
          border: 1px solid rgba(245,158,11,0.35);
          color: #f59e0b;
        }

        .plan-btn.free:hover {
          background: rgba(245,158,11,0.08);
          border-color: rgba(245,158,11,0.7);
        }

        .plan-btn.pro {
          background: #f59e0b;
          color: #0a0a0a;
        }

        .plan-btn.pro:hover {
          background: #e8c84a;
          transform: translateY(-1px);
        }

        .plan-divider {
          border: none;
          border-top: 1px solid rgba(245,158,11,0.1);
          margin-bottom: 1.5rem;
        }

        .feature-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .feature-list li {
          display: flex;
          align-items: flex-start;
          gap: 0.6rem;
          font-size: 0.9rem;
          color: rgba(240,230,200,0.8);
          line-height: 1.4;
        }

        .feat-check {
          color: #f59e0b;
          font-size: 1rem;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .feat-x {
          color: rgba(240,230,200,0.2);
          font-size: 1rem;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .feat-disabled {
          color: rgba(240,230,200,0.3);
        }

        .credits-section {
          max-width: 820px;
          margin: 0 auto;
          padding: 0 1.5rem 5rem;
        }

        .section-eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          color: #f59e0b;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 0.5rem;
        }

        .section-title {
          font-size: clamp(1.4rem, 3vw, 2rem);
          font-weight: 700;
          color: #f0e6c8;
          text-align: center;
          margin: 0 0 0.5rem;
        }

        .section-sub {
          text-align: center;
          color: rgba(240,230,200,0.5);
          font-size: 0.9rem;
          margin-bottom: 2.5rem;
          line-height: 1.6;
        }

        .credit-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .credit-card {
          background: #111;
          border: 1px solid rgba(245,158,11,0.15);
          border-radius: 10px;
          padding: 1.5rem;
          text-align: center;
          transition: border-color 0.3s, transform 0.2s;
          cursor: pointer;
        }

        .credit-card:hover {
          border-color: rgba(245,158,11,0.5);
          transform: translateY(-2px);
        }

        .credit-count {
          font-size: 2.5rem;
          font-weight: 700;
          color: #f59e0b;
          line-height: 1;
          margin-bottom: 0.25rem;
        }

        .credit-label {
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          color: rgba(240,230,200,0.4);
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        .credit-price {
          font-size: 1.4rem;
          font-weight: 700;
          color: #f0e6c8;
          margin-bottom: 0.2rem;
        }

        .credit-per {
          font-size: 0.75rem;
          color: rgba(240,230,200,0.35);
        }

        .faq-section {
          max-width: 640px;
          margin: 0 auto;
          padding: 0 1.5rem 5rem;
        }

        .faq-item {
          border-bottom: 1px solid rgba(245,158,11,0.1);
          padding: 1.25rem 0;
        }

        .faq-q {
          font-size: 0.95rem;
          font-weight: 600;
          color: #f0e6c8;
          margin-bottom: 0.5rem;
        }

        .faq-a {
          font-size: 0.88rem;
          color: rgba(240,230,200,0.55);
          line-height: 1.7;
        }

        .pricing-footer {
          border-top: 1px solid rgba(245,158,11,0.1);
          padding: 2rem;
          text-align: center;
        }

        .footer-links {
          display: flex;
          justify-content: center;
          gap: 2rem;
          list-style: none;
          padding: 0;
          margin: 0 0 1rem;
        }

        .footer-links a {
          color: rgba(240,230,200,0.4);
          text-decoration: none;
          font-size: 0.8rem;
          transition: color 0.2s;
        }

        .footer-links a:hover {
          color: #f59e0b;
        }

        .footer-disclaimer {
          font-size: 0.72rem;
          color: rgba(240,230,200,0.25);
          max-width: 600px;
          margin: 0 auto;
          line-height: 1.6;
        }

        @media (max-width: 600px) {
          .pricing-nav { padding: 1rem; }
          .nav-links { display: none; }
          .pricing-cards { grid-template-columns: 1fr; }
          .credit-cards { grid-template-columns: 1fr 1fr; }
        }
      `}</style>

      <div className="pricing-page">

        {/* NAV */}
        <nav className="pricing-nav">
          <a className="nav-logo" onClick={() => navigate('/')}>
            <img src="/logoegyptfinal.webp" style={{width:'40px',height:'40px',objectFit:'contain',opacity:0.8}} alt="" />
            <span style={{fontFamily:'"Orbitron", sans-serif',fontSize:'1rem',fontWeight:700,color:'#f59e0b',letterSpacing:'0.08em'}}>PREDICT ALPHA</span>
          </a>
          <ul className="nav-links">
            <li><a onClick={() => navigate('/about')} style={{cursor:'pointer'}}>How it works</a></li>
            <li><a onClick={() => navigate('/proof')} style={{cursor:'pointer'}}>Proof</a></li>
          </ul>
          <button className="nav-cta" onClick={() => navigate('/')}>Get Started</button>
        </nav>

        {/* HERO */}
        <section className="pricing-hero">
          <p className="hero-eyebrow">Simple, transparent pricing</p>
          <h1 className="hero-title">One price.<br/><span>Unlimited insight.</span></h1>
          <p className="hero-sub">Start free. Upgrade when the market demands it.</p>
        </section>

        {/* PLAN CARDS */}
        <div className="pricing-cards">

          {/* FREE */}
          <div className="plan-card">
            <p className="plan-name">Free</p>
            <div className="plan-price">
              <span className="currency">$</span>0
              <span> / month</span>
            </div>
            <p className="plan-desc">Get a taste of the oracle. No credit card required.</p>
            <button className="plan-btn free" onClick={() => navigate('/')}>Start for free</button>
            <hr className="plan-divider"/>
            <ul className="feature-list">
              <li><span className="feat-check">✦</span> 2 predictions per day</li>
              <li><span className="feat-check">✦</span> 1H timeframe only</li>
              <li><span className="feat-check">✦</span> BTC/USDT market</li>
              <li><span className="feat-check">✦</span> Basic price signals</li>
              <li><span className="feat-x">✦</span> <span className="feat-disabled">All timeframes (4H, 8H, 12H, 24H)</span></li>
              <li><span className="feat-x">✦</span> <span className="feat-disabled">Deep AI analysis</span></li>
              <li><span className="feat-x">✦</span> <span className="feat-disabled">MACD + mempool signals</span></li>
              <li><span className="feat-x">✦</span> <span className="feat-disabled">AI Market Tensions</span></li>
            </ul>
          </div>

          {/* PRO */}
          <div className="plan-card featured">
            <p className="plan-name">PRO</p>
            <div className="plan-price">
              <span className="currency">$</span>12<span>.99 / month</span>
            </div>
            <p className="plan-desc">Full access to every signal, every timeframe, every day.</p>
            <button className="plan-btn pro" onClick={() => navigate('/')}>Upgrade to PRO</button>
            <hr className="plan-divider"/>
            <ul className="feature-list">
              <li><span className="feat-check">✦</span> 20 deep analyses per day</li>
              <li><span className="feat-check">✦</span> All timeframes: 1H, 4H, 8H, 12H, 24H</li>
              <li><span className="feat-check">✦</span> BTC/USDT + multi-asset (coming soon)</li>
              <li><span className="feat-check">✦</span> Deep AI analysis (Claude-powered)</li>
              <li><span className="feat-check">✦</span> MACD 4H + mempool signals</li>
              <li><span className="feat-check">✦</span> AI Market Tensions (live)</li>
              <li><span className="feat-check">✦</span> LSTM + XGBoost + Prophet ensemble</li>
              <li><span className="feat-check">✦</span> Priority signal refresh</li>
            </ul>
          </div>

        </div>

        {/* CREDITS */}
        <div className="credits-section">
          <p className="section-eyebrow">À la carte</p>
          <h2 className="section-title">Need more? Buy credits.</h2>
          <p className="section-sub">Extra deep analyses on top of your plan. Perfect when markets move fast.</p>
          <div className="credit-cards">
            <div className="credit-card">
              <div className="credit-count">10</div>
              <div className="credit-label">Credits</div>
              <div className="credit-price">$2.99</div>
              <div className="credit-per">$0.30 per analysis</div>
            </div>
            <div className="credit-card">
              <div className="credit-count">50</div>
              <div className="credit-label">Credits</div>
              <div className="credit-price">$9.99</div>
              <div className="credit-per">$0.20 per analysis</div>
            </div>
            <div className="credit-card">
              <div className="credit-count">200</div>
              <div className="credit-label">Credits</div>
              <div className="credit-price">$29.99</div>
              <div className="credit-per">$0.15 per analysis</div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="faq-section">
          <p className="section-eyebrow">Questions</p>
          <h2 className="section-title">FAQ</h2>
          <div style={{marginTop:'2rem'}}>
            <div className="faq-item">
              <p className="faq-q">What is a "deep analysis"?</p>
              <p className="faq-a">A deep analysis runs our full LSTM + XGBoost + Prophet ensemble on live market data, combined with Claude AI to generate a detailed written report with signal breakdown, confidence score, and market tension assessment.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Do credits expire?</p>
              <p className="faq-a">Daily PRO credits reset every midnight UTC. Purchased credit packs never expire — they stay in your account until you use them.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">Can I cancel anytime?</p>
              <p className="faq-a">Yes. Cancel from your dashboard settings at any time. Your PRO access continues until the end of the billing period.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">What markets are supported?</p>
              <p className="faq-a">Currently BTC/USDT. Ethereum (ETH) and Gold (XAU) are in development and will be available to PRO subscribers first.</p>
            </div>
            <div className="faq-item">
              <p className="faq-q">How accurate are the predictions?</p>
              <p className="faq-a">Our models achieve 58–65% directional accuracy on 1H timeframes and 57–68% on longer horizons. See our /proof page for live benchmarks updated daily. No one can predict the future — but we built an ecosystem that creates perception.</p>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer className="pricing-footer">
          <ul className="footer-links">
            <li><a onClick={() => navigate('/')} style={{cursor:'pointer'}}>Home</a></li>
            <li><a onClick={() => navigate('/about')} style={{cursor:'pointer'}}>How it works</a></li>
            <li><a onClick={() => navigate('/proof')} style={{cursor:'pointer'}}>Proof</a></li>
          </ul>
          <p className="footer-disclaimer">
            No one can predict the future. But we built an ecosystem that creates perception.
            PredictAlpha is not financial advice. Crypto markets are highly volatile.
            Past model performance does not guarantee future results. Trade responsibly.
          </p>
        </footer>

      </div>
    </>
  )
}
