import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only CORS proxy that mirrors worker/cors-proxy.ts.
// Without it, requests to `<origin>/proxy?url=...` 404 in dev because the
// Cloudflare Worker handler only exists in production.
const devCorsProxy = (): PluginOption => ({
  name: 'dev-cors-proxy',
  configureServer(server) {
    server.middlewares.use('/proxy', async (req, res) => {
      try {
        const reqUrl = new URL(req.url ?? '', 'http://localhost')
        const target = reqUrl.searchParams.get('url')
        if (!target) {
          res.statusCode = 400
          res.end('Missing url param')
          return
        }

        if (req.method === 'OPTIONS') {
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
          res.statusCode = 204
          res.end()
          return
        }

        let body: Buffer | undefined
        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          body = Buffer.concat(chunks)
        }

        const headers: Record<string, string> = {}
        for (const [k, v] of Object.entries(req.headers)) {
          if (!v || k === 'host' || k === 'connection') continue
          headers[k] = Array.isArray(v) ? v.join(', ') : String(v)
        }

        const upstream = await fetch(target, {
          method: req.method,
          headers,
          body: body && body.length ? body : undefined,
        })

        res.statusCode = upstream.status
        res.setHeader('Access-Control-Allow-Origin', '*')
        upstream.headers.forEach((val, key) => {
          if (key === 'content-encoding' || key === 'transfer-encoding') return
          res.setHeader(key, val)
        })

        if (upstream.body) {
          const reader = upstream.body.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            res.write(Buffer.from(value))
          }
        }
        res.end()
      } catch (err: unknown) {
        res.statusCode = 502
        res.end(`Proxy error: ${err instanceof Error ? err.message : String(err)}`)
      }
    })
  },
})

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/JetBot/' : '/',
  plugins: [react(), tailwindcss(), devCorsProxy()],
  server: {
    host: true,  // 监听 0.0.0.0，局域网可访问
  },
}))
