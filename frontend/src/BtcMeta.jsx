import { Helmet } from 'react-helmet-async'

// Head-only component for the /btc route. BTCDashboard imports supabase and
// lightweight-charts (canvas) at module load, so it cannot be server-rendered
// in pure Node. This reproduces the App-level <Helmet> so the prerendered
// /btc page ships full meta + JSON-LD without importing the dashboard itself.
// Keep in sync with the <Helmet> block in App.jsx.
export default function BtcMeta() {
  return (
    <Helmet>
      <title>PredictAlpha — Bitcoin &amp; Crypto AI Price Predictions</title>
      <meta name="description" content="Real-time Bitcoin and crypto AI price predictions powered by LSTM, XGBoost and Prophet. 6 time horizons, live on-chain data, derivatives signals. Free to start." />
      <meta property="og:title" content="PredictAlpha — Bitcoin & Crypto AI Price Predictions" />
      <meta property="og:description" content="Real-time Bitcoin and crypto AI price predictions powered by LSTM, XGBoost and Prophet. 6 time horizons, live on-chain data, derivatives signals. Free to start." />
      <meta property="og:url" content="https://predictalpha.app/btc" />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://predictalpha.app/og-imagejpg.jpg" />
      <link rel="canonical" href="https://predictalpha.app/btc" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="PredictAlpha — Bitcoin & Crypto AI Price Predictions" />
      <meta name="twitter:description" content="Real-time Bitcoin and crypto AI price predictions powered by LSTM, XGBoost and Prophet. 6 time horizons, live on-chain data, derivatives signals. Free to start." />
      <meta name="twitter:image" content="https://predictalpha.app/og-imagejpg.jpg" />
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "PredictAlpha",
        "url": "https://predictalpha.app/btc",
        "applicationCategory": "FinanceApplication",
        "operatingSystem": "Web",
        "offers": [
          { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "USD" },
          { "@type": "Offer", "name": "PRO", "price": "12.99", "priceCurrency": "USD", "billingIncrement": "month" }
        ]
      })}</script>
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": "https://predictalpha.app/#org",
            "name": "PredictAlpha",
            "url": "https://predictalpha.app",
            "logo": "https://predictalpha.app/logoegyptfinal.webp",
            "description": "AI-powered crypto price prediction platform for Bitcoin, using an LSTM + XGBoost + Prophet ensemble across multiple timeframes.",
            "sameAs": [
              "https://x.com/PredictAlphapp",
              "https://www.reddit.com/user/Excellent-Storm-5201",
              "https://www.producthunt.com/products/predictalpha"
            ]
          },
          {
            "@type": "WebSite",
            "@id": "https://predictalpha.app/#site",
            "url": "https://predictalpha.app",
            "name": "PredictAlpha",
            "publisher": { "@id": "https://predictalpha.app/#org" }
          }
        ]
      })}</script>
    </Helmet>
  )
}
