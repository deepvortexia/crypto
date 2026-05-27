import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

const BTCDashboard = lazy(() => import('./BTCDashboard'))
const About        = lazy(() => import('./pages/About'))
const Pricing      = lazy(() => import('./pages/Pricing'))
const Proof        = lazy(() => import('./Proof'))
const Hub          = lazy(() => import('./pages/Hub'))

const PageShell = <div style={{ minHeight: '100vh', background: '#0a0a0a' }} />

export default function App() {
  const [user, setUser]             = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const freshLoginRef               = useRef(false)

  useEffect(() => {
    fetch('https://crypto-production-f7c5.up.railway.app/health').catch(() => {})
  }, [])

  useEffect(() => {
    let sub = null
    let cancelled = false
    import('./lib/supabase').then(({ supabase }) => {
      if (cancelled) return
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!cancelled) {
          setUser(session?.user ?? null)
          setAuthLoading(false)
        }
      })
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return
        if (event === 'SIGNED_IN') freshLoginRef.current = true
        setUser(session?.user ?? null)
      })
      sub = subscription
    })
    return () => {
      cancelled = true
      sub?.unsubscribe()
    }
  }, [])

  return (
    <>
    <Helmet>
      <title>PredictAlpha — Bitcoin &amp; Crypto AI Price Predictions</title>
      <meta name="description" content="Real-time Bitcoin and crypto AI price predictions powered by LSTM, XGBoost and Prophet. 6 time horizons, live on-chain data, derivatives signals. Free to start." />
      <meta property="og:title" content="PredictAlpha — Bitcoin & Crypto AI Price Predictions" />
      <meta property="og:description" content="Real-time Bitcoin and crypto AI price predictions powered by LSTM, XGBoost and Prophet. 6 time horizons, live on-chain data, derivatives signals. Free to start." />
      <meta property="og:url" content="https://predictalpha.app/btc" />
      <meta property="og:type" content="website" />
      <meta property="og:image" content="https://predictalpha.app/og-image.webp" />
      <link rel="canonical" href="https://predictalpha.app/btc" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="PredictAlpha — Bitcoin & Crypto AI Price Predictions" />
      <meta name="twitter:description" content="Real-time Bitcoin and crypto AI price predictions powered by LSTM, XGBoost and Prophet. 6 time horizons, live on-chain data, derivatives signals. Free to start." />
      <meta name="twitter:image" content="https://predictalpha.app/og-image.webp" />
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
    </Helmet>
    <ScrollToTop />
    <Routes>
      <Route path="/dashboard" element={<Navigate to="/btc" replace />} />
      <Route path="/about"   element={<Suspense fallback={PageShell}><About /></Suspense>} />
      <Route path="/pricing" element={<Suspense fallback={PageShell}><Pricing /></Suspense>} />
      <Route path="/proof"   element={<Suspense fallback={PageShell}><Proof /></Suspense>} />
      <Route path="/btc"     element={<Suspense fallback={PageShell}><BTCDashboard user={user} setUser={setUser} authLoading={authLoading} freshLoginRef={freshLoginRef} /></Suspense>} />
      <Route path="/"        element={<Suspense fallback={PageShell}><Hub /></Suspense>} />
    </Routes>
    </>
  )
}
