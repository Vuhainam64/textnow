import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env để lấy VITE_API_URL làm proxy target
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,  // proxy WebSocket upgrade
        }
      }
    }
  }
})
