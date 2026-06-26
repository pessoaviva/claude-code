/**
 * Criptografia local (AES-GCM + PBKDF2) usando a Web Crypto do navegador.
 *
 * Modelo "envelope": existe UMA chave de dados aleatória (dataKey) que cifra o
 * banco. Para cada usuário, guardamos essa dataKey "embrulhada" (cifrada) com
 * uma chave derivada da senha dele. Assim vários usuários compartilham os mesmos
 * dados, mas o conteúdo só é legível depois de um login válido. A senha nunca é
 * guardada; sem ela, ninguém decifra.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** String → ArrayBuffer (sempre ArrayBuffer "puro", para agradar a tipagem do DOM). */
function strBuf(s: string): ArrayBuffer {
  const u = enc.encode(s);
  const buf = new ArrayBuffer(u.byteLength);
  new Uint8Array(buf).set(u);
  return buf;
}

function bufToB64(b: ArrayBuffer): string {
  const bytes = new Uint8Array(b);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(s: string): ArrayBuffer {
  const bin = atob(s);
  const buf = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return buf;
}

/** True quando a Web Crypto está disponível (contexto seguro: https ou file://). */
export function cryptoAvailable(): boolean {
  return typeof crypto !== "undefined" && !!crypto.subtle;
}

export function randomSaltB64(): string {
  return bufToB64(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

async function deriveKey(password: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", strBuf(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBuf(saltB64), iterations: 150_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function aesEncrypt(key: CryptoKey, data: ArrayBuffer): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return bufToB64(iv.buffer) + ":" + bufToB64(ct);
}
async function aesDecrypt(key: CryptoKey, blob: string): Promise<ArrayBuffer> {
  const [ivB64, ctB64] = blob.split(":");
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(ivB64) }, key, b64ToBuf(ctB64));
}

/** Gera uma nova chave de dados aleatória (AES-256). */
export async function generateDataKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

/** Embrulha a dataKey com a senha (resultado vai para o registro do usuário). */
export async function wrapDataKey(dataKey: CryptoKey, password: string, saltB64: string): Promise<string> {
  const pwKey = await deriveKey(password, saltB64);
  const raw = await crypto.subtle.exportKey("raw", dataKey);
  return aesEncrypt(pwKey, raw);
}

/** Desembrulha a dataKey usando a senha. Lança erro se a senha estiver errada. */
export async function unwrapDataKey(wrap: string, password: string, saltB64: string): Promise<CryptoKey> {
  const pwKey = await deriveKey(password, saltB64);
  const raw = await aesDecrypt(pwKey, wrap);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export async function encryptJSON(obj: unknown, dataKey: CryptoKey): Promise<string> {
  return aesEncrypt(dataKey, strBuf(JSON.stringify(obj)));
}
export async function decryptJSON<T>(blob: string, dataKey: CryptoKey): Promise<T> {
  return JSON.parse(dec.decode(await aesDecrypt(dataKey, blob))) as T;
}

/** Exporta a dataKey (base64) para cache de sessão; reimporta no reload. */
export async function exportDataKey(dataKey: CryptoKey): Promise<string> {
  return bufToB64(await crypto.subtle.exportKey("raw", dataKey));
}
export async function importDataKey(b64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", b64ToBuf(b64), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
