import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const repository=process.env.GITHUB_REPOSITORY?.split('/')[1]
const pagesBase=process.env.GITHUB_PAGES==='true' && repository ? `/${repository}/` : '/'

export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
})
