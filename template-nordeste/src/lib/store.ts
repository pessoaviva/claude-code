/**
 * Persistência local: os dados ficam CIFRADOS no localStorage (AES-GCM) e só
 * são legíveis após o login — ver lib/crypto. A fachada lib/persist decide
 * entre este modo local e a nuvem (Supabase).
 *
 * 👉 Ao trocar os modelos (lib/types), ajuste apenas `seed()` e `normalize()`.
 */
import type { DB, Item } from "./types";
import { decryptJSON, encryptJSON } from "./crypto";

const KEY_V2 = "app_data:v2"; // banco cifrado

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Data local em "YYYY-MM-DD" (sem converter para UTC). */
export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function today(): string {
  return localYmd(new Date());
}

/** Dados de exemplo (primeiro acesso). Troque pelo que fizer sentido ao cliente. */
export function seed(): DB {
  return {
    items: [
      { id: uid(), title: "Item de exemplo", note: "Edite ou apague — isto é só demonstração.", done: false, createdAt: today() },
    ],
  };
}

/** Garante que dados antigos/importados tenham todos os campos esperados. */
export function normalize(raw: DB): DB {
  const db = (raw ?? {}) as DB;
  db.items = (db.items ?? []).map(
    (i): Item => ({
      id: i.id ?? uid(),
      title: i.title ?? "",
      note: i.note ?? "",
      done: !!i.done,
      createdAt: i.createdAt ?? today(),
    })
  );
  return db;
}

let cache: DB | null = null;

export function hasEncryptedDb(): boolean {
  return localStorage.getItem(KEY_V2) != null;
}

/** Carrega e DECIFRA o banco usando a dataKey (obtida no login). */
export async function loadEncrypted(dataKey: CryptoKey): Promise<DB> {
  const blob = localStorage.getItem(KEY_V2);
  if (blob) {
    const db = normalize(await decryptJSON<DB>(blob, dataKey));
    cache = db;
    return db;
  }
  const db = seed();
  const enc = await encryptJSON(db, dataKey);
  localStorage.setItem(KEY_V2, enc);
  cache = db;
  return db;
}

export async function saveEncrypted(db: DB, dataKey: CryptoKey): Promise<void> {
  const blob = await encryptJSON(db, dataKey);
  localStorage.setItem(KEY_V2, blob); // pode lançar se a cota estourar; cache fica intacto
  cache = db;
}

export async function resetAll(dataKey: CryptoKey): Promise<void> {
  await saveEncrypted(seed(), dataKey);
}

/** Exporta o backup em texto puro (do que está decifrado em memória). */
export function exportJSON(): string {
  return JSON.stringify(cache ?? seed(), null, 2);
}

export async function importJSON(text: string, dataKey: CryptoKey): Promise<DB> {
  const data = JSON.parse(text) as DB;
  if (!Array.isArray(data.items)) {
    throw new Error("Arquivo inválido: estrutura não reconhecida.");
  }
  const normalized = normalize(data);
  await saveEncrypted(normalized, dataKey);
  return normalized;
}
