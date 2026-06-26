/**
 * Camada de nuvem (Supabase) — só é usada quando o back-end está configurado.
 *
 * - Login real via Supabase Auth (e-mail + senha). O app continua mostrando o
 *   "login" amigável (ex.: Admin); aqui mapeamos para o e-mail por baixo
 *   dos panos.
 * - Dados guardados numa única linha da tabela `app_state` (modelo simples),
 *   protegida por RLS: só quem está autenticado lê/grava.
 */
import type { User as SupaUser } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import type { User } from "./auth";
import type { DB } from "./types";
import { APP_CONFIG } from "../config";

/** Domínio usado para transformar um login em e-mail do Supabase Auth. */
const EMAIL_DOMAIN = APP_CONFIG.emailDomain;

/** Linha única que guarda todo o banco (modelo pragmático). */
const ROW_ID = "main";

/**
 * Converte o login do app no e-mail do Supabase.
 * "Admin" → "admin@exemplo.app".
 * Se o usuário já digitar um e-mail, respeita.
 */
export function usernameToEmail(username: string): string {
  const u = username.trim().toLowerCase();
  if (u.includes("@")) return u;
  return `${u.replace(/\s+/g, "")}@${EMAIL_DOMAIN}`;
}

/** Monta o User do app a partir do usuário do Supabase (metadados). */
function userFromSupabase(u: SupaUser): User {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const emailPrefix = (u.email ?? "").split("@")[0];
  return {
    id: u.id,
    username: typeof meta.username === "string" ? meta.username : emailPrefix,
    name: typeof meta.name === "string" ? meta.name : emailPrefix,
    passhash: "", // não usado no modo nuvem (o Supabase valida a senha)
    isAdmin: meta.is_admin === true,
  };
}

/** Faz login no Supabase. Retorna o User do app ou lança erro. */
export async function cloudSignIn(username: string, password: string): Promise<User> {
  const sb = getSupabase();
  const email = usernameToEmail(username);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error("Login ou senha incorretos.");
  return userFromSupabase(data.user);
}

/** Sessão atual (se houver), para retomar sem pedir senha de novo. */
export async function cloudCurrentUser(): Promise<User | null> {
  const sb = getSupabase();
  const { data } = await sb.auth.getUser();
  return data.user ? userFromSupabase(data.user) : null;
}

export async function cloudSignOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

/** Carrega o banco da nuvem. Retorna null se ainda não existir. */
export async function cloudLoad(): Promise<DB | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("app_state").select("data").eq("id", ROW_ID).maybeSingle();
  if (error) throw new Error("Não foi possível carregar os dados da nuvem: " + error.message);
  return data ? (data.data as DB) : null;
}

/** Salva o banco na nuvem (cria ou atualiza a linha única). */
export async function cloudSave(db: DB): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb
    .from("app_state")
    .upsert({ id: ROW_ID, data: db, updated_at: new Date().toISOString() });
  if (error) throw new Error("Não foi possível salvar na nuvem: " + error.message);
}
