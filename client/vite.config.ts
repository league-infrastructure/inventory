import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const apiTarget = process.env.VITE_API_URL || 'http://localhost:9310'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  define: {
    __APP_DOMAIN__: JSON.stringify(process.env.APP_DOMAIN || 'myapp.jtlapp.net'),
  },
  server: {
    host: true,
    port: Number(process.env.VITE_PORT) || 9311,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiTarget,
        // Keep the browser's Host header (localhost:9311) so Passport
        // constructs OAuth callback URLs through the Vite proxy,
        // not directly to the backend (localhost:9310).
        changeOrigin: false,
      },
    },
  },
})
