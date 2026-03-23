import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  // In production the admin UI is served from /admin-ui by NestJS
  base: '/admin-ui/',
  server: {
    port: 5174,
    proxy: {
      // Proxy admin API and client API to local NestJS server in dev
      '/admin': 'http://localhost:3000',
      '/api': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
