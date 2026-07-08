// Configuração do Vite para a aplicação Mycon POC (React).
// A URL do backend vem de VITE_API_URL (.env.local); não há proxy de dev.

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
})
