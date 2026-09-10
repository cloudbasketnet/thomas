/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** Gemini API key for bill scanning. Ships in the browser bundle — see src/lib/gemini.ts. */
  readonly VITE_GEMINI_API_KEY?: string
  /** Optional model override; defaults to gemini-3.6-flash. */
  readonly VITE_GEMINI_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
