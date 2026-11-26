import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Se publica en https://sbranda.github.io/repos/
export default defineConfig({
  base: '/repos/',
  plugins: [react()],
})
