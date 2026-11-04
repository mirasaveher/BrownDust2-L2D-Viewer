import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/',
  publicDir: 'public_final',
  server: {
    host: '0.0.0.0',
  },
})
