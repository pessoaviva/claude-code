const BASE = "/api";

export interface ApiError {
  ok: false;
  error: string;
  details?: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json = await res.json().catch(() => ({ ok: false, error: "Resposta inválida do servidor" }));
  if (!res.ok || json.ok === false) {
    const err = new Error(json.error ?? `HTTP ${res.status}`) as Error & { details?: unknown; status?: number };
    err.details = json.details;
    err.status = res.status;
    throw err;
  }
  return json.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
