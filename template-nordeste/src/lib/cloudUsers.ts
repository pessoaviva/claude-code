/**
 * Gestão de usuários no modo nuvem — chama a Edge Function `api`,
 * que roda no servidor do Supabase e confere se quem pediu é administrador.
 */
import { getSupabase } from "./supabase";

export interface CloudUser {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

async function call<T>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke("api", {
    body: { action, ...args },
  });
  // Erros "de negócio" (validação, permissão) voltam no corpo como { error }.
  if (error) {
    let msg = "";
    let status: number | undefined;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx) {
        status = ctx.status;
        if (typeof ctx.clone === "function") {
          try {
            const body = await ctx.clone().json();
            if (body?.error) msg = body.error;
          } catch {
            const txt = await ctx.text().catch(() => "");
            if (txt) msg = txt.slice(0, 200);
          }
        }
      }
    } catch {
      /* segue com o que tiver */
    }
    const name = (error as { name?: string }).name ?? "Erro";
    if (status === 404) {
      msg = "Função 'api' não encontrada no Supabase (verifique o nome do deploy).";
    } else if (!msg && name === "FunctionsFetchError") {
      msg = "Não foi possível falar com o servidor (função não publicada ou bloqueio de rede/CORS).";
    }
    throw new Error(msg || `${name}${status ? ` (${status})` : ""}`);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export async function cloudListUsers(): Promise<CloudUser[]> {
  const { users } = await call<{ users: CloudUser[] }>("list");
  return users;
}

export async function cloudCreateUser(name: string, username: string, password: string): Promise<void> {
  await call("create", { name, username, password });
}

export async function cloudDeleteUser(id: string): Promise<void> {
  await call("delete", { id });
}

export async function cloudResetPassword(id: string, password: string): Promise<void> {
  await call("resetPassword", { id, password });
}
