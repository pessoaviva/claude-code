import type { Response } from "express";

/** A controlled, non-masking application error carrying an HTTP status. */
export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "AppError";
  }
}

export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ ok: true, data });
}

/** Validate that a value is a non-empty string. */
export function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim() === "") {
    throw new AppError(400, `Campo obrigatório ausente ou inválido: "${key}"`);
  }
  return v.trim();
}

export function optString(obj: Record<string, unknown>, key: string, fallback = ""): string {
  const v = obj[key];
  return typeof v === "string" ? v.trim() : fallback;
}

/** Validate an enum membership. */
export function reqEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const v = reqString(obj, key);
  if (!allowed.includes(v as T)) {
    throw new AppError(400, `Valor inválido para "${key}". Permitidos: ${allowed.join(", ")}`);
  }
  return v as T;
}
