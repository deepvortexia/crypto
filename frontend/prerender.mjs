import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render } from './dist-server/entry-server.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')

const ROUTES = ['/', '/btc', '/about', '/pricing', '/proof']

// Read the client-built index.html ONCE up front — it is our template and we
// overwrite it last (for '/'), so it must be captured before the loop writes.
const template = await fs.readFile(path.join(dist, 'index.html'), 'utf-8')

for (const url of ROUTES) {
  const { appHtml, head } = render(url)

  const html = template
    .replace('</head>', `${head}\n</head>`)
    .replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`)

  const out =
    url === '/'
      ? path.join(dist, 'index.html')
      : path.join(dist, url, 'index.html')

  await fs.mkdir(path.dirname(out), { recursive: true })
  await fs.writeFile(out, html, 'utf-8')
  console.log('✓ prerendered', url, '→', path.relative(dist, out))
}
