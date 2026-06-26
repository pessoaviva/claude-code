import { useEffect, useState } from "react";
import { applyTheme, getTheme, type Theme } from "./lib/theme";
import { clearSession, getSessionUser, setSession, type User } from "./lib/auth";
import { exportDataKey, importDataKey } from "./lib/crypto";
import { cloudMode, persistExportJSON, persistImportJSON, persistLoad, persistReset, persistSave } from "./lib/persist";
import { cloudCurrentUser, cloudSignOut } from "./lib/cloud";
import type { DB } from "./lib/types";
import { APP_CONFIG } from "./config";
import { AdminContext } from "./components/AuthContext";
import { Login } from "./pages/Login";
import { Items } from "./pages/Items";
import { UsersModal } from "./components/UsersModal";

const DK_KEY = "app_dk"; // cache da chave (só na sessão da aba; some ao fechar)

export function App() {
  const [theme, setTheme] = useState<Theme>(() => getTheme());
  const [user, setUser] = useState<User | null>(null);
  const [dataKey, setDataKey] = useState<CryptoKey | null>(null);
  const [db, setDb] = useState<DB | null>(null);
  const [booting, setBooting] = useState(true);
  const [usersOpen, setUsersOpen] = useState(false);

  // Ao abrir: tenta retomar a sessão sem pedir senha de novo.
  useEffect(() => {
    (async () => {
      try {
        if (cloudMode) {
          const cu = await cloudCurrentUser();
          if (cu) {
            const loaded = await persistLoad(null);
            setUser(cu);
            setDb(loaded);
          }
          setBooting(false);
          return;
        }
        const su = getSessionUser();
        const cached = sessionStorage.getItem(DK_KEY);
        if (su && cached) {
          const key = await importDataKey(cached);
          const loaded = await persistLoad(key);
          setUser(su);
          setDataKey(key);
          setDb(loaded);
        }
      } catch {
        /* qualquer falha → mostra o login */
      }
      setBooting(false);
    })();
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  async function handleUnlocked(u: User, key: CryptoKey | null) {
    try {
      const loaded = await persistLoad(key);
      if (!cloudMode && key) {
        setSession(u);
        sessionStorage.setItem(DK_KEY, await exportDataKey(key));
      }
      setUser(u);
      setDataKey(key);
      setDb(loaded);
    } catch (e) {
      alert("Não foi possível abrir os dados: " + (e instanceof Error ? e.message : "erro"));
    }
  }

  function logout() {
    if (cloudMode) void cloudSignOut();
    clearSession();
    sessionStorage.removeItem(DK_KEY);
    setUser(null);
    setDataKey(null);
    setDb(null);
  }

  /** Persiste (cifrado no local, ou na nuvem). */
  function update(next: DB) {
    if (!cloudMode && !dataKey) return;
    persistSave(next, dataKey)
      .then(() => setDb({ ...next }))
      .catch((e) => {
        alert(
          cloudMode
            ? "Não foi possível salvar na nuvem. Verifique a conexão e tente novamente.\n\n" + (e instanceof Error ? e.message : "")
            : "Não foi possível salvar: o armazenamento do navegador pode estar cheio."
        );
      });
  }

  function handleExport() {
    const blob = new Blob([persistExportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || (!cloudMode && !dataKey)) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = await persistImportJSON(String(reader.result), dataKey);
        setDb({ ...data });
        alert("Backup importado com sucesso ✓");
      } catch {
        alert("Arquivo inválido.");
      }
    };
    reader.readAsText(file);
  }

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        <span className="animate-pulse">🔓 Abrindo…</span>
      </div>
    );
  }

  if (!user || !db || (!cloudMode && !dataKey)) return <Login onUnlocked={handleUnlocked} />;

  return (
    <AdminContext.Provider value={user.isAdmin}>
      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex items-center gap-2 text-lg font-bold">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-base shadow-md shadow-teal-900/40">{APP_CONFIG.appIcon}</span>
              <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-teal-300 dark:to-cyan-300">{APP_CONFIG.appName}</span>
              {APP_CONFIG.appSubtitle && <span className="hidden text-fg sm:inline"> {APP_CONFIG.appSubtitle}</span>}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={toggleTheme} aria-label="Alternar tema" className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-faint hover:bg-line">
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              <button onClick={handleExport} title="Exportar backup" className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-faint hover:bg-line">
                ⬇️ <span className="hidden sm:inline">Exportar</span>
              </button>
              {user.isAdmin && (
                <label title="Importar backup" className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-faint hover:bg-line">
                  ⬆️ <span className="hidden sm:inline">Importar</span>
                  <input type="file" accept="application/json" hidden onChange={handleImport} />
                </label>
              )}
              <div className="ml-1 flex items-center gap-2 border-l border-line pl-2">
                <span className="hidden text-xs text-muted sm:inline">👤 {user.name}{user.isAdmin ? " (admin)" : ""}</span>
                {user.isAdmin && (
                  <button onClick={() => setUsersOpen(true)} title="Gerenciar usuários" className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-faint hover:bg-line">
                    👥 <span className="hidden sm:inline">Usuários</span>
                  </button>
                )}
                <button onClick={logout} title="Sair" className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-faint hover:bg-line">
                  ⎋ <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="animate-fade-in mx-auto max-w-5xl px-4 py-6">
          <Items db={db} onChange={update} />
        </main>

        <footer className="mx-auto max-w-5xl px-4 py-8 text-xs text-faint">
          {cloudMode ? (
            <>Os dados ficam na <strong>nuvem</strong> (Supabase), com backup e acesso de qualquer dispositivo, protegidos por login.</>
          ) : (
            <>Os dados ficam <strong>cifrados</strong> neste navegador e só abrem após o login. Use Exportar/Importar para backup.</>
          )}{" "}
          {user.isAdmin && (
            <button
              onClick={async () => {
                if (confirm("Apagar TODOS os dados e restaurar o exemplo? Esta ação não pode ser desfeita.")) {
                  await persistReset(dataKey);
                  location.reload();
                }
              }}
              className="text-rose-600 hover:underline dark:text-rose-400"
            >
              Limpar todos os dados
            </button>
          )}
        </footer>

        {usersOpen && user.isAdmin && (
          <UsersModal actor={user.name} currentUserId={user.id} dataKey={dataKey} onChanged={() => {}} onClose={() => setUsersOpen(false)} />
        )}
      </div>
    </AdminContext.Provider>
  );
}
