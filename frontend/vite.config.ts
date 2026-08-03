import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Backend origin used by the dev proxy. Override with API_ORIGIN when the
// FastAPI container is published on a different host or port.
const API_ORIGIN = process.env.API_ORIGIN || 'http://127.0.0.1:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Modern baseline: smaller output, no legacy transpilation for browsers
    // that cannot run the app anyway.
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // React and the router change far less often than app code, so they
        // get their own long lived chunk instead of busting on every deploy.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Same origin proxy: the browser only ever talks to localhost:5173,
    // so no CORS preflight is involved during development.
    proxy: {
      '/api': {
        target: API_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
