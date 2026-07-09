import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The openscad-wasm module embeds a ~14MB base64 wasm blob. We load it inside a
// web worker, and we don't want Vite trying to inline/optimize it.
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['openscad-wasm'],
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 20000,
  },
})
