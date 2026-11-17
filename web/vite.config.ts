import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const companionPort = process.env.D100_COMPANION_PORT ?? '8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${companionPort}`,
        changeOrigin: true,
      },
    },
  },
})
