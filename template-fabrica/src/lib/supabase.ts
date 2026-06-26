/**
 * Cliente do Supabase (back-end opcional).
 *
 * O app funciona 100% no navegador por padrão. Quando as duas variáveis de
 * ambiente abaixo estão configuradas (na Vercel ou num arquivo .env), o app
 * passa a usar o Supabase: login de verdade (Supabase Auth) e dados na nuvem.
 *
 * ⚠️ Neste template NÃO há chaves embutidas — defina-as por variável de
 * ambiente. (A chave anon é pública por design; se quiser, dá para embuti-la
 * depois, mas o padrão do template é mantê-la fora do código.)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** true quando o back-end está configurado (as duas chaves presentes). */
export function supabaseEnabled(): boolean {
  return Boolean(url && anonKey);
}

let _client: SupabaseClient | null = null;

/** Retorna o cliente Supabase (lança se não estiver configurado). */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error("Supabase não está configurado (faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY).");
  }
  if (!_client) {
    _client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _client;
}
