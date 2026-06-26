/**
 * Fachada de persistência: o App não precisa saber se os dados estão no
 * navegador (cifrados, localStorage) ou na nuvem (Supabase).
 *
 * - Modo nuvem (Supabase configurado): grava/lê na tabela `app_state`.
 * - Modo local (padrão): usa a criptografia + localStorage de sempre.
 *
 * A `dataKey` só é necessária no modo local (vem do login). No modo nuvem
 * ela é ignorada (pode ser null).
 */
import type { DB } from "./types";
import { supabaseEnabled } from "./supabase";
import * as cloud from "./cloud";
import {
  exportJSON as exportLocalJSON,
  importJSON as importLocalJSON,
  loadEncrypted,
  normalize,
  resetAll,
  saveEncrypted,
  seed,
} from "./store";

/** true quando o back-end está ativo (decidido por variáveis de ambiente). */
export const cloudMode = supabaseEnabled();

/** Última cópia em memória — usada para exportar backup no modo nuvem. */
let lastDb: DB | null = null;

export async function persistLoad(dataKey: CryptoKey | null): Promise<DB> {
  if (cloudMode) {
    const remote = await cloud.cloudLoad();
    const db = remote ? normalize(remote) : seed();
    if (!remote) await cloud.cloudSave(db); // primeira vez: planta os exemplos
    lastDb = db;
    return db;
  }
  return loadEncrypted(dataKey!);
}

export async function persistSave(db: DB, dataKey: CryptoKey | null): Promise<void> {
  if (cloudMode) {
    await cloud.cloudSave(db);
    lastDb = db;
    return;
  }
  await saveEncrypted(db, dataKey!);
}

export async function persistReset(dataKey: CryptoKey | null): Promise<void> {
  if (cloudMode) {
    const db = seed();
    await cloud.cloudSave(db);
    lastDb = db;
    return;
  }
  await resetAll(dataKey!);
}

export function persistExportJSON(): string {
  if (cloudMode) return JSON.stringify(lastDb ?? seed(), null, 2);
  return exportLocalJSON();
}

export async function persistImportJSON(text: string, dataKey: CryptoKey | null): Promise<DB> {
  if (cloudMode) {
    const data = JSON.parse(text) as DB;
    if (!Array.isArray(data.items)) {
      throw new Error("Arquivo inválido: estrutura não reconhecida.");
    }
    const normalized = normalize(data);
    await cloud.cloudSave(normalized);
    lastDb = normalized;
    return normalized;
  }
  return importLocalJSON(text, dataKey!);
}
