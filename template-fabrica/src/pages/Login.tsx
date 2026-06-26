import { useEffect, useState } from "react";
import {
  LOCK_MINUTES,
  login,
  registerFailure,
  remainingLockMs,
  resetAttempts,
  unlock,
  type User,
} from "../lib/auth";
import { cryptoAvailable } from "../lib/crypto";
import { supabaseEnabled } from "../lib/supabase";
import { cloudSignIn } from "../lib/cloud";
import { APP_CONFIG } from "../config";
import { Button, Field, Input } from "../components/ui";

function fmt(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function Login({ onUnlocked }: { onUnlocked: (user: User, key: CryptoKey | null) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, setNow] = useState(Date.now()); // tick p/ a contagem do bloqueio

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lockMs = remainingLockMs(username);
  const locked = lockMs > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || busy) return;

    // Modo nuvem: login de verdade pelo Supabase Auth.
    if (supabaseEnabled()) {
      setBusy(true);
      try {
        const u = await cloudSignIn(username, password);
        resetAttempts(username);
        onUnlocked(u, null);
      } catch (err) {
        const res = registerFailure(username);
        setError(
          res.lockedUntil
            ? `Muitas tentativas. Conta bloqueada por ${LOCK_MINUTES} minutos.`
            : (err instanceof Error ? err.message : "Login ou senha incorretos.") +
              ` Tentativas restantes: ${res.attemptsLeft}.`
        );
        setPassword("");
        setNow(Date.now());
        setBusy(false);
      }
      return;
    }

    if (!cryptoAvailable()) {
      setError("Este navegador não suporta a criptografia necessária. Use um navegador atual (Chrome/Edge/Firefox).");
      return;
    }
    const u = login(username, password);
    if (!u) {
      const res = registerFailure(username);
      setError(
        res.lockedUntil
          ? `Muitas tentativas. Conta bloqueada por ${LOCK_MINUTES} minutos.`
          : `Login ou senha incorretos. Tentativas restantes: ${res.attemptsLeft}.`
      );
      setPassword("");
      setNow(Date.now());
      return;
    }
    // senha correta — desbloqueia a chave de criptografia (pode demorar ~0,2s)
    setBusy(true);
    try {
      const key = await unlock(u, password);
      resetAttempts(username);
      onUnlocked(u, key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível abrir os dados.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-2xl shadow-lg shadow-teal-900/40">{APP_CONFIG.appIcon}</span>
          <h1 className="text-xl font-bold">
            <span className="bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent dark:from-teal-300 dark:to-cyan-300">{APP_CONFIG.appName}</span>
            {APP_CONFIG.appSubtitle && <span className="text-fg"> {APP_CONFIG.appSubtitle}</span>}
          </h1>
          <p className="text-sm text-muted">Entre para acessar o sistema</p>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line/80 bg-gradient-to-b from-surface/90 to-surface/70 p-6 shadow-lg shadow-black/5 dark:shadow-black/20">
          <Field label="Login">
            <Input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(""); }}
              placeholder="seu login"
              autoFocus
              autoComplete="username"
              disabled={busy}
            />
          </Field>
          <Field label="Senha">
            <div className="flex gap-2">
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="sua senha"
                autoComplete="current-password"
                disabled={locked || busy}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="rounded-xl border border-line px-3 text-sm text-muted transition hover:bg-line"
                title={show ? "Ocultar senha" : "Mostrar senha"}
              >
                {show ? "🙈" : "👁️"}
              </button>
            </div>
          </Field>

          {locked ? (
            <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              🔒 Conta bloqueada por excesso de tentativas. Tente novamente em <strong>{fmt(lockMs)}</strong>.
            </p>
          ) : error ? (
            <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={locked || busy}>
            {busy ? "Entrando…" : locked ? `Aguarde ${fmt(lockMs)}` : "Entrar"}
          </Button>

          <p className="text-center text-xs text-faint">
            Não é possível criar conta aqui. Apenas o administrador (Bruno Casado) cria os acessos.
          </p>
        </form>
      </div>
    </div>
  );
}
