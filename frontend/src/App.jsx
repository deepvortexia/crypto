import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from './lib/supabase'
import BTCDashboard from './BTCDashboard'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
const About = lazy(() => import('./pages/About'))
const Proof = lazy(() => import('./Proof'))
const Hub = lazy(() => import('./pages/Hub'))

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const freshLoginRef = useRef(false)

  // Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') freshLoginRef.current = true
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
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
      <Route path="/about" element={<Suspense fallback={null}><About /></Suspense>} />
      <Route path="/proof" element={<Suspense fallback={null}><Proof /></Suspense>} />
      <Route path="/btc" element={<BTCDashboard user={user} setUser={setUser} authLoading={authLoading} freshLoginRef={freshLoginRef} />} />
      <Route path="/" element={<Suspense fallback={null}><Hub /></Suspense>} />
    </Routes>
    </>
  )
}
