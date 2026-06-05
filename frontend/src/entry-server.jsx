import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router'        // react-router v7 exports StaticRouter here
import { HelmetProvider } from 'react-helmet-async'

import Hub from './pages/Hub'
import About from './pages/About'
import Pricing from './pages/Pricing'
import Proof from './Proof'
import BtcMeta from './BtcMeta'                     // /btc: head-only (see BtcMeta.jsx)

// Pages are imported eagerly here (not via App.jsx's React.lazy) so that
// renderToString produces full markup including each page's own <Helmet>.
// Effects do not run during renderToString, so no network calls fire and
// no canvas/chart code executes — pure, deterministic, browser-free.
const ROUTES = {
  '/':        Hub,
  '/btc':     BtcMeta,
  '/about':   About,
  '/pricing': Pricing,
  '/proof':   Proof,
}

export function render(url) {
  const Page = ROUTES[url]
  if (!Page) throw new Error(`[prerender] no SSR component mapped for route: ${url}`)

  const helmetContext = {}
  const appHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={url}>
        <Page />
      </StaticRouter>
    </HelmetProvider>
  )

  const { helmet } = helmetContext
  const head =
    helmet.title.toString() +
    helmet.meta.toString() +
    helmet.link.toString() +
    helmet.script.toString()

  return { appHtml, head }
}
