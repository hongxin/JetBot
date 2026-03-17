import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/JetBot/',
  plugins: [react(), tailwindcss()],
  server: {
    host: true,  // 监听 0.0.0.0，局域网可访问
  },
})
