import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import BtcMeta from './BtcMeta'

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
    <BtcMeta />
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
