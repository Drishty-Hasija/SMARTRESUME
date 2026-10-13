import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const api = process.env.VITE_PROXY_TARGET || 'http://localhost:8000'
const proxy = { '/api': { target: api, changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
})
