import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  // Empty prefix so this sees unprefixed names too, from .env files and from
  // the host's build environment. Only the values named in `define` below are
  // ever handed to the client.
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * Vite only exposes VITE_* to the browser, but some hosts refuse to store a
   * variable under that name. Accept either spelling and settle it here, so
   * VITE_GEMINI_API_KEY works locally and GEMINI_API_KEY works on Vercel.
   */
  const pick = (...names: string[]) => names.map((n) => env[n]).find(Boolean) ?? ''

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: { port: 5180, open: true },
    define: {
      __GEMINI_API_KEY__: JSON.stringify(pick('VITE_GEMINI_API_KEY', 'GEMINI_API_KEY')),
      __GEMINI_MODEL__: JSON.stringify(pick('VITE_GEMINI_MODEL', 'GEMINI_MODEL') || 'gemini-3.6-flash'),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            icons: ['lucide-react'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
