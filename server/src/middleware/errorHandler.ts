import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/http.js";
import { audit } from "../lib/audit.js";

/**
 * Central error handler. Never masks errors: AppErrors return their intended
 * status/message; anything unexpected is logged, audited and returned as 500
 * with the real message (no silent swallowing).
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.status >= 500) {
      void audit({ category: "error", entity: "http", action: "app_error", details: { path: req.path, message: err.message } });
    }
    res.status(err.status).json({ ok: false, error: err.message, details: err.details ?? null });
    return;
  }

  const message = err instanceof Error ? err.message : "Erro interno desconhecido";
  console.error(`[error] ${req.method} ${req.path}:`, err);
  void audit({
    category: "error",
    entity: "http",
    action: "unhandled_error",
    details: { path: req.path, method: req.method, message },
  });
  res.status(500).json({ ok: false, error: message });
}
