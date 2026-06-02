/**
 * API client. The app is browser-only: instead of HTTP calls to a backend,
 * requests are served by the in-browser store (localStorage). The method
 * surface (get/post/patch/del) and error semantics are unchanged, so pages
 * don't need to know there is no server.
 */
import { handle } from "./localApi";

export const api = {
  get: <T>(path: string) => handle("GET", path) as Promise<T>,
  post: <T>(path: string, body?: unknown) => handle("POST", path, body) as Promise<T>,
  patch: <T>(path: string, body?: unknown) => handle("PATCH", path, body) as Promise<T>,
  del: <T>(path: string) => handle("DELETE", path) as Promise<T>,
};
