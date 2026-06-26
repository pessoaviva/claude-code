/**
 * Autenticação 100% no navegador (sem back-end), com criptografia dos dados.
 *
 * Cada usuário guarda a chave de dados (dataKey) "embrulhada" com a senha dele
 * (envelope — ver lib/crypto). O login desbloqueia a dataKey, que decifra o
 * banco. A senha nunca é guardada.
 *
 * ⚠️ Continua sendo uma trava de acesso no cliente, não segurança de servidor:
 * sem back-end não há como impedir adulteração por quem tem acesso técnico ao
 * dispositivo. Mas os dados ficam cifrados em repouso e só abrem após o login.
 */
import { generateDataKey, randomSaltB64, unwrapDataKey, wrapDataKey } from "./crypto";
import { APP_CONFIG } from "../config";

export interface User {
  id: string;
  username: string;
  name: string;
  passhash: string;
  isAdmin: boolean;
  salt?: string; // base64 — sal do PBKDF2 deste usuário
  wrap?: string; // dataKey cifrada com a senha deste usuário
}

const USERS_KEY = "app_users:v1";
const SESSION_KEY = "app_session:v1";

// Administrador fixo — único que pode criar contas. Os valores vêm de src/config.
// Guardamos só o HASH (não a senha em texto puro), para não vazar a senha em
// quem abrir o código-fonte. (Ainda não é segurança real — só um back-end resolve.)
const ADMIN = {
  username: APP_CONFIG.adminUsername,
  name: APP_CONFIG.adminName,
  passhash: APP_CONFIG.adminPasshash,
};

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Ofuscação simples (FNV-1a). NÃO é hash criptográfico. */
export function hashPassword(pw: string): string {
  let h = 0x811c9dc5;
  const s = "nordeste::" + pw;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function read(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as User[]) : [];
  } catch {
    return [];
  }
}

