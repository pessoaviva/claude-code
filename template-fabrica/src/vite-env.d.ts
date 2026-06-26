/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). Opcional. */
  readonly VITE_SUPABASE_URL?: string;
  /** Chave pública (anon) do Supabase. Opcional. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
