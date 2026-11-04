import { cpSync, createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const extraPublicDirs = ['public2', 'public3', 'public4']

const mimeTypes = {
  '.atlas': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
}

function serveExtraPublicDirs(server) {
  const roots = extraPublicDirs
    .map((directory) => path.resolve(directory))
    .filter((directory) => existsSync(directory))

  server.middlewares.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()

    let pathname
    try {
      pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname)
    } catch {
      return next()
    }

    const relativePath = pathname.replace(/^[/\\]+/, '')
    if (!relativePath || relativePath.split(/[\\/]/).includes('..')) return next()

    for (const root of roots) {
      const filePath = path.resolve(root, relativePath)
      if (!filePath.startsWith(root + path.sep)) continue

      let fileStats
      try {
        fileStats = statSync(filePath)
      } catch {
        continue
      }
      if (!fileStats.isFile()) continue

      const range = req.headers.range
      let start = 0
      let end = fileStats.size - 1
      let statusCode = 200

      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (!match) {
          res.statusCode = 416
          res.setHeader('Content-Range', `bytes */${fileStats.size}`)
          return res.end()
        }
        if (match[1]) start = Number(match[1])
        if (match[2]) end = Number(match[2])
        if (!match[1] && match[2]) start = Math.max(0, fileStats.size - Number(match[2]))
        end = Math.min(end, fileStats.size - 1)
        if (start > end || start >= fileStats.size) {
          res.statusCode = 416
          res.setHeader('Content-Range', `bytes */${fileStats.size}`)
          return res.end()
        }
        statusCode = 206
      }

      res.statusCode = statusCode
      res.setHeader('Content-Type', mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream')
      res.setHeader('Accept-Ranges', 'bytes')
      res.setHeader('Content-Length', end - start + 1)
      res.setHeader('Cache-Control', 'public, max-age=0')
      if (statusCode === 206) res.setHeader('Content-Range', `bytes ${start}-${end}/${fileStats.size}`)
      if (req.method === 'HEAD') return res.end()

      return createReadStream(filePath, { start, end }).pipe(res)
    }

    return next()
  })
}

function multiPublicAssets() {
  return {
    name: 'bd2-multiple-public-asset-directories',
    configureServer: serveExtraPublicDirs,
    configurePreviewServer: serveExtraPublicDirs,
    closeBundle() {
      const outputDirectory = path.resolve('dist')
      if (!existsSync(outputDirectory)) return

      for (const directory of extraPublicDirs) {
        const sourceDirectory = path.resolve(directory)
        if (existsSync(sourceDirectory)) {
          cpSync(sourceDirectory, outputDirectory, { recursive: true, force: true })
        }
      }
    },
  }
}

export default defineConfig({
  plugins: [vue(), multiPublicAssets()],
  base: '/',
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
  },
})
