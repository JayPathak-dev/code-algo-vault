import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:5002', // <--- Update to 5002
        changeOrigin: true,
        secure: false,
      }
    }
  }
})