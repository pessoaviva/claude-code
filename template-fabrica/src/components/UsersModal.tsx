import { useEffect, useState } from "react";
import { addUser, changePassword, loadUsers, removeUser, type User } from "../lib/auth";
import { logAudit } from "../lib/audit";
import { cloudMode } from "../lib/persist";
import { cloudCreateUser, cloudDeleteUser, cloudListUsers, cloudResetPassword, type CloudUser } from "../lib/cloudUsers";
import { Button, EmptyState, Field, IconButton, Input, Modal, Table } from "./ui";

interface Props {
  actor: string;
  currentUserId: string;
  dataKey: CryptoKey | null;
  onChanged: () => void;
  onClose: () => void;
}

/** Gestão de contas — disponível apenas para o administrador. */
export function UsersModal(props: Props) {
  return cloudMode ? <CloudUsersModal {...props} /> : <LocalUsersModal {...props} />;
}

/* ============================ Modo nuvem (Supabase) ======================== */

function CloudUsersModal({ actor, currentUserId, onChanged, onClose }: Props) {
  const [users, setUsers] = useState<CloudUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setUsers(await cloudListUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os usuários.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await cloudCreateUser(name, username, password);
      logAudit({ user: actor, kind: "create", text: `Criou o acesso "${username.trim()}" (${name.trim()})` });
      setName("");
      setUsername("");
      setPassword("");
      onChanged();
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(u: CloudUser) {
    if (!confirm(`Excluir o acesso de "${u.name}" (${u.username})?`)) return;
    try {
      await cloudDeleteUser(u.id);
      logAudit({ user: actor, kind: "delete", text: `Excluiu o acesso "${u.username}" (${u.name})` });
      onChanged();
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function resetPassword(u: CloudUser) {
    const np = prompt(`Nova senha para ${u.name} (mín. 6 caracteres):`);
    if (np == null) return;
    try {
      await cloudResetPassword(u.id, np);
      logAudit({ user: actor, kind: "update", text: `Redefiniu a senha de "${u.username}" (${u.name})` });
      onChanged();
      alert("Senha atualizada ✓");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    }
  }

  return (
    <Modal title="Usuários & acessos" onClose={onClose} wide>
      <div className="space-y-5">
        <form onSubmit={add} className="space-y-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Criar novo acesso</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" disabled={busy} />
            </Field>
            <Field label="Login">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: joaosilva" disabled={busy} />
            </Field>
            <Field label="Senha" hint="(mín. 6)">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" disabled={busy} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>{busy ? "Criando…" : "+ Criar acesso"}</Button>
          </div>
        </form>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Acessos cadastrados</div>
          {loading ? (
            <EmptyState icon="⏳">Carregando…</EmptyState>
          ) : error ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">{error}</p>
          ) : users.length === 0 ? (
            <EmptyState icon="👤">Nenhum usuário.</EmptyState>
          ) : (
            <Table headers={["Nome", "Login", "Tipo", ""]}>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line/50 transition hover:bg-line/30">
                  <td className="px-3 py-3 font-medium">{u.name}</td>
                  <td className="px-3 py-3 text-muted">{u.username}</td>
                  <td className="px-3 py-3">
                    {u.isAdmin ? (
                      <span className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300">Administrador</span>
                    ) : (
                      <span className="rounded-full border border-line bg-bg/60 px-2.5 py-0.5 text-xs text-muted">Usuário</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <IconButton onClick={() => resetPassword(u)} title="Redefinir senha">🔑</IconButton>
                    {!u.isAdmin && u.id !== currentUserId && (
                      <IconButton onClick={() => remove(u)} title="Excluir acesso">🗑️</IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <p className="text-xs text-faint">
          Apenas o administrador cria contas — não há autocadastro. As contas ficam no
          Supabase (login de verdade, na nuvem) e a criação é feita com segurança pelo servidor.
        </p>
      </div>
    </Modal>
  );
}

/* ===================== Modo local (navegador, criptografia) =============== */

function LocalUsersModal({ actor, currentUserId, dataKey, onChanged, onClose }: Props) {
  const [users, setUsers] = useState<User[]>(() => loadUsers());
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function refresh() {
    setUsers(loadUsers());
    onChanged();
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await addUser(name, username, password, dataKey!);
      logAudit({ user: actor, kind: "create", text: `Criou o acesso "${username.trim()}" (${name.trim()})` });
      setName("");
      setUsername("");
      setPassword("");
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível criar a conta.");
    }
  }

  function remove(u: User) {
    if (!confirm(`Excluir o acesso de "${u.name}" (${u.username})?`)) return;
    try {
      removeUser(u.id);
      logAudit({ user: actor, kind: "delete", text: `Excluiu o acesso "${u.username}" (${u.name})` });
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function resetPassword(u: User) {
    const np = prompt(`Nova senha para ${u.name} (mín. 6 caracteres):`);
    if (np == null) return;
    try {
      await changePassword(u.id, np, dataKey!);
      logAudit({ user: actor, kind: "update", text: `Redefiniu a senha de "${u.username}" (${u.name})` });
      onChanged();
      alert("Senha atualizada ✓");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    }
  }

  return (
    <Modal title="Usuários & acessos" onClose={onClose} wide>
      <div className="space-y-5">
        <form onSubmit={add} className="space-y-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Criar novo acesso</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Nome">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João Silva" />
            </Field>
            <Field label="Login">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: joaosilva" />
            </Field>
            <Field label="Senha" hint="(mín. 6)">
              <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="senha" />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit">+ Criar acesso</Button>
          </div>
        </form>

        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Acessos cadastrados</div>
          {users.length === 0 ? (
            <EmptyState icon="👤">Nenhum usuário.</EmptyState>
          ) : (
            <Table headers={["Nome", "Login", "Tipo", ""]}>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line/50 transition hover:bg-line/30">
                  <td className="px-3 py-3 font-medium">{u.name}</td>
                  <td className="px-3 py-3 text-muted">{u.username}</td>
                  <td className="px-3 py-3">
                    {u.isAdmin ? (
                      <span className="rounded-full border border-teal-500/40 bg-teal-500/10 px-2.5 py-0.5 text-xs font-semibold text-teal-700 dark:text-teal-300">Administrador</span>
                    ) : (
                      <span className="rounded-full border border-line bg-bg/60 px-2.5 py-0.5 text-xs text-muted">Usuário</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <IconButton onClick={() => resetPassword(u)} title="Redefinir senha">🔑</IconButton>
                    {!u.isAdmin && u.id !== currentUserId && (
                      <IconButton onClick={() => remove(u)} title="Excluir acesso">🗑️</IconButton>
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <p className="text-xs text-faint">
          Apenas o administrador cria contas — não há autocadastro. Lembrete: por rodar 100% no
          navegador, este login é uma trava de acesso, não segurança de servidor.
        </p>
      </div>
    </Modal>
  );
}
