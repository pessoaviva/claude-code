import { createContext, useContext } from "react";

/** Indica se o usuário logado é administrador (Bruno Casado). */
export const AdminContext = createContext(false);

/** Hook: true quando o usuário atual é administrador. */
export function useIsAdmin(): boolean {
  return useContext(AdminContext);
}
