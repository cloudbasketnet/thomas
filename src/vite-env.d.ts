/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Gemini config, resolved at build time by vite.config.ts from either
 * VITE_GEMINI_API_KEY or GEMINI_API_KEY. Empty string when unset.
 * Note: this is inlined into the browser bundle — see src/lib/gemini.ts.
 */
declare const __GEMINI_API_KEY__: string
declare const __GEMINI_MODEL__: string
declare const __GEMINI_FAST_MODEL__: string
