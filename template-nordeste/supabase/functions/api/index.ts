// Edge Function: admin-users
// Cria / lista / exclui / redefine senha de usuários — só para o ADMIN.
//
// Por que existe: a chave service_role (super-poder, ignora o RLS) NUNCA pode
// ficar no site. Esta função roda no servidor do Supabase, guarda essa chave em
// segredo, confere se quem chamou é administrador e só então age.
//
// O Supabase injeta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY automaticamente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAIL_DOMAIN = "nordestelocadora.app";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** "joaosilva" → "joaosilva@nordestelocadora.app" (respeita e-mail já digitado). */
function toEmail(username: string): string {
  const u = username.trim().toLowerCase();
  return u.includes("@") ? u : `${u.replace(/\s+/g, "")}@${EMAIL_DOMAIN}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Identifica quem chamou (pelo token enviado pelo app).
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller.user) return json({ error: "Não autenticado." }, 401);

    // 2) Só administradores passam daqui.
    if (caller.user.user_metadata?.is_admin !== true) {
      return json({ error: "Apenas o administrador pode gerenciar usuários." }, 403);
    }

    const { action, ...args } = await req.json();

    // 3) Ações.
    if (action === "list") {
      const { data, error } = await admin.auth.admin.listUsers();
      if (error) throw error;
      const users = data.users.map((u) => ({
        id: u.id,
        username: u.user_metadata?.username ?? (u.email ?? "").split("@")[0],
        name: u.user_metadata?.name ?? "",
        isAdmin: u.user_metadata?.is_admin === true,
      }));
      return json({ users });
    }

    if (action === "create") {
      const name = String(args.name ?? "").trim();
      const username = String(args.username ?? "").trim();
      const password = String(args.password ?? "");
      if (!name || !username || !password) return json({ error: "Preencha nome, login e senha." }, 400);
      if (username.length < 3) return json({ error: "O login deve ter ao menos 3 caracteres." }, 400);
      if (password.length < 6) return json({ error: "A senha deve ter ao menos 6 caracteres." }, 400);
      const { error } = await admin.auth.admin.createUser({
        email: toEmail(username),
        password,
        email_confirm: true,
        user_metadata: { name, username, is_admin: false },
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = String(args.id ?? "");
      if (!id) return json({ error: "Usuário inválido." }, 400);
      if (id === caller.user.id) return json({ error: "Você não pode excluir a si mesmo." }, 400);
      const { data: target } = await admin.auth.admin.getUserById(id);
      if (target?.user?.user_metadata?.is_admin === true) {
        return json({ error: "Não é possível excluir um administrador." }, 400);
      }
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "resetPassword") {
      const id = String(args.id ?? "");
      const password = String(args.password ?? "");
      if (!id) return json({ error: "Usuário inválido." }, 400);
      if (password.length < 6) return json({ error: "A senha deve ter ao menos 6 caracteres." }, 400);
      const { error } = await admin.auth.admin.updateUserById(id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro interno." }, 500);
  }
});
