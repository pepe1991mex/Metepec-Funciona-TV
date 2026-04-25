import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['chrome >= 53', 'android >= 5'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],
})