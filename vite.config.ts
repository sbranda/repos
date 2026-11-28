import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Se publica en https://<usuario>.github.io/repos/ (en este repo, sbranda). Si el repo se llama distinto, cambiá base.
export default defineConfig({
  base: '/repos/',
  plugins: [react()],
})
