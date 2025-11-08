import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'src': path.resolve(__dirname, './src')
    }
  },
  server: {
    proxy: {
      '/api': {
        // In Docker, use service name 'backend'. Locally, use 'localhost:8000'
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true
      },
      '/media': {
        // Proxy media requests to backend, which then proxies to MinIO
        target: process.env.VITE_API_TARGET || 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