function write(users: User[]): void {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Garante que o admin (Bruno Casado) sempre exista; retorna a lista de usuários. */
export function loadUsers(): User[] {
  const users = read();
  if (!users.some((u) => u.username.toLowerCase() === ADMIN.username.toLowerCase())) {
    users.unshift({
      id: uid(),
      username: ADMIN.username,
      name: ADMIN.name,
      passhash: ADMIN.passhash,
      isAdmin: true,
    });
    write(users);
  }
  return users;
}

export function findByUsername(username: string): User | undefined {
  return loadUsers().find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
}

/** Verifica usuário+senha (hash). Retorna o usuário ou null. */
export function login(username: string, password: string): User | null {
  const u = findByUsername(username);
  if (!u) return null;
  return u.passhash === hashPassword(password) ? u : null;
}

/** Grava o sal + dataKey embrulhada para um usuário (após validar a senha). */
async function rewrapForUser(userId: string, password: string, dataKey: CryptoKey): Promise<void> {
  const salt = randomSaltB64();
  const wrap = await wrapDataKey(dataKey, password, salt);
  write(loadUsers().map((u) => (u.id === userId ? { ...u, salt, wrap } : u)));
}

/**
 * Desbloqueia a chave de dados a partir da senha (já validada por login()).
 * - Usuário com envelope: desembrulha a dataKey.
 * - Admin sem envelope (primeiro acesso após ativar a criptografia): cria a
 *   dataKey do sistema e a embrulha com a senha do admin.
 * - Demais usuários sem envelope: precisam ser recriados pelo admin.
 */
export async function unlock(user: User, password: string): Promise<CryptoKey> {
  if (user.wrap && user.salt) {
    return unwrapDataKey(user.wrap, password, user.salt);
  }
  if (user.isAdmin) {
    const dataKey = await generateDataKey();
    await rewrapForUser(user.id, password, dataKey);
    return dataKey;
  }
  throw new Error("Seu acesso precisa ser recriado pelo administrador (atualização de segurança).");
}

/* ---------- Sessão ---------- */
export function getSessionUser(): User | null {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return loadUsers().find((u) => u.username === username) ?? null;
}

export function setSession(user: User): void {
  localStorage.setItem(SESSION_KEY, user.username);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/* ---------- Administração de contas (apenas admin) ---------- */

/** Cria um novo usuário comum (não-admin). Lança erro se inválido/duplicado. */
export async function addUser(name: string, username: string, password: string, dataKey: CryptoKey): Promise<User> {
  const uname = username.trim();
  const nm = name.trim();
  if (!nm || !uname || !password) throw new Error("Preencha nome, login e senha.");
  if (uname.length < 3) throw new Error("O login deve ter ao menos 3 caracteres.");
  if (password.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
  const users = loadUsers();
  if (users.some((u) => u.username.toLowerCase() === uname.toLowerCase())) {
    throw new Error("Já existe um login com esse nome.");
  }
  const salt = randomSaltB64();
  const wrap = await wrapDataKey(dataKey, password, salt); // dá acesso aos dados a este usuário
  const user: User = { id: uid(), username: uname, name: nm, passhash: hashPassword(password), isAdmin: false, salt, wrap };
  users.push(user);
  write(users);
  return user;
}

export function removeUser(id: string): void {
  const users = loadUsers();
  const target = users.find((u) => u.id === id);
  if (!target) return;
  if (target.isAdmin) throw new Error("Não é possível excluir um administrador.");
  write(users.filter((u) => u.id !== id));
}

export async function changePassword(id: string, newPassword: string, dataKey: CryptoKey): Promise<void> {
  if (!newPassword || newPassword.length < 6) throw new Error("A senha deve ter ao menos 6 caracteres.");
  const salt = randomSaltB64();
  const wrap = await wrapDataKey(dataKey, newPassword, salt); // re-embrulha a dataKey com a nova senha
  write(loadUsers().map((u) => (u.id === id ? { ...u, passhash: hashPassword(newPassword), salt, wrap } : u)));
}

/* ---------- Bloqueio por tentativas (anti-força-bruta) ---------- */

const LOCK_KEY = "app_lockout:v1";
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 10;
const LOCK_MS = LOCK_MINUTES * 60 * 1000;

interface Attempt {
  fails: number;
  lockedUntil: number | null; // timestamp (ms) até quando está bloqueado
}

function lockKey(username: string): string {
  return username.trim().toLowerCase();
}

function readLocks(): Record<string, Attempt> {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Attempt>) : {};
  } catch {
    return {};
  }
}

function writeLocks(map: Record<string, Attempt>): void {
  localStorage.setItem(LOCK_KEY, JSON.stringify(map));
}

/** Tempo restante de bloqueio (ms) para um login. 0 = liberado. */
export function remainingLockMs(username: string): number {
  if (!username.trim()) return 0;
  const a = readLocks()[lockKey(username)];
  if (!a || !a.lockedUntil) return 0;
  return Math.max(0, a.lockedUntil - Date.now());
}

/** Registra uma tentativa falha; bloqueia por 10 min ao atingir o limite. */
export function registerFailure(username: string): { lockedUntil: number | null; attemptsLeft: number } {
  const k = lockKey(username);
  const locks = readLocks();
  const a: Attempt = locks[k] ?? { fails: 0, lockedUntil: null };
  // Se havia um bloqueio já expirado, zera antes de contar.
  if (a.lockedUntil && a.lockedUntil <= Date.now()) {
    a.fails = 0;
    a.lockedUntil = null;
  }
  a.fails += 1;
  let lockedUntil: number | null = null;
  if (a.fails >= MAX_LOGIN_ATTEMPTS) {
    lockedUntil = Date.now() + LOCK_MS;
    a.lockedUntil = lockedUntil;
    a.fails = 0; // reinicia a contagem; novo bloqueio após novas falhas
  }
  locks[k] = a;
  writeLocks(locks);
  return { lockedUntil, attemptsLeft: lockedUntil ? 0 : MAX_LOGIN_ATTEMPTS - a.fails };
}

/** Limpa as tentativas de um login (após sucesso). */
export function resetAttempts(username: string): void {
  const locks = readLocks();
  delete locks[lockKey(username)];
  writeLocks(locks);
}
