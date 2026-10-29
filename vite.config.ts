import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"
import { Readable } from 'node:stream'

// Chỉ dùng khi chạy `npm run dev`: phục vụ các hàm trong api/ ngay trong Vite
// để không bắt buộc cài Vercel CLI. Khi deploy, Vercel tự chạy api/ như serverless.
// Biến môi trường (GEMINI_API_KEY...) chỉ nạp vào process.env phía Node, không lộ ra trình duyệt.
// Tailwind không tự nạp lại tailwind.config.js khi server dev đang chạy, dẫn tới class mới (token màu...)
// không có CSS và giao diện sai màu. Plugin này khởi động lại server dev mỗi khi file config đổi.
function restartOnTailwindConfig(): Plugin {
  return {
    name: 'orbit-restart-on-tailwind-config',
    apply: 'serve',
    configureServer(server) {
      const file = path.resolve(process.cwd(), 'tailwind.config.js')
      server.watcher.add(file)
      server.watcher.on('change', (changed) => {
        if (path.resolve(changed) === file) void server.restart()
      })
    },
  }
}

// Chỉ dev: nhận ảnh chụp cảnh 3D (?campussnap) và ghi thành public/brand/campus-still.webp
function saveCampusStill(): Plugin {
  return {
    name: 'orbit-save-campus-still',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-campus-still', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          return res.end()
        }
        const chunks: Buffer[] = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', async () => {
          const fs = await import('node:fs/promises')
          const file = path.resolve(process.cwd(), 'public/brand/campus-still.webp')
          await fs.writeFile(file, Buffer.concat(chunks))
          res.end(file)
        })
      })
    },
  }
}

function devApi(): Plugin {
  return {
    name: 'orbit-dev-api',
    apply: 'serve',
    configureServer(server) {
      Object.assign(process.env, loadEnv(server.config.mode, process.cwd(), ''))

      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/([a-z0-9-]+)(?:\?|$)/)
        if (!match) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`)
          const handler = mod[req.method ?? 'GET']
          if (typeof handler !== 'function') {
            res.statusCode = 405
            return res.end()
          }
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : (Readable.toWeb(req) as ReadableStream)
          const request = new Request(new URL(req.url!, 'http://localhost'), {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body,
            duplex: 'half',
          } as RequestInit)
          const response: Response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          // Không tìm thấy file api tương ứng → để Vite trả 404 như bình thường
          if (String(err).includes('Failed to load')) return next()
          server.config.logger.error(String(err))
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Lỗi máy chủ khi chạy dev.' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi(), saveCampusStill(), restartOnTailwindConfig()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
