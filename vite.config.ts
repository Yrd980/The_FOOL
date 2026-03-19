import type { ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function patchMarkdownContentType(res: ServerResponse) {
  const originalSetHeader = res.setHeader.bind(res)

  res.setHeader = ((name, value) => {
    if (
      typeof name === 'string' &&
      name.toLowerCase() === 'content-type' &&
      typeof value === 'string' &&
      value.startsWith('text/markdown') &&
      !/charset=/i.test(value)
    ) {
      return originalSetHeader(name, `${value}; charset=utf-8`)
    }

    return originalSetHeader(name, value)
  }) as typeof res.setHeader
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'markdown-charset',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          patchMarkdownContentType(res)
          next()
        })
      },
      configurePreviewServer(server) {
        server.middlewares.use((_req, res, next) => {
          patchMarkdownContentType(res)
          next()
        })
      },
    },
    tailwindcss(),
    react(),
  ],
})
